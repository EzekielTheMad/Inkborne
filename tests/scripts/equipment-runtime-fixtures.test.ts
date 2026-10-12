// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeSource, manifestHash, TARGET, type Command, type Journal } from "@/scripts/equipment-runtime";
import { assertPhaseDelta, BUDGETS, executeFixtures, FIXTURE_FILES, fixtureManifestHash, freezeFixtures, INTENT, PHASES, PLAN, ROOT_IDS,
  RUN, validateFixtureApproval, validateState, type FixtureApproval, type FixtureJournal, type Predecessor } from "@/scripts/equipment-runtime-fixtures";
import { fixtureSnapshot, makeFixtureDefinitions, makeFixtureSystemSchema, makePassiveRevision } from "@/scripts/equipment-runtime/fixture-data";
import { parseContentDefinition, parseContentVersionSnapshot } from "@/lib/supabase/content-definitions-parser";
import { contentDefinitionSchema } from "@/lib/schemas/content";
import { getContentTypeSchema } from "@/lib/schemas/content-types";
import { systemSchemaDefinitionSchema } from "@/lib/schemas/system";

let root: string;
const containerId = "a".repeat(64), networkId = "b".repeat(64), imageId = `sha256:${"c".repeat(64)}`;
const gid = (suffix: number) => `07020000-2026-4a12-8e01-${String(suffix).padStart(12,"0")}`;
function write(file: string, data: string | Buffer) { mkdirSync(path.dirname(path.join(root,file)),{ recursive:true }); writeFileSync(path.join(root,file),data); }
function git(...args: string[]) { return execFileSync("git",args,{cwd:root,windowsHide:true,stdio:"pipe"}); }
function commit() { git("add","."); git("-c","user.name=R07 transport test","-c","user.email=r07@example.invalid","commit","-m","Injected transport source only"); }
const baseFiles = ["scripts/equipment-runtime.ts", "scripts/equipment-runtime/bootstrap-preflight.sql", "scripts/equipment-runtime/baseline-assertions.sql", "scripts/equipment-runtime/stage-assertions.sql", "scripts/equipment-runtime/catalog-audit.sql"];
beforeEach(() => {
  root=mkdtempSync(path.join(tmpdir(),"inkborne-r07-fixture-runner-")); git("init");
  for (const file of [...baseFiles,...FIXTURE_FILES]) write(file,readFileSync(path.join(process.cwd(),file)));
  write("docs/specs/2026-10-12-equipment-runtime.compose.yaml","name: synthetic-hash-only\n");
  write("supabase/migrations/00001_synthetic.sql","SELECT 'never executed';");
  write("supabase/staged/starting-equipment-transaction.sql","SELECT 'never executed stage';"); commit();
});
afterEach(() => { const resolved=realpathSync(root), base=realpathSync(tmpdir()); if(path.dirname(resolved)!==base || !path.basename(resolved).startsWith("inkborne-r07-fixture-runner-")) throw new Error("Unsafe test cleanup"); rmSync(resolved,{recursive:true,force:true}); });
const audit = () => ({ database:"postgres",actor:"postgres",tables:[...Object.keys(BUDGETS).map(key=>({schema:key.split(".")[0],name:key.split(".")[1]})),{schema:"public",name:"campaigns"}], extensions:[],roles:[],functions:["staged"],triggers:[],policies:[],table_grants:[],
  rowCounts:[...Object.keys(BUDGETS).map(key=>({schema:key.split(".")[0],table:key.split(".")[1],rows:0})),{schema:"public",table:"campaigns",rows:0}] });
