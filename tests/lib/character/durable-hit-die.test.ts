import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canonicalHitDieJson, canonicalHitDieIntent, hitDieDependencyFingerprint, matchesHitDieOperation, planDurableHitDie } from "@/lib/character/durable-hit-die";
import { actionRevisionSchema, hitDieRequestSchema, hitDieSnapshotSchema, hitDiePlanResultSchema, type HitDieSnapshot } from "@/lib/character/durable-hit-die-schema";
import { computeMaxHp } from "@/lib/character/max-hp";
import { spendHitDiePatch } from "@/lib/hit-dice/helpers";
import { syntheticRacePin } from "../../fixtures/r06-race-parity";
import { draconicLevels, draconicResilienceSource, draconicRoot } from "../../fixtures/subclass-hit-points";
import { subclassResilienceMechanics } from "@/scripts/transformers/classes";
import { ancestryHpFixture } from "../../fixtures/ancestry-hit-points";

const id = (last: number) => `11111111-1111-4111-8111-${String(last).padStart(12, "0")}`;
const instant = "2026-10-12T01:00:00.000Z";
function snapshot(): HitDieSnapshot {
  return {
    contract_version: 1,
    character: { id: id(1), owner_id: id(2), system_id: id(3), campaign_id: null, archived: false,
      revision: "9007199254740993", level: 1, base_stats: { strength: 10, constitution: 14, dexterity: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      choices: { classes: [{ slug: "fighter", level: 1 }], hp_rolls: {} }, state: { current_hp: 4, hit_dice_spent: { fighter: 0 } } },
    system: { id: id(3), slug: "dnd-5e-2014", expression_context: {}, schema_definition: {
      ability_scores: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map(slug => ({ slug, name: slug, abbr: slug.slice(0, 3) })), proficiency_levels: [{slug:"none",name:"None",multiplier:0}],
      derived_stats: [{slug:"armor_class",name:"Armor Class",base:10}], skills: [], resources: [], currencies: [],
      content_types: [{slug:"class",name:"Class"}], creation_steps: [{step:1,type:"class",label:"Class"}], sheet_sections: [{slug:"stats",label:"Stats"}],
    } }, campaign: null,
    pins: [{ id:id(4),character_id:id(1),content_id:id(5),content_version:1,feature_grant_id:null,context:{},choice_source:null,
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
function selectedSnapshot(): HitDieSnapshot {
  const s = snapshot();
  s.character.choices.race = "elf";
  s.character.choices.subrace = "wood-elf";
  s.character.choices.classes[0].subclass = "lantern-vanguard";
  s.character.choices.background = "gatekeeper";
  const selections: Array<{type:"race"|"subrace"|"subclass"|"background";slug:string;data:HitDieSnapshot['pins'][number]['resolved']['data']}> = [
    {type:"race",slug:"elf",data:{size:"Medium",speed:30,scores:[0,0,2,0,0,0],source_refs:[]}},
    {type:"subrace",slug:"wood-elf",data:{parent_race:"elf"}},
    {type:"subclass",slug:"lantern-vanguard",data:{parent_class:"fighter",levels:[{level:1,features:[]}]}},
    {type:"background",slug:"gatekeeper",data:{feature:{name:"Gate watch",description:"The lantern keepers know you."}}},
  ];
  selections.forEach((selection,index) => {
    s.pins.push({id:id(40+index),character_id:s.character.id,content_id:id(50+index),content_version:3,feature_grant_id:null,
      context:{source:selection.type,...(selection.type === "subclass" ? {class:"fighter"} : {})},
      choice_source:selection.type === "background" ? "choice:background" : null,
      resolved:{id:id(50+index),version:3,system_id:s.system.id,content_type:selection.type,slug:selection.slug,
        name:selection.slug,data:selection.data,effects:[{type:"mechanical",stat:"constitution",op:"add",value:1}],
        source:"homebrew",scope:"shared",owner_id:id(99)} });
  });
  return s;
}

function resilienceSnapshot(): HitDieSnapshot {
  const s = snapshot(), pin = s.pins[0];
  s.character.level = 3; s.character.base_stats.constitution = 15; s.character.base_stats.dexterity = 14;
  s.character.choices.classes = [{ slug: "sorcerer", subclass: "draconic", level: 3, occurrence_id: id(80) }];
  s.character.choices.hp_rolls = { "sorcerer-2": { method: "average", value: 4 }, "sorcerer-3": { method: "average", value: 4 } };
  s.character.state.hit_dice_spent = { sorcerer: 0 };
  pin.context = { source: "class", level: 1 }; pin.resolved.slug = "sorcerer"; pin.resolved.name = "Sorcerer"; pin.resolved.data.hit_die = 6;
  (pin.resolved.data.levels as Array<{ level: number; subclass_level?: boolean }>)[0].subclass_level = true;
  pin.class_role = { action_revision: s.character.revision, occurrence_id: id(80), controller_ref_id: pin.id,
    content_id: pin.content_id, content_version: pin.content_version, role: "original", raw_data: structuredClone(pin.resolved.data),
    evaluation_data: structuredClone(pin.resolved.data), raw_effects: [], evaluation_effects: [] };
  const mechanics = subclassResilienceMechanics(draconicRoot, draconicLevels, draconicResilienceSource);
  s.pins.push({ id: id(81), character_id: s.character.id, content_id: id(82), content_version: 2, feature_grant_id: null,
    context: { source: "subclass", class: "sorcerer" }, choice_source: `builder:subclass:${id(80)}`,
    resolved: { ...pin.resolved, id: id(82), version: 2, content_type: "subclass", slug: "draconic", name: "Draconic",
      data: { parent_class: "sorcerer", levels: draconicLevels, hit_points_bonus_per_class_level: 1 },
      effects: mechanics.effects as unknown as HitDieSnapshot["pins"][number]["resolved"]["effects"] } });
  return s;
}

function ancestrySnapshot(): HitDieSnapshot {
  const s = snapshot(), f = ancestryHpFixture();
  s.character.id = f.character.id; s.character.system_id = f.character.system_id; s.system.id = f.character.system_id;
  s.character.level = f.character.level; s.character.revision = f.character.action_revision;
  s.character.base_stats = f.character.base_stats;
  s.character.choices = hitDieSnapshotSchema.shape.character.shape.choices.parse(f.character.choices);
  s.character.state.hit_dice_spent = { barbarian: 0 };
  s.pins = hitDieSnapshotSchema.shape.pins.parse(f.refs.map(ref => ({ id: ref.id, character_id: ref.character_id, content_id: ref.content_id,
    content_version: ref.content_version, context: ref.context, choice_source: ref.choice_source,
    feature_grant_id: ref.feature_grant_id, resolved: ref.content_definitions, ...(ref.class_role ? { class_role: ref.class_role } : {}),
  })));
  return s;
}

describe("durable hit-die service-internal request and snapshot", () => {
  it("keeps frozen ancestry HP38 separate from live Constitution and does not repair stored HP", () => {
    const s = ancestrySnapshot(); s.character.state.active_effects = [activeEffect()];
    const before = JSON.stringify(s), candidate = () => planDurableHitDie(s, { ...request(s), class_slug: "barbarian" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    });
    expect(candidate()).toMatchObject({ status: "planned", baseline_constitution: 16, live_constitution: 20,
      max_hp: 38, roll: { modifier: 5, total: 8 }, patch: { current_hp: 12 } });
    expect(JSON.stringify(s)).toBe(before);
    s.character.state.current_hp = 39;
    expect(candidate()).toEqual({ status: "rejected", reason: "invalid_mechanics" });
    expect(s.character.state.current_hp).toBe(39);
  });
  it("fingerprints raw ancestry metadata and rejects malformed or unproved positive roots", () => {
    const s = ancestrySnapshot(), req = { ...request(s), class_slug: "barbarian" };
    const old = structuredClone(s); delete old.pins[2].resolved.data.hit_points_bonus_per_character_level;
    expect(hitDieDependencyFingerprint(old)).not.toBe(req.dependency_fingerprint);
    expect(planDurableHitDie(old, { ...request(old), class_slug: "barbarian" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    })).toMatchObject({ status: "planned", max_hp: 35 });
    delete s.pins[0].class_role;
    expect(planDurableHitDie(s, { ...request(s), class_slug: "barbarian" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    })).toEqual({ status: "rejected", reason: "invalid_mechanics" });
    s.pins[2].resolved.data.hit_points_bonus_per_character_level = null;
    expect(planDurableHitDie(s, req, { enabled: true, evaluationInstant: instant,
      acceptanceInstant: instant, acceptedDieFace: 3 })).toEqual({ status: "rejected", reason: "invalid_snapshot" });
  });
  it("uses the proved original after ancestry-only multiclass reordering", () => {
    const s = ancestrySnapshot(), secondary = structuredClone(s.pins[0]);
    secondary.id = id(160); secondary.content_id = id(161); secondary.resolved.id = id(161);
    secondary.resolved.slug = "sorcerer"; secondary.resolved.name = "Sorcerer"; secondary.resolved.data.hit_die = 6;
    secondary.class_role = { ...secondary.class_role!, controller_ref_id: secondary.id, content_id: secondary.content_id,
      occurrence_id: id(162), role: "secondary", raw_data: structuredClone(secondary.resolved.data),
      evaluation_data: structuredClone(secondary.resolved.data) };
    s.pins.unshift(secondary); s.character.level = 5;
    s.character.choices.classes.unshift({ slug: "sorcerer", level: 2, occurrence_id: id(162) });
    s.character.state.hit_dice_spent = { barbarian: 0, sorcerer: 0 };
    const candidate = () => planDurableHitDie(s, { ...request(s), class_slug: "barbarian" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    });
    expect(candidate()).toMatchObject({ status: "planned", max_hp: 54 });
    secondary.class_role.role = "original";
    expect(candidate()).toEqual({ status: "rejected", reason: "invalid_mechanics" });
  });
  it("adds ancestry and subclass bonuses independently on the same frozen character", () => {
    const s = resilienceSnapshot(), f = ancestryHpFixture();
    for (const source of [f.raceRef, f.subraceRef]) s.pins.push(hitDieSnapshotSchema.shape.pins.element.parse({
      id: source.id, character_id: s.character.id, content_id: source.content_id, content_version: source.content_version,
      feature_grant_id: null, context: source.context, choice_source: null,
      resolved: { ...source.content_definitions, system_id: s.system.id },
    }));
    s.character.choices.race = "dwarf"; s.character.choices.subrace = "hill-dwarf";
    // Base CON13 + Dwarf2 =15; Draconic3 + ancestry3 add after the d6 base20.
    s.character.base_stats.constitution = 13;
    const result = planDurableHitDie(s, { ...request(s), class_slug: "sorcerer" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    });
    expect(result).toMatchObject({ status: "planned", baseline_constitution: 15, max_hp: 26 });
  });
  it("plans the same frozen root bonus with baseline CON while live CON modifies only recovery", () => {
    const s = resilienceSnapshot(); s.character.state.active_effects = [activeEffect()];
    const req = { ...request(s), class_slug: "sorcerer" }, before = JSON.stringify(s);
    const result = planDurableHitDie(s, req, { enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3 });
    expect(result).toMatchObject({ status: "planned", baseline_constitution: 15, live_constitution: 19, max_hp: 23 });
    if (result.status !== "planned") throw Error("Expected a service-internal candidate");
    expect(result.roll.modifier).toBe(4);
    expect(JSON.stringify(s)).toBe(before);
    expect(planDurableHitDie(s, req, { evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3 })).toEqual({ status: "disabled" });
  });
  it("retains occurrence and role evidence in the fingerprint and rejects an unsupported positive root", () => {
    const s = resilienceSnapshot(), req = { ...request(s), class_slug: "sorcerer" };
    expect(hitDieSnapshotSchema.parse(s).character.choices.classes[0].occurrence_id).toBe(id(80));
    const changed = structuredClone(s); delete changed.pins[0].class_role;
    expect(hitDieDependencyFingerprint(changed)).not.toBe(req.dependency_fingerprint);
    expect(planDurableHitDie(changed, { ...request(changed), class_slug: "sorcerer" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    })).toEqual({ status: "rejected", reason: "invalid_mechanics" });
    const malformed = structuredClone(s); malformed.pins[0].class_role!.raw_data.bad = () => 1;
    expect(planDurableHitDie(malformed, req, { enabled: true, evaluationInstant: instant, acceptanceInstant: instant,
      acceptedDieFace: 3 })).toEqual({ status: "rejected", reason: "invalid_snapshot" });
  });
  it("keeps the proved original maximum after multiclass reordering and rejects two original roles", () => {
    const s = resilienceSnapshot(), secondary = structuredClone(s.pins[0]);
    secondary.id = id(92); secondary.content_id = id(93); secondary.resolved.id = id(93);
    secondary.resolved.slug = "fighter"; secondary.resolved.name = "Fighter"; secondary.resolved.data.hit_die = 10;
    secondary.class_role = { ...secondary.class_role!, occurrence_id: id(94), controller_ref_id: secondary.id,
      content_id: secondary.content_id, role: "secondary", raw_data: structuredClone(secondary.resolved.data),
      evaluation_data: structuredClone(secondary.resolved.data) };
    s.pins.push(secondary); s.character.level = 5; s.character.state.hit_dice_spent = { fighter: 0, sorcerer: 0 };
    s.character.choices.classes.unshift({ slug: "fighter", level: 2, occurrence_id: id(94) });
    const candidate = () => planDurableHitDie(s, { ...request(s), class_slug: "sorcerer" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    });
    expect(candidate()).toMatchObject({ status: "planned", max_hp: 39 });
    s.system.schema_definition.hp_rule = "rolled_only";
    s.character.choices.hp_rolls["fighter-1"] = { method: "rolled", value: 6 };
    s.character.choices.hp_rolls["fighter-2"] = { method: "rolled", value: 6 };
    s.character.choices.hp_rolls["sorcerer-2"] = { method: "rolled", value: 4 };
    s.character.choices.hp_rolls["sorcerer-3"] = { method: "rolled", value: 4 };
    expect(candidate()).toMatchObject({ status: "planned", max_hp: 39 });
    secondary.class_role.role = "original";
    expect(candidate()).toEqual({ status: "rejected", reason: "invalid_mechanics" });
  });
  it("resolves saved ability choices before baseline HP with the same choice projection used by the sheet", () => {
    const s = resilienceSnapshot();
    s.character.choices.resolved_choices = { "saved-constitution-choice": ["constitution"] };
    s.pins.push({ id: id(90), character_id: s.character.id, content_id: id(91), content_version: 1, feature_grant_id: null,
      context: { source: "feature" }, choice_source: null,
      resolved: { ...s.pins[0].resolved, id: id(91), version: 1, content_type: "feature", slug: "saved-constitution-choice", name: "Saved ability choice",
        data: { class: "sorcerer", level: 1, feature_type: "choice", description: "A finite saved ability choice." }, effects: [
          { type: "choice", choice_id: "saved-constitution-choice", choose: 1, from: ["constitution"], grant_type: "ability_bonus" },
        ] } });
    const result = planDurableHitDie(s, { ...request(s), class_slug: "sorcerer" }, {
      enabled: true, evaluationInstant: instant, acceptanceInstant: instant, acceptedDieFace: 3,
    });
    expect(result).toMatchObject({ status: "planned", baseline_constitution: 16, live_constitution: 16, max_hp: 26 });
  });
  it.each(["imported", "declared-effects", "declared-scores", "dual"] as const)("uses %s race representation for baseline HP and separate live CON", mode => {
    const s = snapshot();
    s.character.base_stats.constitution = 12;
    const { pin } = syntheticRacePin(mode);
    s.character.choices.race = pin.slug;
    s.pins.push({ id: id(70), character_id: s.character.id, content_id: id(71), content_version: pin.version,
      feature_grant_id: null, context: { source: "race" }, choice_source: null,
      resolved: { ...pin, id: id(71), system_id: s.system.id } as unknown as HitDieSnapshot['pins'][number]['resolved'],
    });
    s.character.state.active_effects = [activeEffect()];
    const before = JSON.stringify(s);
    const once = mode === "imported" || mode === "declared-effects";
    expect(planned(s)).toMatchObject({ baseline_constitution: once ? 14 : 16,
      live_constitution: once ? 18 : 20, max_hp: once ? 12 : 13 });
    expect(JSON.stringify(s)).toBe(before);
    if (pin.data.scores !== undefined) {
      const reinterpreted = structuredClone(s);
      reinterpreted.pins[1].resolved.data.ability_score_representation = { version: 1, mode: once ? "scores" : "effects" };
      expect(planDurableHitDie(reinterpreted, request(s), { enabled: true, evaluationInstant: instant,
        acceptanceInstant: instant, acceptedDieFace: 3 })).toEqual({ status: "rejected", reason: "stale_snapshot" });
    }
    const changed = structuredClone(s);
    changed.pins[1].resolved.data.ability_score_representation = { version: 2, mode: "effects" };
    expect(planDurableHitDie(changed, request(s), { enabled: true, evaluationInstant: instant,
      acceptanceInstant: instant, acceptedDieFace: 3 })).toEqual({ status: "rejected", reason: "invalid_snapshot" });
  });
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
    expect(hitDieDependencyFingerprint(s)).toBe(hitDieDependencyFingerprint({...s,character:{...s.character,base_stats:{charisma:10,wisdom:10,intelligence:10,dexterity:10,constitution:14,strength:10}}}));
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
  it("keeps uniquely selected historical race/subrace/subclass/background mechanics", () => {
    const s = selectedSnapshot();
    // No current share/access row: this model checks pinned identity, not new-use
    // visibility. The future resolver still owns authorized historical continuity.
    expect(hitDieSnapshotSchema.safeParse(s).success).toBe(true);
    expect(planned(s)).toMatchObject({baseline_constitution:20,live_constitution:20,max_hp:15,roll:{modifier:5,total:8},patch:{current_hp:12}});
  });
  it.each(["race","subrace","subclass","background"] as const)("refuses omitted selected %s pin", type => {
    const s = selectedSnapshot(); const r = request(s);
    s.pins = s.pins.filter(pin => pin.resolved.content_type !== type);
    expect(hitDieSnapshotSchema.safeParse(s).success).toBe(false);
    expect(planDurableHitDie(s,r,{enabled:true,evaluationInstant:instant,acceptanceInstant:instant,acceptedDieFace:3})).toEqual({status:"rejected",reason:"invalid_snapshot"});
  });
  it.each(["race","subrace","subclass","background"] as const)("refuses mismatched, duplicate, or unselected %s pins", type => {
    for (const mutation of ["slug","type","system","version","duplicate","unselected"]) {
      const s = selectedSnapshot(); const pin = s.pins.find(candidate => candidate.resolved.content_type === type)!;
      if (mutation === "slug") pin.resolved.slug = "other-selection";
      if (mutation === "type") pin.resolved.content_type = "trait";
      if (mutation === "system") pin.resolved.system_id = id(98);
      if (mutation === "version") pin.content_version = 4;
      if (mutation === "duplicate") s.pins.push({...pin,id:id(98)});
      if (mutation === "unselected") {
        if (type === "subclass") delete s.character.choices.classes[0].subclass;
        else delete s.character.choices[type];
      }
      expect(hitDieSnapshotSchema.safeParse(s).success,`${type}/${mutation}`).toBe(false);
    }
  });
  it("rejects selected subrace without race and wrong selected parent relationships", () => {
    const orphan = selectedSnapshot(); delete orphan.character.choices.race;
    orphan.pins = orphan.pins.filter(pin => pin.resolved.content_type !== "race");
    expect(hitDieSnapshotSchema.safeParse(orphan).success).toBe(false);
    for (const type of ["subrace","subclass"] as const) {
      const s = selectedSnapshot(); const pin = s.pins.find(candidate => candidate.resolved.content_type === type)!;
      pin.resolved.data[type === "subrace" ? "parent_race" : "parent_class"] = "other-parent";
      expect(hitDieSnapshotSchema.safeParse(s).success).toBe(false);
    }
  });
  it("accepts optional selections when absent only if their selection pins are absent", () => {
    expect(hitDieSnapshotSchema.safeParse(snapshot()).success).toBe(true);
    for (const type of ["race","subrace","subclass","background"] as const) {
      const s = snapshot(); s.pins.push(selectedSnapshot().pins.find(pin => pin.resolved.content_type === type)!);
      expect(hitDieSnapshotSchema.safeParse(s).success).toBe(false);
    }
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
  it("validates exact canonical intent against the unchanged request", () => {
    const result = planned();
    expect(hitDiePlanResultSchema.safeParse(result).success).toBe(true);
    const intent = JSON.parse(result.canonical_intent);
    for (const changed of [{class_slug:"wizard"},{expected_revision:"0"},{character_id:id(98)},{dependency_fingerprint:"f".repeat(64)},{command:"other"},{contract_version:2},{canonical_version:2}]) {
      const canonical_intent = canonicalHitDieJson({...intent,...changed});
      expect(hitDiePlanResultSchema.safeParse({...result,canonical_intent}).success).toBe(false);
    }
    for (const canonical_intent of ["arbitrary","{}",` ${result.canonical_intent}`,JSON.stringify({...intent,operation_id:id(98)})]) {
      expect(hitDiePlanResultSchema.safeParse({...result,canonical_intent}).success).toBe(false);
    }
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
