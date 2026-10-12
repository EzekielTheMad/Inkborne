// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { executeApproved, freezeSource, manifestHash, TARGET, validateApproval, validateFrozen, verifyRuntime,
  type Command, type Journal, type RuntimeApproval } from "@/scripts/equipment-runtime";

let root: string;
const containerId = "a".repeat(64), networkId = "b".repeat(64), imageId = `sha256:${"c".repeat(64)}`;
const sourceFiles = ["scripts/equipment-runtime.ts",
  "scripts/equipment-runtime/bootstrap-preflight.sql", "scripts/equipment-runtime/baseline-assertions.sql",
  "scripts/equipment-runtime/stage-assertions.sql", "scripts/equipment-runtime/catalog-audit.sql"];
const runGit = (...args: string[]) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
function write(relative: string, data: string | Buffer) { mkdirSync(path.dirname(path.join(root,relative)), { recursive: true }); writeFileSync(path.join(root, relative), data); }
function commit() { runGit("add", "."); runGit("-c", "user.name=R07 local test", "-c", "user.email=r07@example.invalid", "commit", "-m", "Synthetic transport-only source"); }
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "inkborne-r07-harness-"));
  runGit("init");
  for (const relative of sourceFiles) write(relative, readFileSync(path.join(process.cwd(),relative)));
  // The runtime plan joins this worker at integration; use a hash-only test artifact.
  write("docs/specs/2026-10-12-equipment-runtime.compose.yaml", "name: synthetic-transport-fixture\n");
  // These SQL strings are transport-test inputs only; never executed in a database.
  write("supabase/migrations/00001_first.sql", "SELECT 'first';");
  write("supabase/migrations/00004_second.sql", "SELECT 'second';");
  write("supabase/migrations/20261010232200_last.sql", "SELECT 'last';");
  write("supabase/staged/starting-equipment-transaction.sql", "SELECT 'stage';");
  commit();
});
afterEach(() => {
  // Verify resolved targets before recursive removal; remove only this test-owned directory.
  const resolved = realpathSync(root), resolvedTemp = realpathSync(tmpdir());
  if (path.dirname(resolved) !== resolvedTemp || !path.basename(resolved).startsWith("inkborne-r07-harness-")) throw new Error("Unsafe test cleanup target");
  rmSync(resolved, { recursive: true, force: true });
});
function approval() {
  const manifest = freezeSource(root);
  const approved: RuntimeApproval = { gate: "G2", scope: manifest.scope, approvedBy: "Victor",
    approvedAtUTC: "2026-10-12T00:00:00Z", sourceSha: manifest.sourceSha,
    manifestSha256: manifestHash(manifest), engineId: "test-desktop-engine", containerId, imageId, networkId };
  return { manifest, approved };
}
function metadata() {
  return { id: containerId, name: `/${TARGET.containerName}`, imageId, running: true,
    project: TARGET.prefix, service: "db", ports: null,
    networks: { [TARGET.networkName]: { NetworkID: networkId } },
    mounts: [
      { Type: "volume", Name: TARGET.volumes[0], Destination: "/var/lib/postgresql/data", RW: true },
      { Type: "volume", Name: TARGET.volumes[1], Destination: "/etc/postgresql-custom", RW: true },
      { Type: "bind", Source: `${TARGET.scratch}\\bootstrap\\99-roles.sql`, Destination: "/docker-entrypoint-initdb.d/init-scripts/99-roles.sql", RW: false },
      { Type: "bind", Source: `${TARGET.scratch}\\sql`, Destination: "/e1-sql", RW: false },
    ] };
}
const catalog = { database: "postgres", actor: "postgres", backend_pid: 101,
  extensions: [], roles: [], tables: [{ schema: "public", name: "characters", rls: true }],
  functions: [], triggers: [], policies: [], table_grants: [] };