function evidence() {
  const manifest=freezeSource(root), manifestSha256=manifestHash(manifest);
  const baseline:Journal={manifestSha256,sourceSha:manifest.sourceSha,containerId,phase:"baseline",complete:true,audits:[audit()],steps:["official-bootstrap-preflight",...manifest.migrations.map(file=>file.path),"baseline-assertions"].map(name=>({name,outcome:"passed",exitCode:0}))};
  const stage:Journal={...baseline,phase:"stage",audits:[audit(),audit()],steps:["baseline-assertions","stage-must-be-absent","supabase/staged/starting-equipment-transaction.sql","stage-assertions"].map(name=>({name,outcome:"passed",exitCode:0}))};
  const predecessor:Predecessor={manifest,baseline,stage,approval:{gate:"G2",scope:manifest.scope,approvedBy:"Victor",approvedAtUTC:"2026-10-12T00:00:00Z",sourceSha:manifest.sourceSha,manifestSha256,engineId:"synthetic-engine",containerId,networkId,imageId}};
  const frozen=freezeFixtures(root,predecessor), confirmation=fixtureManifestHash(frozen);
  const approval:FixtureApproval={...predecessor.approval,scope:frozen.scope,sourceSha:frozen.sourceSha,manifestSha256:confirmation,operations:["fixtures","cleanup"]};
  return {manifest:frozen,predecessor,approval,confirmation};
}
function states() {
  const empty=validateState({ids:Object.fromEntries(Object.keys(BUDGETS).map(key=>[key,[] as string[]]))});
  const seed=structuredClone(empty);
  Object.assign(seed.ids,{"auth.users":[ROOT_IDS.owner,ROOT_IDS.foreign],"public.profiles":[ROOT_IDS.owner,ROOT_IDS.foreign],"public.game_systems":[ROOT_IDS.system],"public.content_definitions":[ROOT_IDS.class,ROOT_IDS.feature,ROOT_IDS.asi,ROOT_IDS.spell,ROOT_IDS.item],"public.content_versions":[gid(100),gid(101),gid(102),gid(103),gid(104)],"public.characters":[ROOT_IDS.foreignCharacter]});
  const created={...structuredClone(seed),source:gid(200)}; created.ids["public.characters"].push(gid(200)); created.ids["public.character_starting_grants"].push(gid(300));
  const mechanics=structuredClone(created);
  Object.assign(mechanics.ids,{"public.character_content_refs":[gid(400),gid(401),gid(402)],"public.character_feature_grants":[gid(500),gid(501)],"public.character_spell_grants":[gid(600)],"public.character_spells":[gid(700)]});
  const awarded={...structuredClone(mechanics),receipt:{grant_id:gid(300),inventory_ids:[gid(800)],plan:PLAN,awarded_at:"2026-10-12T00:00:00Z"}}; awarded.ids["public.character_inventory"].push(gid(800));
  const drift=structuredClone(awarded); drift.ids["public.content_versions"].push(gid(105));
  const copy={...structuredClone(drift),copy:gid(201)}; copy.ids["public.characters"].push(gid(201));
  for (const [table,ids] of Object.entries({"public.character_content_refs":[gid(403),gid(404),gid(405)],"public.character_feature_grants":[gid(502),gid(503)],"public.character_spell_grants":[gid(601)],"public.character_spells":[gid(701)],"public.character_inventory":[gid(801)],"public.character_starting_grants":[gid(301)]})) copy.ids[table as keyof typeof copy.ids].push(...ids);
  return {empty:validateState(empty),seed:validateState(seed),create:validateState(created),mechanics:validateState(mechanics),award:validateState(awarded),consume:validateState(awarded),replay:validateState(awarded),"catalog-drift":validateState(drift),copy:validateState(copy),roles:validateState(copy)};
}
function transport(options:{fail?:string;wrongTarget?:boolean;unrelatedDelta?:boolean;cleanupResidue?:boolean;malformed?:string;freshnessAfter?:string;initialState?:ReturnType<typeof validateState>}={}) {
  let current=options.initialState ?? states().empty, completed="", cleaned=false;
  return vi.fn(async (command:Command) => {
    expect(command.args.slice(0,2)).toEqual(["--context","desktop-linux"]);
    if(command.args[2]==="info") return {code:0,stdout:JSON.stringify(options.wrongTarget?"wrong-engine":"synthetic-engine")};
    if(command.args[2]==="inspect") return {code:0,stdout:JSON.stringify({id:containerId,name:`/${TARGET.containerName}`,imageId,running:true,project:TARGET.prefix,service:"db",ports:null,
      networks:{[TARGET.networkName]:{NetworkID:networkId}},mounts:[{Type:"volume",Name:TARGET.volumes[0],Destination:"/var/lib/postgresql/data",RW:true},{Type:"volume",Name:TARGET.volumes[1],Destination:"/etc/postgresql-custom",RW:true},{Type:"bind",Source:`${TARGET.scratch}\\bootstrap\\99-roles.sql`,Destination:"/docker-entrypoint-initdb.d/init-scripts/99-roles.sql",RW:false},{Type:"bind",Source:`${TARGET.scratch}\\sql`,Destination:"/e1-sql",RW:false}]})};
    if(command.args[2]==="network") return {code:0,stdout:JSON.stringify({id:networkId,name:TARGET.networkName,internal:true})};
    if(command.args[2]==="image") return {code:0,stdout:JSON.stringify({id:imageId,digests:[TARGET.image],os:"linux",architecture:"amd64"})};
    expect(command.args[2]).toBe("exec"); expect(command.args).toContain("--no-password"); expect(command.args).toContain("ON_ERROR_STOP=1");
    if(command.stdin?.includes("'server_version'")) { const value=audit(); if(options.freshnessAfter===completed && completed) value.functions=["unexpected"]; const {rowCounts:_,...catalog}=value; void _; return {code:0,stdout:JSON.stringify(catalog)}; }
    const count=command.stdin?.match(/SELECT count\(\*\) FROM "([a-z_]+)"\."([a-z_]+)"/);
    if(count) {const table=`${count[1]}.${count[2]}`; const value=table in BUDGETS? current.ids[table as keyof typeof BUDGETS].length: options.unrelatedDelta&&completed==="seed"?1:0; return {code:0,stdout:String(value)};}
    const phase=command.stdin?.match(/SET inkborne\.r07\.phase = '([^']+)'/)?.[1] ?? (command.stdin?.includes("$prepare_cleanup$")?"cleanup":"");
    if(phase===options.fail) return {code:3,stdout:"secret response must not persist",stderr:"password=forbidden"};
    if(phase==="cleanup") { cleaned=true; if(!options.cleanupResidue) current=states().empty; return {code:0,stdout:JSON.stringify({phase,passed:true})}; }
    if(PHASES.includes(phase as typeof PHASES[number])) { if(cleaned) throw new Error("unexpected continuation"); current=states()[phase as typeof PHASES[number]]; completed=phase; return {code:0,stdout: options.malformed===phase?"{}":JSON.stringify({phase,passed:true,state:current})}; }
    return {code:0,stdout:JSON.stringify({phase,passed:true})};
  });
}
function run(overrides:Partial<Parameters<typeof executeFixtures>[0]>={}, options:Parameters<typeof transport>[0]={}) { const data=evidence(), wire=transport(options), saved:FixtureJournal[]=[]; return {wire,saved,promise:executeFixtures({...data,root,transport:wire,save:value=>saved.push(value),...overrides})}; }

