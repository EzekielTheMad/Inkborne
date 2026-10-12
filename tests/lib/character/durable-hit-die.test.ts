import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canonicalHitDieJson, canonicalHitDieIntent, hitDieDependencyFingerprint, matchesHitDieOperation, planDurableHitDie } from "@/lib/character/durable-hit-die";
import { actionRevisionSchema, hitDieRequestSchema, hitDieSnapshotSchema, hitDiePlanResultSchema, type HitDieSnapshot } from "@/lib/character/durable-hit-die-schema";
import { computeMaxHp } from "@/lib/character/max-hp";
import { spendHitDiePatch } from "@/lib/hit-dice/helpers";

const id = (last: number) => `11111111-1111-4111-8111-${String(last).padStart(12, "0")}`;
const instant = "2026-10-12T01:00:00.000Z";
function snapshot(): HitDieSnapshot {
  return {
    contract_version: 1,
    character: { id: id(1), owner_id: id(2), system_id: id(3), campaign_id: null, archived: false,
      revision: "9007199254740993", level: 1, base_stats: { constitution: 14, dexterity: 10 },
      choices: { classes: [{ slug: "fighter", level: 1 }], hp_rolls: {} }, state: { current_hp: 4, hit_dice_spent: { fighter: 0 } } },
    system: { id: id(3), slug: "dnd-5e-2014", expression_context: {}, schema_definition: {
      ability_scores: [{slug:"constitution",name:"Constitution",abbr:"CON"}], proficiency_levels: [{slug:"none",name:"None",multiplier:0}],
      derived_stats: [{slug:"armor_class",name:"Armor Class",base:10}], skills: [], resources: [], currencies: [],
      content_types: [{slug:"class",name:"Class"}], creation_steps: [{step:1,type:"class",label:"Class"}], sheet_sections: [{slug:"stats",label:"Stats"}],
    } }, campaign: null,
    pins: [{ id:id(4),character_id:id(1),content_id:id(5),content_version:1,context:{},choice_source:null,
      resolved:{id:id(5),version:1,system_id:id(3),content_type:"class",slug:"fighter",name:"Fighter",data:{hit_die:10,spellcasting:null,multiclass:{prerequisites:[],proficiencies_gained:[]},saving_throws:[],starting_proficiencies:[],levels:Array.from({length:20},(_,i)=>({level:i+1,features:[],spellcasting:null})),source_refs:[]},effects:[],source:"srd",scope:"platform",owner_id:null} }],
    inventory: [], feature_grants: [], spell_grants: [], spells: [], access_rows: [],
  };
}
function request(s = snapshot()) {
  return { contract_version:1 as const,character_id:s.character.id,operation_id:id(6),command:"spend_hit_die" as const,class_slug:"fighter",expected_revision:s.character.revision,dependency_fingerprint:hitDieDependencyFingerprint(s) };
}
function plan(s = snapshot(), face = 3, evaluationInstant = instant, acceptanceInstant = evaluationInstant) {
  return planDurableHitDie(s, request(s), {enabled:true,evaluationInstant,acceptanceInstant,acceptedDieFace:face});
}
function planned(s = snapshot(), face = 3) {
  const result = plan(s, face);
  expect(result.status).toBe("planned");
  if (result.status !== "planned") throw new Error(`Unexpected ${JSON.stringify(result)}`);
  return result;
}
function activeEffect(expiresAt: string | null = null) {
  return { id:id(20),name:"Constitution boon",slug:"custom",source:"custom",content_id:null,
    effects:[{type:"mechanical",stat:"constitution",op:"add",value:4}],duration:{type:"hours",value:1},concentration:false,applied_at:instant,expires_at:expiresAt };
}