function transport(options: { container?: ReturnType<typeof metadata>; failSQL?: string; engine?: string; unsafeTable?: boolean; forbiddenStageGrant?: { role: "anon" | "authenticated"; privilege: string } } = {}) {
  return vi.fn(async (command: Command) => {
    expect(command.args.slice(0,2)).toEqual(["--context", "desktop-linux"]);
    if (command.args[2] === "info") return { code: 0, stdout: JSON.stringify(options.engine ?? "test-desktop-engine") };
    if (command.args[2] === "inspect") return { code: 0, stdout: JSON.stringify(options.container ?? metadata()) };
    if (command.args[2] === "network") return { code: 0, stdout: JSON.stringify({ id: networkId, name: TARGET.networkName, internal: true }) };
    if (command.args[2] === "image") return { code: 0, stdout: JSON.stringify({ id: imageId, digests: [TARGET.image], os: "linux", architecture: "amd64" }) };
    expect(command.args[2]).toBe("exec");
    expect(command.args[4]).toBe(containerId);
    expect(command.args).toContain("ON_ERROR_STOP=1");
    expect(command.args).toContain("--no-password");
    expect(command.args).not.toContain("--env");
    if (options.forbiddenStageGrant && command.stdin?.includes("R07.1 forbidden grant-table privilege")) {
      const privileges = command.stdin.match(/FOREACH forbidden_privilege IN ARRAY ARRAY\[([^\]]+)\]/)?.[1].match(/'[A-Z]+'/g)?.map(value=>value.slice(1,-1)) ?? [];
      const { role, privilege } = options.forbiddenStageGrant;
      if (privileges.includes(privilege) && !(role === "authenticated" && privilege === "SELECT")) return {code:3,stdout:"",stderr:"ERROR: P0001"};
    }
    if (command.stdin === options.failSQL) return { code: 3, stdout: "secret must not persist", stderr: "secret DSN password=do-not-retain" };
    if (command.stdin?.includes("'server_version'")) return { code: 0, stdout: JSON.stringify(options.unsafeTable ? { ...catalog, tables: [{ schema: "public", name: 'characters";drop table profiles' }] } : catalog) };
    if (command.stdin?.includes("SELECT count(*)")) return { code: 0, stdout: "0\n" };
    return { code: 0, stdout: "" };
  });
}
describe("frozen-source boundary", () => {
  it("freezes all sorted migrations, preserves numbering gaps and never freezes fixture rows", () => {
    const { manifest } = approval();
    expect(manifest.migrations.map(file => file.path)).toEqual([
      "supabase/migrations/00001_first.sql", "supabase/migrations/00004_second.sql", "supabase/migrations/20261010232200_last.sql"]);
    expect(manifest.fixtureIds).toEqual([]);
    expect(manifest.files).toContainEqual(expect.objectContaining({ path: "supabase/staged/starting-equipment-transaction.sql" }));
  });
  it("rejects dirty source and rejects a changed committed SQL file under the original freeze", () => {
    const { manifest } = approval();
    write("supabase/migrations/00001_first.sql", "SELECT 'changed';");
    expect(() => validateFrozen(root,manifest)).toThrow(/committed and clean/);
    commit();
    expect(() => validateFrozen(root,manifest)).toThrow(/frozen SHA/);
  });
  it("refuses deletion/reordering/extra paths and target changes in a supplied manifest", () => {
    const { manifest } = approval();
    expect(() => validateFrozen(root,{ ...manifest, migrations: manifest.migrations.slice(1) })).toThrow(/inventory/);
    expect(() => validateFrozen(root,{ ...manifest, migrations: [...manifest.migrations].reverse() })).toThrow(/inventory/);
    expect(() => validateFrozen(root,{ ...manifest, files: [...manifest.files,{path:".env.local",sha256:"0".repeat(64)}] })).toThrow(/inventory/);
    const changed = structuredClone(manifest); Object.assign(changed.target,{context:"production"});
    expect(() => validateFrozen(root,changed)).toThrow(/target drift/);
  });
  it("requires exact explicit human G2 confirmation, not G1 or a generic permission flag", () => {
    const { manifest, approved } = approval();
    expect(() => validateApproval(manifest,approved,"yes")).toThrow(/G2 record/);
    expect(() => validateApproval(manifest,{...approved,gate:"G1"} as unknown as RuntimeApproval,manifestHash(manifest))).toThrow(/G2 record/);
    expect(() => validateApproval(manifest,{...approved,containerId:"inkborne-db"},manifestHash(manifest))).toThrow(/resource IDs/);
  });
});
describe("real runtime transport boundary", () => {
  it.each(["name","ports","mount","network","running"])("refuses %s mismatch before any SQL", async mismatch => {
    const { approved } = approval(); const wrong = metadata();
    if(mismatch === "name") wrong.name="/Inkborne";
    if(mismatch === "ports") Object.assign(wrong,{ports:{"5432/tcp":[{HostIp:"0.0.0.0",HostPort:"55432"}]}});
    if(mismatch === "mount") wrong.mounts[3].RW=true;
    if(mismatch === "network") Object.assign(wrong,{networks:{other:{NetworkID:networkId}}});
    if(mismatch === "running") wrong.running=false;
    const run=transport({container:wrong});
    await expect(verifyRuntime(run,approved)).rejects.toThrow(/R07.1 refusal/);
    expect(run.mock.calls.some(([command])=>command.args[2]==="exec")).toBe(false);
  });
  it("refuses a different daemon and an unapproved writable volume", async () => {
    const { approved } = approval();
    await expect(verifyRuntime(transport({engine:"other-daemon"}),approved)).rejects.toThrow(/wrong Docker daemon/);
    const wrong=metadata(); Object.assign(wrong.mounts[0],{Name:"unrelated-user-volume"});
    await expect(verifyRuntime(transport({container:wrong}),approved)).rejects.toThrow(/mount/);
  });
  it("recognizes the exact Desktop Linux mapping of approved read-only Windows mounts", async () => {
    const { approved } = approval(); const mapped=metadata();
    for(const mount of mapped.mounts) if(mount.Source) mount.Source=mount.Source.replace(/\\/g,"/").replace(/^C:\//,"/run/desktop/mnt/host/c/");
    await expect(verifyRuntime(transport({container:mapped}),approved)).resolves.toBeUndefined();
  });
  it("stops at the first migration failure and persists no raw failure output", async () => {
    const {manifest,approved}=approval(); const run=transport({failSQL:"SELECT 'second';"}); const receipts:Journal[]=[];
    await expect(executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:run,saveJournal:j=>receipts.push(j)})).rejects.toThrow(/first SQL failure/);
    const sql=run.mock.calls.map(([command])=>command.stdin).filter(Boolean);
    expect(sql).not.toContain("SELECT 'last';"); expect(sql).not.toContain("SELECT 'stage';");
    expect(receipts.at(-1)?.complete).toBe(false);
    expect(receipts.at(-1)?.steps.at(-1)).toEqual({name:"supabase/migrations/00004_second.sql",outcome:"failed",exitCode:3});
    expect(JSON.stringify(receipts)).not.toContain("secret");
  });
  it("replays every frozen byte in order and records full exact-count audit", async () => {
    const {manifest,approved}=approval(); const run=transport();
    const receipt=await executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:run,saveJournal:()=>{}});
    expect(receipt.complete).toBe(true);
    expect(receipt.steps.map(step=>step.name)).toEqual(["official-bootstrap-preflight",...manifest.migrations.map(file=>file.path),"baseline-assertions"]);
    expect(receipt.audits[0]).toMatchObject({rowCounts:[{schema:"public",table:"characters",rows:0}]});
    const sql=run.mock.calls.map(([command])=>command.stdin).filter(Boolean);
    expect(sql.filter(text=>text?.startsWith("SELECT '"))).toEqual(["SELECT 'first';","SELECT 'second';","SELECT 'last';"]);
    expect(run.mock.calls.every(([command])=>!command.args.some(arg=>["prune","stop","rm","reset","push"].includes(arg)))).toBe(true);
  });
  it("refuses stage without the same exact full completed baseline receipt", async () => {
    const {manifest,approved}=approval(); const run=transport();
    await expect(executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"stage",transport:run,saveJournal:()=>{}})).rejects.toThrow(/full baseline receipt/);
    expect(run).not.toHaveBeenCalled();
  });
  it("fingerprints the actual unchanged baseline before applying the stage once", async () => {
    const {manifest,approved}=approval(); const run=transport();
    const baseline=await executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:run,saveJournal:()=>{}});
    run.mockClear();
    const stage=await executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"stage",transport:run,baselineReceipt:baseline,saveJournal:()=>{}});
    expect(stage.complete).toBe(true); expect(stage.audits).toHaveLength(2);
    expect(run.mock.calls.filter(([command])=>command.stdin==="SELECT 'stage';")).toHaveLength(1);
    expect(run.mock.calls.some(([command])=>command.stdin?.includes("Stage already present"))).toBe(true);
  });
  it("retains the only allowed owner SELECT and asserts every other PG17 table/column privilege", () => {
    const sql = readFileSync(path.join(root,"scripts/equipment-runtime/stage-assertions.sql"),"utf8");
    const denied = sql.match(/FOREACH forbidden_privilege IN ARRAY ARRAY\[([^\]]+)\]/)?.[1].match(/'[A-Z]+'/g)?.map(value=>value.slice(1,-1));
    expect(denied).toEqual(["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"]);
    expect(sql).toContain("FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP");
    expect(sql).toContain("IF api_role = 'authenticated' AND forbidden_privilege = 'SELECT' THEN CONTINUE;");
    expect(sql).toContain("IF NOT pg_catalog.has_table_privilege('authenticated','public.character_starting_grants','SELECT')");
    expect(sql).toContain("pg_catalog.has_table_privilege(api_role,'public.character_starting_grants',forbidden_privilege)");
    expect(sql).toContain("pg_catalog.has_any_column_privilege(api_role,'public.character_starting_grants',forbidden_privilege)");
  });
  it.each([
    ...["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"].map(privilege=>({role:"authenticated" as const,privilege})),
    ...["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER","MAINTAIN"].map(privilege=>({role:"anon" as const,privilege})),
  ])("never completes the stage with effective $role $privilege in the injected permission result", async forbiddenStageGrant => {
    const {manifest,approved}=approval(); const receipts: Journal[] = [];
    const baseline=await executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:transport(),saveJournal:()=>{}});
    const run=transport({forbiddenStageGrant});
    await expect(executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"stage",transport:run,baselineReceipt:baseline,saveJournal:j=>receipts.push(j)})).rejects.toThrow(/first SQL failure at stage-assertions/);
    expect(receipts.at(-1)?.complete).toBe(false);
    expect(receipts.at(-1)?.steps.at(-1)).toEqual({name:"stage-assertions",outcome:"failed",exitCode:3});
    expect(receipts.at(-1)?.audits).toHaveLength(1);
  });
  it("rejects a drifted baseline receipt before the first staged write", async () => {
    const {manifest,approved}=approval(); const run=transport();
    const baseline=await executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:run,saveJournal:()=>{}});
    Object.assign(baseline.audits[0] as object,{rowCounts:[{schema:"public",table:"characters",rows:1}]});
    run.mockClear();
    await expect(executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"stage",transport:run,baselineReceipt:baseline,saveJournal:()=>{}})).rejects.toThrow(/catalog\/grants\/counts drift/);
    expect(run.mock.calls.some(([command])=>command.stdin==="SELECT 'stage';")).toBe(false);
  });
  it("refuses unsafe catalog identifiers before building count queries", async () => {
    const {manifest,approved}=approval(); const run=transport({unsafeTable:true});
    await expect(executeApproved({root,manifest,approval:approved,confirmation:manifestHash(manifest),phase:"baseline",transport:run,saveJournal:()=>{}})).rejects.toThrow(/unsafe audit identifier/);
    expect(run.mock.calls.some(([command])=>command.stdin?.includes("SELECT count(*)"))).toBe(false);
  });
});