describe("R07.2 finite source and original lineage",()=>{
  it("hashes every executable fixture, fixes roots/budgets, and freezes no runtime automatically",()=>{ const data=evidence(); expect(data.manifest.files.map(file=>file.path)).toEqual(FIXTURE_FILES); expect(data.manifest.fixtureIds).toEqual(ROOT_IDS); expect(data.manifest.budgets["public.character_content_refs"]).toBe(6); expect(data.manifest.predecessor.sourceSha).toBe(data.predecessor.manifest.sourceSha); });
  it("allows new preparation SHA while preserving immutable predecessor evidence and protected SQL",()=>{ const data=evidence(), original=structuredClone(data.predecessor); write("scripts/equipment-runtime-fixtures.ts",readFileSync(path.join(root,"scripts/equipment-runtime-fixtures.ts"))+"\n// additive later preparation\n"); commit(); const next=freezeFixtures(root,data.predecessor); expect(next.sourceSha).not.toBe(original.manifest.sourceSha); expect(next.predecessor.sourceSha).toBe(original.manifest.sourceSha); expect(data.predecessor).toEqual(original); });
  it("refuses migration/stage drift even with a clean new source",()=>{ const data=evidence(); write("supabase/staged/starting-equipment-transaction.sql","SELECT 'tampered';"); commit(); expect(()=>freezeFixtures(root,data.predecessor)).toThrow(/bytes changed/); });
  it("refuses an incomplete original stage, original G2 mismatch or changed audit lineage",()=>{ const data=evidence(); data.predecessor.stage.complete=false; expect(()=>freezeFixtures(root,data.predecessor)).toThrow(/completed immutable/); data.predecessor.stage.complete=true; data.predecessor.approval.gate="G1" as "G2"; expect(()=>freezeFixtures(root,data.predecessor)).toThrow(/G2/); });
  it("does not treat R07.1 approval or local plan approval as fixture/delete authority",()=>{ const data=evidence(); expect(()=>validateFixtureApproval(data.manifest,{...data.approval,scope:"R07.1-baseline-and-stage"} as unknown as FixtureApproval,data.confirmation)).toThrow(/actual human G2/); expect(()=>validateFixtureApproval(data.manifest,{...data.approval,operations:["fixtures"]} as unknown as FixtureApproval,data.confirmation)).toThrow(/fixtures\+cleanup/); });
  it("binds every exact predecessor resource ID",()=>{ const data=evidence(); for(const key of ["engineId","imageId","networkId","containerId"] as const) expect(()=>validateFixtureApproval(data.manifest,{...data.approval,[key]:key==="imageId"?`sha256:${"d".repeat(64)}`:key==="engineId"?"another-engine":"d".repeat(64)},data.confirmation)).toThrow(/resource IDs/); });
  it("refuses missing fixture or dirty source before any transport",async()=>{ const data=evidence(), wire=transport(); write("scripts/equipment-runtime/fixture-award.sql","changed"); await expect(executeFixtures({...data,root,transport:wire,save:()=>{}})).rejects.toThrow(/clean/); expect(wire).not.toHaveBeenCalled(); });
});
describe("R07.2 source-only injected transaction choreography",()=>{
  it("journals each confirmed phase identity before the next SQL and never autocleans",async()=>{ const task=run(); const result=await task.promise; expect(result.status).toBe("fixtures-complete"); expect(result.steps.map(step=>step.phase)).toEqual(["preflight",...PHASES]); expect(result.state.receipt).toEqual(states().award.receipt); expect(task.saved.some(value=>value.steps.at(-1)?.phase==="create"&&value.state.source===gid(200))).toBe(true); expect(task.wire.mock.calls.filter(([command])=>command.stdin?.includes("$prepare_cleanup$")).length).toBe(0); });
  it.each(["seed","create","award","copy"])("stops an uncertain %s with no next phase or cleanup",async phase=>{const task=run({}, {fail:phase}); await expect(task.promise).rejects.toThrow(new RegExp(`uncertain ${phase}`)); expect(task.saved.at(-1)?.status).toBe("uncertain"); const sql=task.wire.mock.calls.map(([command])=>command.stdin??"").join("\n"); expect(sql).not.toContain("$prepare_cleanup$"); expect(JSON.stringify(task.saved)).not.toContain("forbidden"); const index=PHASES.indexOf(phase as typeof PHASES[number]); if(index<PHASES.length-1) expect(sql).not.toContain(`SET inkborne.r07.phase = '${PHASES[index+1]}'`);});
  it("stops on commit/readback malformation and journal-save failure",async()=>{const task=run({}, {malformed:"create"}); await expect(task.promise).rejects.toThrow(/uncertain create/); const broken=run({save:value=>{if(value.steps.at(-1)?.phase==="create"&&value.steps.at(-1)?.outcome==="passed") throw new Error("disk failure");}}); await expect(broken.promise).rejects.toThrow(/uncertain create/); expect(broken.wire.mock.calls.some(([command])=>command.stdin?.includes("SET inkborne.r07.phase = 'mechanics'"))).toBe(false);});
  it("refuses wrong target before fixture SQL",async()=>{const task=run({}, {wrongTarget:true}); await expect(task.promise).rejects.toThrow(/daemon/); expect(task.wire.mock.calls.some(([command])=>command.args[2]==="exec")).toBe(false);});
  it("bounds the complete runtime deadline before transport rather than starting another client",async()=>{
    const clock=vi.spyOn(Date,"now").mockReturnValueOnce(0).mockReturnValue(15*60*1000+1);
    try { const task=run(); await expect(task.promise).rejects.toThrow(/transport failed/); expect(task.wire).not.toHaveBeenCalled(); } finally { clock.mockRestore(); }
  });
  it("rejects unapproved unrelated count delta and phase catalog drift",async()=>{const task=run({}, {unrelatedDelta:true}); await expect(task.promise).rejects.toThrow(/uncertain seed/); const drift=run({}, {freshnessAfter:"seed"}); await expect(drift.promise).rejects.toThrow(/uncertain seed/);});
  it("requires completed exact receipt before separately invoked cleanup",async()=>{const data=evidence(), wire=transport(); await expect(executeFixtures({...data,root,transport:wire,save:()=>{},cleanupReceipt:{status:"uncertain"} as FixtureJournal})).rejects.toThrow(/completed fixture/);});
  it("separate cleanup restores the retained stage baseline and rejects residue",async()=>{
    const data=evidence(), completed=await executeFixtures({...data,root,transport:transport(),save:()=>{}});
    const cleaned=await executeFixtures({...data,root,transport:transport({initialState:completed.state}),save:()=>{},cleanupReceipt:completed});
    expect(cleaned.status).toBe("cleaned"); expect(cleaned.audits.at(-1)?.rowCounts.every(row=>row.rows===0)).toBe(true);
    await expect(executeFixtures({...data,root,transport:transport({initialState:completed.state,cleanupResidue:true}),save:()=>{},cleanupReceipt:completed})).rejects.toThrow(/uncertain cleanup/);
  });
  it("keeps arrays/order and original receipt, refuses excessive or unrecorded IDs",()=>{const state=states().award; expect(validateState(state).receipt).toEqual(state.receipt); const tampered=structuredClone(state); tampered.ids["public.character_inventory"]=[gid(800),gid(801),gid(802)]; expect(()=>validateState(tampered)).toThrow(/budget/); const invalid=structuredClone(state); invalid.receipt!.inventory_ids=[gid(999)]; expect(()=>validateState(invalid)).toThrow(/receipt/);});
  it("refuses receipt plan tampering but accepts JSONB object-key normalization",()=>{const state=states().award; const reversed=structuredClone(state); reversed.receipt!.plan={currency:PLAN.currency,items:PLAN.items.map(item=>({quantity:item.quantity,content_type:item.content_type,name:item.name,content_version:item.content_version,content_id:item.content_id}))}; expect(()=>validateState(reversed)).not.toThrow(); reversed.receipt!.plan={...PLAN,currency:{gp:99}}; expect(()=>validateState(reversed)).toThrow(/receipt/);});
  it("explicit phase deltas leave unrelated tables and catalog unchanged",()=>{const before=audit(),after=audit(); after.rowCounts.find(row=>row.table==="campaigns")!.rows=1; expect(()=>assertPhaseDelta(before,after,states().empty,states().empty)).toThrow(/unrelated/);});
});
describe("actual-schema executable fixture source contracts (not SQL acceptance)",()=>{
  it("validates all five full payloads/defaults with actual canonical data/effects/source schemas",()=>{
    const definitions=makeFixtureDefinitions(RUN,ROOT_IDS); expect(definitions).toHaveLength(5);
    expect(systemSchemaDefinitionSchema.safeParse(makeFixtureSystemSchema()).success).toBe(true); expect(makeFixtureSystemSchema().ability_scores).toHaveLength(6);
    for(const definition of definitions) { expect(()=>contentDefinitionSchema.parse(definition)).not.toThrow(); expect(getContentTypeSchema(definition.content_type)?.safeParse(definition.data).success).toBe(true); }
    expect(definitions.find(definition=>definition.id===ROOT_IDS.feature)?.data.feature_type).toBe("passive");
    expect(definitions.find(definition=>definition.id===ROOT_IDS.asi)?.data.feature_type).toBe("asi");
    expect(definitions.find(definition=>definition.id===ROOT_IDS.class)?.data.levels).toHaveLength(20);
    expect(definitions.find(definition=>definition.id===ROOT_IDS.class)?.data.spellcastingExtra).toEqual([`${RUN}-spell`]);
    expect(getContentTypeSchema("feature")?.safeParse({feature_type:"class_feature"}).success).toBe(false);
    expect(getContentTypeSchema("spell")?.safeParse({level:1,school:"evocation"}).success).toBe(false);
    expect(()=>contentDefinitionSchema.parse({...definitions[0],source:"invented"})).toThrow();
  });
  it("parses canonical current definitions and immutable snapshots, distinguishes valid latest substitution",()=>{
    const original=makeFixtureDefinitions(RUN,ROOT_IDS).find(definition=>definition.id===ROOT_IDS.feature)!;
    const latest=makePassiveRevision(original), pinned=parseContentVersionSnapshot(fixtureSnapshot(original)), current=parseContentDefinition(latest);
    expect(pinned?.version).toBe(1); expect(current?.version).toBe(2); expect(pinned?.data).toEqual(original.data); expect(pinned?.effects).toEqual([]);
    expect(current?.data.description).not.toBe(pinned?.data.description); expect(current?.effects).toEqual([{type:"mechanical",stat:"strength",op:"add",value:2}]);
    expect(parseContentVersionSnapshot(fixtureSnapshot(latest))).not.toEqual(pinned);
    expect(BUDGETS["public.content_definitions"]).toBe(5); expect(BUDGETS["public.content_versions"]).toBe(6);
    const sql=readFileSync("scripts/equipment-runtime/fixture-copy.sql","utf8"); expect(sql).toContain("Latest feature substitution changed copied immutable data/effects"); expect(sql).toContain("v.data_snapshot=original->'data'");
  });
  it("uses real production RPCs/triggers and no replacement DDL or hosted transport",()=>{const sql=FIXTURE_FILES.filter(file=>file.endsWith(".sql")).map(file=>readFileSync(file,"utf8")).join("\n"); expect(sql).not.toMatch(/^\s*(?:create\s+(?:or\s+replace\s+)?(?:function|table|role|schema)|alter\s+table|disable\s+trigger)\b/im); for(const name of ["create_character_with_starting_grant","commit_starting_equipment","resolve_starting_equipment","copy_character","sync_character_feature_refs","sync_character_spell_grants","set_character_asi_choice"]) expect(sql).toContain(`public.${name}`); expect(sql).not.toContain("set_character_asi_choice(s,tag||'-asi','feat'");});
  it("checks exact expected SQLSTATE/zero-row denials and privileged full-row invariants",()=>{const sql=readFileSync("scripts/equipment-runtime/fixture-roles.sql","utf8"); expect(sql).toContain("RETURNED_SQLSTATE"); expect(sql).toContain("actual_code IS DISTINCT FROM '42501'"); expect(sql).toContain("actual_code IS DISTINCT FROM '23514'"); expect(sql).toContain("affected<>0"); expect(sql).toContain("before_rows IS DISTINCT FROM after_rows"); expect(sql).toContain("SET LOCAL ROLE");});
  it("exact graph cleanup rejects unknown UUID FK children and uses IDs, not patterns",()=>{const graph=readFileSync("scripts/equipment-runtime/fixture-ownership.sql","utf8"), cleanup=readFileSync("scripts/equipment-runtime/fixture-cleanup.sql","utf8"); expect(graph).toContain("unnest(f.conkey)"); expect(graph).toContain("Closed fixture ownership graph violated"); expect(graph).toContain("Foreign parent outside closed fixture ownership graph"); expect(graph).toContain("AND NOT (%I=ANY($2))"); expect(cleanup).toContain("WHERE id=ANY"); expect(cleanup).toContain("Exact fixture residue remains"); expect(cleanup).not.toMatch(/\bLIKE\b|\bTRUNCATE\b|\bCASCADE\s*;/i);});
  it("commits phases before ID/receipt readback, preserves spent currency and copied pins",()=>{for(const phase of PHASES) expect(readFileSync(`scripts/equipment-runtime/fixture-${phase}.sql`,"utf8")).toContain("COMMIT;"); expect(readFileSync("scripts/equipment-runtime/fixture-replay.sql","utf8")).toContain("state->'currency'->>'gp'='4'"); expect(readFileSync("scripts/equipment-runtime/fixture-copy.sql","utf8")).toContain("source_before IS DISTINCT FROM source_after"); expect(INTENT.plan.items).toHaveLength(1);});
});