describe("durable hit-die service-internal request and snapshot", () => {
  it("stays disabled by default even with an invalid snapshot and supplied die face", () => {
    expect(planDurableHitDie(null, null, {evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:20})).toEqual({status:"disabled"});
  });
  it("retains bigint revision precision and accepts PostgreSQL signed-bigint maximum", () => {
    expect(hitDieRequestSchema.parse(request()).expected_revision).toBe("9007199254740993");
    expect(actionRevisionSchema.parse("9223372036854775807")).toBe("9223372036854775807");
    const exhausted = snapshot(); exhausted.character.revision = "9223372036854775807";
    expect(plan(exhausted)).toEqual({status:"rejected",reason:"invalid_mechanics"});
  });
  it.each(["-1","01","1.5","+1","1e3","","abc","9223372036854775808",9007199254740992])("refuses malformed/out-of-range revision %s", value => {
    expect(actionRevisionSchema.safeParse(value).success).toBe(false);
  });
  it.each(["actor_id","acceptedDieFace","roll","current_hp","max_hp"])("browser request rejects extra authority field %s", field => {
    expect(hitDieRequestSchema.safeParse({...request(),[field]:3}).success).toBe(false);
  });
  it("matches one operation's canonical intent, rejects changed intent or identity", () => {
    const r = request();
    expect(matchesHitDieOperation(r,{...r})).toBe(true);
    for (const change of [{class_slug:"wizard"},{expected_revision:"4"},{character_id:id(99)},{operation_id:id(99)},{dependency_fingerprint:"f".repeat(64)},{contract_version:2}]) {
      expect(matchesHitDieOperation(r,{...r,...change})).toBe(false);
    }
    expect(canonicalHitDieIntent(r)).not.toContain("operation_id");
  });
  it("ignores object key order, preserves significant array order and rejects non-JSON", () => {
    expect(canonicalHitDieJson({b:2,a:{z:1,y:2}})).toBe(canonicalHitDieJson({a:{y:2,z:1},b:2}));
    expect(canonicalHitDieJson(["fighter","wizard"])).not.toBe(canonicalHitDieJson(["wizard","fighter"]));
    expect(() => canonicalHitDieJson({hp:Infinity})).toThrow();
    const s = snapshot();
    expect(hitDieDependencyFingerprint(s)).toBe(hitDieDependencyFingerprint({...s,character:{...s.character,base_stats:{dexterity:10,constitution:14}}}));
  });
  it.each(["missing", "version", "system", "character", "duplicate", "die", "unselected", "unknown_type", "unknown_system"])("rejects unresolved/mismatched pin %s without fallback", kind => {
    const s = snapshot();
    if (kind === "missing") s.pins = [];
    if (kind === "version") s.pins[0].content_version = 2;
    if (kind === "system") s.pins[0].resolved.system_id = id(99);
    if (kind === "character") s.pins[0].character_id = id(99);
    if (kind === "duplicate") s.pins.push({...s.pins[0],id:id(99)});
    if (kind === "die") delete s.pins[0].resolved.data.hit_die;
    if (kind === "unselected") s.pins[0].resolved.slug = "wizard";
    if (kind === "unknown_type") (s.pins[0].resolved as {content_type:string}).content_type = "unknown";
    if (kind === "unknown_system") (s.system as {slug:string}).slug = "daggerheart";
    expect(hitDieSnapshotSchema.safeParse(s).success).toBe(false);
    expect(planDurableHitDie(s,request(),{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"invalid_snapshot"});
  });
  it("refuses unknown request class, duplicate class choices and unresolved state/history", () => {
    const s = snapshot();
    expect(planDurableHitDie(s,{...request(s),class_slug:"wizard"},{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"invalid_mechanics"});
    for (const mutate of [
      (value:HitDieSnapshot) => {delete value.character.state.current_hp;},
      (value:HitDieSnapshot) => {delete value.character.state.hit_dice_spent;},
      (value:HitDieSnapshot) => {value.character.state.hit_dice_spent = {};},
      (value:HitDieSnapshot) => {delete value.character.base_stats.constitution;},
      (value:HitDieSnapshot) => {value.character.choices.classes.push({...value.character.choices.classes[0]});},
      (value:HitDieSnapshot) => {value.character.choices.hp_rolls = {"fighter-2":{method:"manual",value:11}};},
    ]) { const changed = snapshot(); mutate(changed); expect(hitDieSnapshotSchema.safeParse(changed).success).toBe(false); }
  });
  it("denies stale revisions/fingerprints and foreign character request", () => {
    const s = snapshot(); const r = request(s);
    expect(planDurableHitDie(s,{...r,expected_revision:"2"},{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"stale_snapshot"});
    expect(planDurableHitDie(s,{...r,dependency_fingerprint:"0".repeat(64)},{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"stale_snapshot"});
    expect(planDurableHitDie(s,{...r,character_id:id(99)},{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"identity_changed"});
  });
});

describe("actual evaluator and existing hit-die math parity", () => {
  it("uses the real helpers for baseline max HP, roll breakdown, spend and healing", () => {
    const s = snapshot(); const result = planned(s);
    expect(result.max_hp).toBe(computeMaxHp([{slug:"fighter",level:1}],{fighter:{slug:"fighter",data:{hit_die:10}}},14));
    expect(result.roll).toMatchObject({groups:[{sides:10,rolls:[3],kept:[3]}],modifier:2,total:5,rolled_at:instant});
    expect(result.patch).toEqual(spendHitDiePatch(s.character.state,"fighter",5,12));
    expect(hitDiePlanResultSchema.safeParse(result).success).toBe(true);
    expect(hitDiePlanResultSchema.safeParse({...result,roll:{...result.roll,total:99}}).success).toBe(false);
  });
  it("preserves baseline max HP vs active-effect Constitution and ignores campaign HP override", () => {
    const s = snapshot(); s.character.level = 2; s.character.choices.classes[0].level = 2;
    s.character.state.active_effects = [activeEffect()]; s.character.campaign_id = id(30); s.campaign = {id:id(30),hp_rule:"max_for_all"};
    const result = planned(s);
    expect(result).toMatchObject({baseline_constitution:14,live_constitution:18,max_hp:20,roll:{modifier:4,total:7}});
    s.system.schema_definition.hp_rule = "max_for_all";
    expect(planned(s).max_hp).toBe(24);
  });
  it("uses equipment-derived conditions for live CON without changing baseline max HP", () => {
    const s = snapshot();
    s.pins[0].resolved.effects = [{type:"mechanical",stat:"constitution",op:"add",value:4,condition:{field:"shield_equipped",op:"eq",value:true}}];
    s.inventory = [{id:id(22),character_id:id(1),content_id:null,content_version:null,content_type:"armor",equipped:true,attuned:false,quantity:1,sort_order:0,custom_data:{armor_category:"Shield",armor_class:{base:2,dex_bonus:false}},resolved:null}];
    expect(planned(s)).toMatchObject({baseline_constitution:14,live_constitution:18,max_hp:12,roll:{modifier:4}});
  });
  it("preserves class array primary-class order and tied effect source order", () => {
    const s = snapshot(); s.character.level = 2; s.character.choices.classes.push({slug:"wizard",level:1});
    s.character.state.hit_dice_spent = {fighter:0,wizard:0};
    s.pins.push({...s.pins[0],id:id(10),content_id:id(11),resolved:{...s.pins[0].resolved,id:id(11),slug:"wizard",name:"Wizard",data:{...s.pins[0].resolved.data,hit_die:6}}});
    expect(planned(s).max_hp).toBe(18);
    const fingerprint = hitDieDependencyFingerprint(s); s.character.choices.classes.reverse();
    expect(planned(s).max_hp).toBe(16); expect(hitDieDependencyFingerprint(s)).not.toBe(fingerprint);
    const ordered = snapshot(); ordered.pins[0].resolved.effects = [{type:"mechanical",stat:"constitution",op:"set",value:12},{type:"mechanical",stat:"constitution",op:"set",value:18}];
    const effectFingerprint = hitDieDependencyFingerprint(ordered);
    expect(planned(ordered).baseline_constitution).toBe(18); ordered.pins[0].resolved.effects.reverse();
    expect(planned(ordered).baseline_constitution).toBe(12); expect(hitDieDependencyFingerprint(ordered)).not.toBe(effectFingerprint);
  });
  it("floors negative healing but spends a die, caps healing, and resets death saves only above zero", () => {
    const negative = snapshot(); negative.character.base_stats.constitution = 4; negative.character.state.current_hp = 0; negative.character.state.death_saves = {successes:1,failures:2};
    expect(planned(negative,1).patch).toEqual({current_hp:0,hit_dice_spent:{fighter:1}});
    expect(planned(negative,5).patch).toEqual({current_hp:2,hit_dice_spent:{fighter:1},death_saves:{successes:0,failures:0}});
    const cap = snapshot(); cap.character.state.current_hp = 11;
    expect(planned(cap,10).patch.current_hp).toBe(12);
  });
  it("refuses full/over-max HP, spent dice, archived character and invalid trusted faces", () => {
    const s = snapshot(); s.character.state.current_hp = 12; expect(plan(s)).toEqual({status:"rejected",reason:"full_hp"});
    s.character.state.current_hp = 13; expect(plan(s)).toEqual({status:"rejected",reason:"invalid_mechanics"});
    s.character.state.current_hp = 4; s.character.state.hit_dice_spent = {fighter:5}; expect(plan(s)).toEqual({status:"rejected",reason:"no_dice"});
    s.character.state.hit_dice_spent = {fighter:0}; s.character.archived = true; expect(plan(s)).toEqual({status:"rejected",reason:"unavailable"});
    for (const face of [0,11,1.5,NaN,Infinity]) expect(plan(snapshot(),face)).toEqual({status:"rejected",reason:"invalid_mechanics"});
  });
  it("refuses unresolved rolled-only HP history instead of averaging an unmade roll", () => {
    const s = snapshot(); s.character.level = 2; s.character.choices.classes[0].level = 2; s.system.schema_definition.hp_rule = "rolled_only";
    expect(plan(s)).toEqual({status:"rejected",reason:"invalid_mechanics"});
    s.character.choices.hp_rolls = {"fighter-2":{method:"rolled",value:7}};
    expect(planned(s).max_hp).toBe(21);
  });
  it("binds active effects to injected evaluation/acceptance instants, with equality expired", () => {
    const s = snapshot(); s.character.state.active_effects = [activeEffect("2026-10-12T01:00:01.000Z")];
    const before = plan(s,3,instant,"2026-10-12T01:00:00.999Z");
    expect(before).toMatchObject({status:"planned",live_constitution:18,valid_until:"2026-10-12T01:00:01.000Z"});
    expect(plan(s,3,instant,"2026-10-12T01:00:01.000Z")).toEqual({status:"rejected",reason:"expired_plan"});
    expect(plan(s,3,instant,"2026-10-12T01:00:01.001Z")).toEqual({status:"rejected",reason:"expired_plan"});
    expect(plan(s,3,"2026-10-12T01:00:01.000Z","2026-10-12T01:00:01.000Z")).toMatchObject({status:"planned",live_constitution:14,valid_until:null});
    expect(plan(s,3,instant,"2026-10-12T00:59:59.999Z")).toEqual({status:"rejected",reason:"invalid_mechanics"});
  });
  it("does not mutate the resolved snapshot or consume ambient RNG", () => {
    const s = snapshot(); const original = JSON.stringify(s); const random = vi.spyOn(Math,"random").mockImplementation(() => { throw new Error("Ambient RNG used"); });
    try { planned(s); expect(JSON.stringify(s)).toBe(original); } finally { random.mockRestore(); }
  });
});
