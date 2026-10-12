import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { allHitDieWritersReady, HIT_DIE_WRITER_FAMILIES, hitDieGraphOrderSchema, hitDieGraphResponseSchema, inspirationPatchSchema,
  readHitDieAuthorityGraph, saveInspirationAtRevision, verifiedHitDieContextSchema } from "@/lib/character/hit-die-authority";
import { validateHitDieGraph } from "@/lib/character/hit-die-authority";
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12,"0")}`;
const context = { context_version: 1, actor_id: id(1), session_id: id(2), jwt_expires_at: "2026-10-12T23:59:59.000000Z" };
const revision = "9007199254740993";
function graphFixture() {
  const definition={id:id(5),version:1,system_id:id(4),content_type:"class",slug:"fighter",name:"Fighter",source:"srd",scope:"platform",owner_id:null,effects:[],
    data:{hit_die:10,spellcasting:null,multiclass:{prerequisites:[],proficiencies_gained:[]},saving_throws:[],starting_proficiencies:[],levels:Array.from({length:20},(_,i)=>({level:i+1,features:[],spellcasting:null})),source_refs:[]}};
  return { status:"complete",graph_version:1,readiness:{protocol_version:1,writers_complete:true,auth_complete:true,order_complete:true},
    counts:{pins:"1",inventory:"0",spells:"0",feature_grants:"0",spell_grants:"0",resolved_versions:"1",access_rows:"3"},
    order:{producer_version:1,character_id:id(3),producer_revision:revision,pins:[id(6)],inventory:[],spells:[],feature_grants:[],spell_grants:[]},versions:[definition],
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
  it("keeps earned ASI and spell authority unconditionally unready, regardless of column/schema presence", () => {
    expect(validateHitDieGraph(graphFixture(),context,id(3))).toEqual({status:"unready",reason:"schema_unready"});
  });
  it.each(["version","resolved"])("rejects custom spell forged %s even before unavailable earned authority", fault=>{
    const graph=graphFixture(); const spell={id:id(9),character_id:id(3),content_id:null,content_version:fault==="version"?1:null,name:"Custom",class_slug:"fighter",is_known:true,is_prepared:false,always_prepared:false,in_spellbook:false,source:"selection",custom_data:null,created_at:"2026-10-12T01:00:00.000000Z",resolved:fault==="resolved"?graph.versions[0]:null};
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
