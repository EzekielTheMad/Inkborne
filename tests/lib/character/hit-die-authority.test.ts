import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { allHitDieWritersReady, HIT_DIE_WRITER_FAMILIES, hitDieGraphOrderSchema, hitDieGraphResponseSchema, inspirationPatchSchema,
  readHitDieAuthorityGraph, saveInspirationAtRevision, verifiedHitDieContextSchema } from "@/lib/character/hit-die-authority";
import { validateHitDieGraph } from "@/lib/character/hit-die-authority";
import { authorityGraphFixture, earnedAsiGraphFixture, frozenSpellGraphFixture, rebuildAuthorityGraph, authorityContext, authorityId, controllerCreatedAt } from "../../fixtures/hit-die-authority";
import { canonicalHitDieJson } from "@/lib/character/durable-hit-die-canonical";
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12,"0")}`;
const context = { context_version: 1, actor_id: id(1), session_id: id(2), jwt_expires_at: "2026-10-12T23:59:59.000000Z" };
const revision = "9007199254740993";
function graphFixture() {
  const definition={id:id(5),version:1,system_id:id(4),content_type:"class",slug:"fighter",name:"Fighter",source:"srd",scope:"platform",owner_id:null,effects:[],
    data:{hit_die:10,spellcasting:null,multiclass:{prerequisites:[],proficiencies_gained:[]},saving_throws:[],starting_proficiencies:[],levels:Array.from({length:20},(_,i)=>({level:i+1,features:[],spellcasting:null})),source_refs:[]}};
  return { status:"complete",graph_version:2,readiness:{protocol_version:1,writers_complete:true,auth_complete:true,order_complete:true},
    counts:{pins:"1",inventory:"0",spells:"0",feature_grants:"0",spell_grants:"0",resolved_versions:"1",access_rows:"3"},
    order:{producer_version:1,character_id:id(3),producer_revision:revision,pins:[id(6)],inventory:[],spells:[],feature_grants:[],spell_grants:[]},versions:[definition],
    version_times:[{content_id:id(5),content_version:1,created_at:controllerCreatedAt}],
    snapshot:{contract_version:1,character:{id:id(3),owner_id:id(1),system_id:id(4),campaign_id:null,archived:false,revision,level:1,base_stats:{constitution:14},
      choices:{classes:[{slug:"fighter",level:1}],hp_rolls:{}},state:{current_hp:4,hit_dice_spent:{fighter:0}}},
      system:{id:id(4),slug:"dnd-5e-2014",expression_context:{},schema_definition:{ability_scores:[{slug:"constitution",name:"Constitution",abbr:"CON"}],proficiency_levels:[{slug:"none",name:"None",multiplier:0}],derived_stats:[],skills:[],resources:[],currencies:[],content_types:[{slug:"class",name:"Class"}],creation_steps:[{step:1,type:"class",label:"Class"}],sheet_sections:[{slug:"stats",label:"Stats"}]}},campaign:null,
      pins:[{id:id(6),character_id:id(3),content_id:id(5),content_version:1,context:{},choice_source:null,feature_grant_id:null,resolved:definition}],inventory:[],spells:[],feature_grants:[],spell_grants:[],
      access_rows:[{kind:"verified_session",actor_id:id(1),session_id:id(2),jwt_expires_at:context.jwt_expires_at},{kind:"current_owner",character_id:id(3),owner_id:id(1),system_id:id(4),campaign_id:null,archived:false},
        {kind:"pinned_continuity",domain:"pin",row_id:id(6),content_id:id(5),content_version:1}]}};
}
describe("service-internal authority contracts; no provider/database execution", () => {
  it("requires all thirteen reviewed readiness families, never absent/empty success", () => {
    const ready = HIT_DIE_WRITER_FAMILIES.map(family => ({ family, protocol_version: 1, ready: true, reviewed_objects: { evidence: "fixture-only" } }));
    expect(allHitDieWritersReady(ready)).toBe(true);
    for (const bad of [[], ready.slice(1), [...ready,ready[0]], ready.map(row => ({ ...row, ready: false })), ready.map(row => ({ ...row, reviewed_objects: {} }))]) expect(allHitDieWritersReady(bad)).toBe(false);
  });
  it.each(["actor_id","session_id","jwt_expires_at"])("requires correlated context field %s", key => {
    const copy = { ...context } as Record<string,unknown>; delete copy[key]; expect(verifiedHitDieContextSchema.safeParse(copy).success).toBe(false);
  });
  it.each(["2026-02-30T00:00:00.000000Z","2026-10-12T01:00:00.000Z","2026-10-12T01:00:00.000000+00:00","infinity"])("rejects unsupported native expiry %s", jwt_expires_at => expect(verifiedHitDieContextSchema.safeParse({ ...context,jwt_expires_at }).success).toBe(false));
  it("accepts precision-6 native context shape but never authenticates it by parsing", () => {
    expect(verifiedHitDieContextSchema.safeParse(context).success).toBe(true);
    expect(verifiedHitDieContextSchema.safeParse({ ...context, verified: true }).success).toBe(false);
  });
  it("requires complete order domains and revision text without sort synthesis", () => {
    const order = { producer_version: 1, character_id: id(1), producer_revision: revision, pins:[id(9),id(3)],inventory:[],spells:[],feature_grants:[],spell_grants:[] };
    expect(hitDieGraphOrderSchema.parse(order).pins).toEqual([id(9),id(3)]);
    const incomplete = { ...order } as Record<string,unknown>; delete incomplete.feature_grants; expect(hitDieGraphOrderSchema.safeParse(incomplete).success).toBe(false);
  });
  it("does not accept a complete label without graph/counts/version/order/schema proof", () => {
    expect(hitDieGraphResponseSchema.safeParse({ status:"complete", graph_version:1, snapshot:{} }).success).toBe(false);
    expect(hitDieGraphResponseSchema.safeParse({ status:"unready",reason:"auth_unavailable",rows:[] }).success).toBe(false);
  });
  it("accepts the complete v2 received fixture only through actual ASI and frozen-spell validators", async () => {
    const graph = graphFixture(), before = canonicalHitDieJson(graph.snapshot);
    const rpc = vi.fn().mockResolvedValue({data: graph,error: null});
    expect(await readHitDieAuthorityGraph({rpc}, context, id(3))).toEqual(graph);
    expect(canonicalHitDieJson(graph.snapshot)).toBe(before);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_hit_die_graph_v1",{p_verified_context:context,p_character_id:id(3)});
  });
  it("retains explicit schema-unready for v1 rather than accepting absence of version time", () => {
    const { version_times, ...legacy } = graphFixture();
    expect(version_times).toHaveLength(1);
    expect(validateHitDieGraph({...legacy,graph_version:1},context,id(3))).toEqual({status:"unready",reason:"schema_unready"});
  });
  it.each(["version","resolved"])("rejects custom spell forged %s even before unavailable earned authority", fault=>{
    const graph=graphFixture(); const spell={id:id(9),character_id:id(3),content_id:null,content_version:fault==="version"?1:null,spell_grant_id:null,name:"Custom",class_slug:"fighter",is_known:true,is_prepared:false,always_prepared:false,in_spellbook:false,source:"selection",custom_data:null,created_at:"2026-10-12T01:00:00.000000Z",resolved:fault==="resolved"?graph.versions[0]:null};
    const forged={...graph,counts:{...graph.counts,spells:"1"},order:{...graph.order,spells:[id(9)]},snapshot:{...graph.snapshot,spells:[spell]}};
    expect(validateHitDieGraph(forged,context,id(3))).toEqual({status:"unready",reason:"invalid_graph"});
  });
  it.each(["raw_count","missing_row","wrong_order","missing_version","missing_grant_count"])("rejects actual incomplete graph %s before schema readiness", fault=>{
    const graph=graphFixture();
    if(fault==="raw_count") graph.counts.pins="2";
    if(fault==="missing_row") graph.snapshot.pins=[];
    if(fault==="wrong_order") graph.order.pins=[id(99)];
    if(fault==="missing_version") graph.versions=[];
    if(fault==="missing_grant_count") graph.counts.feature_grants="1";
    expect(validateHitDieGraph(graph,context,id(3))).toEqual({status:"unready",reason:fault==="missing_row"?"invalid_graph":"incomplete_graph"});
  });
  it("refuses duplicate versions and a wrong verified session instead of blessing the graph label",()=>{
    const graph=graphFixture(); graph.versions.push(structuredClone(graph.versions[0])); expect(validateHitDieGraph(graph,context,id(3))).toEqual({status:"unready",reason:"invalid_graph"});
    expect(validateHitDieGraph(graphFixture(),{...context,session_id:id(99)},id(3))).toEqual({status:"unready",reason:"invalid_graph"});
  });
  it.each([{}, { inspiration:1 }, { inspiration:true,current_hp:5 }, { state:{ inspiration:true } }, { inspiration:true,revision:"4" }])("refuses unsafe inspiration patch %j", patch => expect(inspirationPatchSchema.safeParse(patch).success).toBe(false));
  it("preserves unavailable production Auth response instead of turning it into an empty complete graph", async () => {
    const rpc = vi.fn().mockResolvedValue({ data:{ status:"unready",reason:"auth_unavailable" },error:null });
    expect(await readHitDieAuthorityGraph({rpc},context,id(3))).toEqual({ status:"unready",reason:"auth_unavailable" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_hit_die_graph_v1",{p_verified_context:context,p_character_id:id(3)});
  });
  it("refuses malformed request authority before any RPC", async () => {
    const rpc = vi.fn();
    expect(await saveInspirationAtRevision({rpc},{ ...context, session_id: "bad" },id(3),revision,{inspiration:true})).toEqual({status:"invalid"});
    expect(await saveInspirationAtRevision({rpc},context,id(3),"9223372036854775807",{inspiration:true})).toEqual({status:"invalid"});
    expect(rpc).not.toHaveBeenCalled();
  });
  it("confirms a correlated applied revision, retains unrelated returned state and never retries", async () => {
    const response = {status:"applied",character_id:id(3),revision:"9007199254740994",state:{inspiration:true,quick_notes:"retain",hit_dice_spent:{fighter:1}}};
    const rpc = vi.fn().mockResolvedValue({data:response,error:null});
    expect(await saveInspirationAtRevision({rpc},context,id(3),revision,{inspiration:true})).toEqual(response); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    {status:"applied",character_id:id(99),revision:"9007199254740994",state:{inspiration:true}},
    {status:"applied",character_id:id(3),revision,state:{inspiration:true}},
    {status:"unchanged",character_id:id(3),revision:"9007199254740994",state:{inspiration:true}},
    {status:"unchanged",character_id:id(3),revision,state:{inspiration:false}},
    {status:"conflict",character_id:id(3),revision,state:{}}, null,
  ])("treats mismatched/malformed save response %j as uncertain", async data => {
    const rpc=vi.fn().mockResolvedValue({data,error:null}); expect(await saveInspirationAtRevision({rpc},context,id(3),revision,{inspiration:true})).toEqual({status:"uncertain"}); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("accepts actual unchanged and current-owner conflict envelopes without blind apply/retry", async () => {
    const unchanged={status:"unchanged",character_id:id(3),revision,state:{inspiration:true}};
    const conflict={status:"conflict",character_id:id(3),revision:"9007199254740994",state:{inspiration:false}};
    const rpc=vi.fn().mockResolvedValueOnce({data:unchanged,error:null}).mockResolvedValueOnce({data:conflict,error:null});
    expect(await saveInspirationAtRevision({rpc},context,id(3),revision,{inspiration:true})).toEqual(unchanged);
    expect(await saveInspirationAtRevision({rpc},context,id(3),revision,{inspiration:true})).toEqual(conflict); expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("preserves rejected/lost save response uncertainty without new operation or SQL fallback", async () => {
    const rpc=vi.fn().mockRejectedValue(new Error("lost")); expect(await saveInspirationAtRevision({rpc},context,id(3),revision,{inspiration:true})).toEqual({status:"uncertain"}); expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("actual received earned-authority binding; no real producer/Auth/database acceptance", () => {
  const received = async (graph: unknown) => readHitDieAuthorityGraph({rpc: vi.fn().mockResolvedValue({data:graph,error:null})},authorityContext,authorityId(3));
  it("accepts a real shared ASI occurrence without adding effects twice or changing raw grant extensions", async () => {
    const graph = earnedAsiGraphFixture(), before = canonicalHitDieJson(graph.snapshot);
    expect(await received(graph)).toEqual(graph);
    expect(canonicalHitDieJson(graph.snapshot)).toBe(before);
    expect(graph.snapshot.pins.every(pin=>pin.resolved.effects.length===0)).toBe(true);
  });
  it.each(["forged-context","extra-context","invalid-allocation","future-choice","ambiguous-occurrence"])("real ASI resolver refuses %s after complete graph/count closure",async fault=>{
    const graph=earnedAsiGraphFixture(), s=graph.snapshot, feature=s.pins[1], grant=s.feature_grants[0];
    if(fault==="forged-context") feature.context.controller_slug="foreign";
    if(fault==="extra-context") feature.context.browser_authority=true;
    if(fault==="invalid-allocation") s.character.choices.asi_choices={[grant.feature_slug]:{mode:"asi",allocations:[{ability:"constitution",amount:1}]}};
    if(fault==="future-choice") s.character.choices.asi_choices={"unearned-future-feature":{mode:"asi",allocations:[{ability:"constitution",amount:2}]}};
    if(fault==="ambiguous-occurrence") {
      s.feature_grants.push({...grant,id:authorityId(18)});
      s.pins.push({...structuredClone(feature),id:authorityId(19),feature_grant_id:authorityId(18),choice_source:`auto:feature-grant:${authorityId(18)}`});
    }
    rebuildAuthorityGraph(graph); const before=canonicalHitDieJson(graph);
    expect(await received(graph)).toEqual({status:"unready",reason:"schema_unready"});
    expect(canonicalHitDieJson(graph)).toBe(before);
  });
  it("accepts exact null-grant feat choice, then refuses a different saved feat version",async()=>{
    const graph=earnedAsiGraphFixture(), s=graph.snapshot, grant=s.feature_grants[0];
    const feat={...s.pins[1].resolved,id:authorityId(20),content_type:"feat" as const,slug:"original-clear-mind",name:"Original clear mind",data:{description:"Original feat choice."}};
    s.character.choices.asi_choices={[grant.feature_slug]:{mode:"feat",featId:feat.id,featVersion:1,featName:feat.name}};
    s.pins.push({id:authorityId(21),character_id:s.character.id,content_id:feat.id,content_version:1,feature_grant_id:null,choice_source:`choice:asi:${grant.id}`,context:{},resolved:feat});
    graph.versions.push(feat); rebuildAuthorityGraph(graph);
    expect(await received(graph)).toEqual(graph);
    s.character.choices.asi_choices={[grant.feature_slug]:{mode:"feat",featId:feat.id,featVersion:2,featName:feat.name}};
    expect(await received(graph)).toEqual({status:"unready",reason:"schema_unready"});
  });
  it("accepts complete raw frozen spell provenance including inactive entries without raw order/extension changes",async()=>{
    const graph=frozenSpellGraphFixture(); graph.snapshot.spell_grants.reverse(); rebuildAuthorityGraph(graph);
    const before=canonicalHitDieJson(graph);
    expect(await received(graph)).toEqual(graph);
    expect(canonicalHitDieJson(graph)).toBe(before);
    expect(graph.snapshot.spell_grants[0].unlock_level).toBe(3);
  });
  it("keeps selected-version acquisition precedence through the received consumer without mutating preparation",async()=>{
    const graph=frozenSpellGraphFixture(), selected={...graph.versions[1],version:2,name:"Original selected v2"};
    graph.versions.push(selected);
    graph.snapshot.spells[0]={...graph.snapshot.spells[0],source:"selection",spell_grant_id:null,content_version:2,name:"Stored selection name",is_prepared:false,always_prepared:false,resolved:selected};
    rebuildAuthorityGraph(graph);const before=canonicalHitDieJson(graph.snapshot);
    expect(await received(graph)).toEqual(graph);
    expect(canonicalHitDieJson(graph.snapshot)).toBe(before);
  });
  it.each(["missing-manifest-entry","wrong-unlock","future-by-microsecond","missing-acquisition","inactive-link","selection-forged-grant","feat-source","item-source"])("received spell closure refuses %s even when raw counts/proofs agree",async fault=>{
    const graph=frozenSpellGraphFixture(), s=graph.snapshot;
    if(fault==="missing-manifest-entry") s.spell_grants.pop();
    if(fault==="wrong-unlock") s.spell_grants[0].unlock_level=2;
    if(fault==="future-by-microsecond") graph.version_times.find(time=>time.content_id===authorityId(7))!.created_at="2026-01-01T00:00:00.000002Z";
    if(fault==="missing-acquisition") s.spells=[];
    if(fault==="inactive-link") { const inactive=s.spell_grants[1]; s.spells[0]={...s.spells[0],content_id:inactive.spell_content_id,content_version:inactive.spell_version,spell_grant_id:inactive.id,name:inactive.spell_name,resolved:graph.versions.find(v=>v.id===inactive.spell_content_id)!}; }
    if(fault==="selection-forged-grant") s.spells[0].source="selection";
    if(fault==="feat-source") {s.spells[0].source="feat";s.spells[0].spell_grant_id=null;}
    if(fault==="item-source") {s.spells[0].source="item";s.spells[0].spell_grant_id=null;}
    rebuildAuthorityGraph(graph);
    expect(await received(graph)).toEqual({status:"unready",reason:"schema_unready"});
  });
  it("rejects absent nullable acquisition ID, missing/extra version-time metadata and unsupported dispatch",async()=>{
    const graph=frozenSpellGraphFixture();
    delete (graph.snapshot.spells[0] as Partial<typeof graph.snapshot.spells[number]>).spell_grant_id;
    expect(await received(graph)).toEqual({status:"unready",reason:"invalid_graph"});
    const missing=frozenSpellGraphFixture();missing.version_times.pop();
    expect(await received(missing)).toEqual({status:"unready",reason:"schema_unready"});
    const extra=frozenSpellGraphFixture();extra.version_times.push({...extra.version_times[0],content_id:authorityId(99)});
    expect(await received(extra)).toEqual({status:"unready",reason:"schema_unready"});
    expect(await received({...authorityGraphFixture(),graph_version:3})).toEqual({status:"unready",reason:"invalid_graph"});
  });
});
