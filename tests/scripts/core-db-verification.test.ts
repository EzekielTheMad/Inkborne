import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PROFILE, LIMITS, STAGES, canonicalJson, coreManifestHash, validateCoreApproval,
  observedCommand, assertCatalogDelta, expectedFunctionMetadata, expectedExecuteMatrix, assertFunctionMetadata, executeCore,
  freezeCore, validateLineage, verifyCoreRuntime, nativeObserver,
  type CoreManifest, type CoreApproval, type CoreJournal, type ModelBindings, type OsIdentity,
} from "../../scripts/core-db-verification";
import { TARGET, actualTransport, freezeSource, manifestHash, sha256, type Transport, type Command, type Result, type runtimeProcessRecords,
  type Journal, type RuntimeApproval } from "../../scripts/equipment-runtime";
import { BUDGETS, FIXTURE_FILES, PHASES, ROOT_IDS, RUN, RUNTIME_LIMITS, fixtureManifestHash,
  type FixtureManifest, type FixtureJournal, type FixtureApproval } from "../../scripts/equipment-runtime-fixtures";

const resourceIds = { engineId: "engine:model", containerId: "a".repeat(64), imageId: "sha256:" + "b".repeat(64), networkId: "c".repeat(64) };
const manifest = { execution: "native", contractVersion: 1, scope: PROFILE, sourceSha: "d".repeat(40), target: TARGET, limits: LIMITS, resourceIds,
  equipment: {}, files: [], predecessor: {} } as unknown as CoreManifest;
const approval = (): CoreApproval => ({ gate: "G2", scope: PROFILE, approvedBy: "Victor", approvedAtUTC: "2026-10-13T17:00:00Z",
  sourceSha: manifest.sourceSha, manifestSha256: coreManifestHash(manifest), ...resourceIds, operations: ["install-disabled-stages", "verify-disabled-stages"] });
describe("additive profile admission model; no OS/Docker/SQL execution", () => {
  it("sorts object keys but preserves exact array order and original raw hashes", () => {
    expect(canonicalJson({ b: 1, a: [2, 1] })).toBe('{"a":[2,1],"b":1}');
    expect(coreManifestHash({ ...manifest, files: [{ path: "x", sha256: "a", gitBlob: "b" }] })).not.toBe(coreManifestHash(manifest));
    expect(() => canonicalJson({ impossible: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it("admits only an independently supplied exact new profile approval shape", () => {
    const exact = approval();
    expect(() => validateCoreApproval(manifest, exact, coreManifestHash(manifest))).not.toThrow();
    expect(() => validateCoreApproval(manifest, { ...exact, scope: "R07.1-baseline-and-stage" } as unknown as CoreApproval, exact.manifestSha256)).toThrow();
  });
  it.each([
    { gate: "G1" }, { approvedBy: "Agent" }, { approvedAtUTC: "not a UTC date" }, { sourceSha: "e".repeat(40) },
    { manifestSha256: "f".repeat(64) }, { containerId: "e".repeat(64) },
    { operations: ["verify-disabled-stages"] }, { operations: ["install-disabled-stages", "verify-disabled-stages", "activate"] },
  ])("rejects modeled approval drift %j before transport", change => {
    expect(() => validateCoreApproval(manifest, { ...approval(), ...change } as CoreApproval, coreManifestHash(manifest))).toThrow();
  });
  it("rejects missing explicit confirmation and changed target/budget", () => {
    expect(() => validateCoreApproval(manifest, approval(), "")).toThrow();
    expect(() => validateCoreApproval({ ...manifest, limits: { ...LIMITS, commands: 501 } } as CoreManifest, approval(), coreManifestHash(manifest))).toThrow();
    expect(() => validateCoreApproval({ ...manifest, target: { ...TARGET, context: "default" } } as unknown as CoreManifest, approval(), coreManifestHash(manifest))).toThrow();
  });
  it("actual native entry refuses inherited/absent G2 before source/OS/transport work", async () => {
    const transport = vi.fn(), capture = vi.fn(), resources = vi.fn(), save = vi.fn();
    await expect(executeCore({ root: process.cwd(), manifest, approval: { ...approval(), gate: "G1" } as unknown as CoreApproval,
      confirmation: coreManifestHash(manifest), transport, observer: { capture, resources }, records: () => [], save })).rejects.toThrow("G2");
    expect(transport).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled(); expect(resources).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
});
function commandModel(kind: "success" | "fast" | "reject" | "alive" | "reused" | "wrong-parent") {
  const command: Command = { args: ["--context", TARGET.context, "info"], timeoutMs: 30_000 };
  const records: ReturnType<typeof runtimeProcessRecords> = [];
  const record = { pid: 9001, parentPid: process.pid, cwd: process.cwd(), executable: "MODELED_DOCKER", args: command.args, startedUTC: "2026-10-13T17:00:00Z" };
  const identity: OsIdentity = { pid: 9001, parentPid: process.pid, birthUtc: "2026-10-13T17:00:00.0000000Z", command: "MODELED_DOCKER --context " + TARGET.context + " info" };
  const saved: unknown[] = []; let read = 0;
  const transport: Transport = async () => {
    records.push(record);
    await Promise.resolve(); Object.assign(record, { finishedUTC: "2026-10-13T17:00:01Z" });
    if (kind === "reject") throw Error("Modeled transport failure after exit; private raw detail");
    return { code: 0, stdout: "{}" };
  };
  const observer = {
    capture: vi.fn(() => {
      read++;
      if (kind === "fast") return null;
      if (read === 1) return kind === "wrong-parent" ? { ...identity, parentPid: -1 } : identity;
      if (kind === "alive") return identity;
      if (kind === "reused") return { ...identity, birthUtc: "2026-10-13T17:00:02.0000000Z" };
      return null;
    }),
    resources: vi.fn(),
  };
  return { command, transport, observer, records: () => structuredClone(records), save: (value: unknown) => { saved.push(value); }, saved };
}
describe("injected OS observer protocol; never invokes nativeObserver", () => {
  it("records actual-shaped identity and fresh absence, independent of code0 alone", async () => {
    const model = commandModel("success");
    expect(await observedCommand(model)).toMatchObject({ code: 0 });
    expect(model.observer.capture).toHaveBeenCalledTimes(2);
    expect(model.saved).toMatchObject([{ osIdentity: { pid: 9001 }, absent: true, resultCode: 0 }]);
  });
  it.each(["fast", "reject", "alive", "wrong-parent"] as const)("stops uncertain on %s with evidence; no guessed identity or extra kill", async kind => {
    const model = commandModel(kind);
    await expect(observedCommand(model)).rejects.toThrow("uncertain");
    expect(model.saved).toHaveLength(1);
    expect(JSON.stringify(model.saved)).not.toContain("private raw detail");
    if (kind === "fast") expect(model.saved[0]).not.toHaveProperty("osIdentity");
    if (kind === "reject") expect(model.saved[0]).toMatchObject({ absent: true });
  });
  it("preserves an unrelated reused PID instead of treating it as the old child", async () => {
    const model = commandModel("reused");
    await expect(observedCommand(model)).resolves.toMatchObject({ code: 0 });
    expect(model.saved[0]).toMatchObject({ absent: true });
  });
});
const emptyAudit = () => ({ extensions: [], roles: [], tables: [{ schema: "private", name: "existing_equipment", owner: "postgres" }],
  functions: [], triggers: [], policies: [], table_grants: [], rowCounts: [{ schema: "private", table: "existing_equipment", rows: 1 }] });
describe("source/catalog protocol controls; no database engine", () => {
  it("rejects original equipment data/catalog drift while allowing only declared new private tables", () => {
    const before = emptyAudit();
    expect(() => assertCatalogDelta(before, { ...before, rowCounts: [{ schema: "private", table: "existing_equipment", rows: 0 }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [{ schema: "private", name: "existing_equipment", owner: "foreign" }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [...before.tables, { schema: "private", name: "undeclared", owner: "postgres" }] })).toThrow();
    expect(() => assertCatalogDelta(before, { ...before, tables: [...before.tables, { schema: "private", name: "character_action_receipts", owner: "postgres" }],
      rowCounts: [...before.rowCounts, { schema: "private", table: "character_action_receipts", rows: 0 }] })).not.toThrow();
  });
  it("binds every complete frozen function body/owner/security flag, not successful metadata alone", () => {
    const sql = STAGES.map(file => readFileSync(file, "utf8"));
    const expected = expectedFunctionMetadata(sql);
    expect(expected.length).toBeGreaterThan(20);
    const rows = expected.map(row => ({ ...row, definition_md5: "a".repeat(32), execute: expectedExecuteMatrix(5, row), acl_grantees: Object.entries(expectedExecuteMatrix(5, row)).filter(([, allowed]) => allowed).map(([role]) => role).sort() }));
    expect(() => assertFunctionMetadata(sql, rows)).not.toThrow();
    expect(() => assertFunctionMetadata(sql, rows.slice(1))).toThrow();
    expect(() => assertFunctionMetadata(sql, rows.map((row, index) => index ? row : { ...row, source_md5: "b".repeat(32) }))).toThrow();
    expect(() => assertFunctionMetadata(sql, rows.map((row, index) => index ? row : { ...row, owner: "postgres" }))).toThrow();
  });
  it.each([1, 2, 3, 4, 5])("admits the full stage %i typed matrix; rejects PUBLIC/caller/extra and missing bridges", stage => {
    const sql = STAGES.slice(0, stage).map(file => readFileSync(file, "utf8"));
    const rows = expectedFunctionMetadata(sql).map(row => ({ ...row, definition_md5: "a".repeat(32), execute: expectedExecuteMatrix(stage, row), acl_grantees: Object.entries(expectedExecuteMatrix(stage, row)).filter(([, allowed]) => allowed).map(([role]) => role).sort() }));
    expect(() => assertFunctionMetadata(sql, rows)).not.toThrow();
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      const changed = structuredClone(rows); changed[0].execute[role] = true;
      expect(() => assertFunctionMetadata(sql, changed)).toThrow("EXECUTE matrix");
    }
    const missing = structuredClone(rows); delete missing[0].execute.PUBLIC;
    expect(() => assertFunctionMetadata(sql, missing)).toThrow("EXECUTE matrix");
    const extra = structuredClone(rows); extra[0].execute.foreign_owner = false;
    expect(() => assertFunctionMetadata(sql, extra)).toThrow("EXECUTE matrix");
    const foreignAcl = structuredClone(rows); foreignAcl[0].acl_grantees.push("foreign_owner"); foreignAcl[0].acl_grantees.sort();
    expect(() => assertFunctionMetadata(sql, foreignAcl)).toThrow("ACL inventory");
    const missingAcl = structuredClone(rows); missingAcl[0].acl_grantees = [];
    expect(() => assertFunctionMetadata(sql, missingAcl)).toThrow("ACL inventory");
    const malformed = structuredClone(rows) as unknown as { execute: Record<string, unknown> }[]; malformed[0].execute.PUBLIC = "false";
    expect(() => assertFunctionMetadata(sql, malformed)).toThrow("EXECUTE matrix");
    if (stage >= 4) {
      for (const name of ["class_origin_metadata_delta_v1", "class_origin_consume_metadata_revision_v1", "class_origin_assert_metadata_revision_v1"]) {
        const row = rows.find(value => value.name === name)!;
        expect(row.argument_types).toEqual(["pg_catalog.uuid"]);
        expect(row.execute.inkborne_hit_die_authority_owner).toBe(true);
        const changed = structuredClone(rows); changed.find(value => value.name === name)!.execute.inkborne_hit_die_authority_owner = false;
        expect(() => assertFunctionMetadata(sql, changed)).toThrow("EXECUTE matrix");
      }
      const changed = structuredClone(rows); changed.find(value => value.name === "class_origin_finalize_transition_v1")!.execute.inkborne_hit_die_authority_owner = true;
      expect(() => assertFunctionMetadata(sql, changed)).toThrow("EXECUTE matrix");
    }
    if (stage === 5) {
      for (const [name, role] of [["class_confirmation_private_inputs_v1", "inkborne_hit_die_authority_owner"], ["lock_class_confirmation_sources_v1", "inkborne_class_origin_owner"]]) {
        expect(rows.find(value => value.name === name)!.execute[role]).toBe(true);
        const changed = structuredClone(rows); changed.find(value => value.name === name)!.execute[role] = false;
        expect(() => assertFunctionMetadata(sql, changed)).toThrow("EXECUTE matrix");
      }
    }
    const wrongType = structuredClone(rows); wrongType[0].argument_types = ["pg_catalog.int8"];
    expect(() => assertFunctionMetadata(sql, wrongType)).toThrow("metadata mismatch");
  });
});

// MODEL ONLY: isolated temporary Git/filesystem + injected transport/OS responses.
// The existing freezeSource/approval/lineage/runtime/pipeline guards remain real.
// This does not create genuine approval, native receipts, Docker or database state.
type Lineage = Parameters<typeof validateLineage>[0];
type EvidenceFiles = Parameters<typeof freezeCore>[1];
type ModelAudit = { database: string; actor: string; tables: { schema: string; name: string; owner: string }[];
  extensions: unknown[]; roles: unknown[]; functions: unknown[]; triggers: unknown[]; policies: unknown[];
  table_grants: unknown[]; rowCounts: { schema: string; table: string; rows: number }[] };
const projectRoot = process.cwd();
let ownedTemp: string, tempRoot: string, model: ModelBindings, files: EvidenceFiles, lineage: Lineage;
const git = (args: string[]) => execFileSync("git", args, { cwd: tempRoot, encoding: "utf8", windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(ownedTemp, "empty-git-config") } }).trim();
function commitModel(message: string) { git(["add", "--all"]); git(["-c", "core.autocrlf=false", "commit", "--quiet", "-m", "MODEL ONLY " + message]); }
function modelAudit(count = 2): ModelAudit {
  const tables = Array.from({ length: count }, (_, index) => ({ schema: "public", name: "model_existing_" + index, owner: "postgres" }));
  return { database: "postgres", actor: "postgres", tables, extensions: [], roles: [], functions: [], triggers: [], policies: [], table_grants: [],
    rowCounts: tables.map(table => ({ schema: table.schema, table: table.name, rows: 0 })) };
}
function modelApproval(value: CoreManifest): CoreApproval {
  return { ...approval(), sourceSha: value.sourceSha, manifestSha256: coreManifestHash(value) };
}
function writeEvidence(value: Lineage) {
  for (const key of Object.keys(files) as (keyof EvidenceFiles)[]) {
    const entry = key === "equipmentManifest" ? { manifest: value[key], manifestSha256: manifestHash(value[key]) }
      : key === "fixtureManifest" ? { manifest: value[key], manifestSha256: fixtureManifestHash(value[key]) } : value[key];
    writeFileSync(files[key], JSON.stringify(entry));
  }
}
function makeLineage(count = 2): Lineage {
  const equipmentManifest = freezeSource(tempRoot);
  const equipmentApproval: RuntimeApproval = { gate: "G2", scope: equipmentManifest.scope, approvedBy: "Victor",
    approvedAtUTC: "2026-10-13T17:00:00Z", sourceSha: equipmentManifest.sourceSha, manifestSha256: manifestHash(equipmentManifest), ...resourceIds };
  const receipt = (phase: Journal["phase"], names: string[], audits: number): Journal => ({
    phase, sourceSha: equipmentManifest.sourceSha, manifestSha256: manifestHash(equipmentManifest), containerId: resourceIds.containerId,
    complete: true, steps: names.map(name => ({ name, outcome: "passed", exitCode: 0 })), audits: Array.from({ length: audits }, () => modelAudit(count)),
  });
  const baseline = receipt("baseline", ["official-bootstrap-preflight", ...equipmentManifest.migrations.map(file => file.path), "baseline-assertions"], 1);
  const equipmentStage = receipt("stage", ["baseline-assertions", "stage-must-be-absent", "supabase/staged/starting-equipment-transaction.sql", "stage-assertions"], 2);
  const fixtureManifest: FixtureManifest = { version: 1, scope: "R07.2-real-role-fixtures", sourceSha: equipmentManifest.sourceSha,
    source: equipmentManifest, target: TARGET, files: FIXTURE_FILES.map(file => ({ path: file, sha256: sha256(readFileSync(path.join(tempRoot, file))) })),
    run: RUN, fixtureIds: ROOT_IDS, budgets: BUDGETS, limits: RUNTIME_LIMITS,
    predecessor: { manifestSha256: manifestHash(equipmentManifest), approvalSha256: fixtureManifestHash(equipmentApproval),
      baselineSha256: fixtureManifestHash(baseline), stageSha256: fixtureManifestHash(equipmentStage), sourceSha: equipmentManifest.sourceSha, ...resourceIds } };
  const fixtureApproval: FixtureApproval = { ...equipmentApproval, scope: fixtureManifest.scope,
    manifestSha256: fixtureManifestHash(fixtureManifest), operations: ["fixtures", "cleanup"] };
  const common: Omit<FixtureJournal, "steps" | "audits" | "status"> = { version: 1, scope: fixtureManifest.scope,
    sourceSha: fixtureManifest.sourceSha, manifestSha256: fixtureManifestHash(fixtureManifest), containerId: resourceIds.containerId,
    state: { ids: Object.fromEntries(Object.keys(BUDGETS).map(key => [key, []])) as FixtureJournal["state"]["ids"] }, processes: [] };
  const fixtureComplete: FixtureJournal = { ...common, status: "fixtures-complete",
    steps: ["preflight", ...PHASES].map(phase => ({ phase, outcome: "passed" })),
    audits: Array.from({ length: PHASES.length + 2 }, () => modelAudit(count)) };
  const cleanup: FixtureJournal = { ...structuredClone(common), status: "cleaned", steps: [...fixtureComplete.steps, { phase: "cleanup", outcome: "passed" }],
    audits: [...structuredClone(fixtureComplete.audits), modelAudit(count)] };
  return { equipmentManifest, equipmentApproval, baseline, equipmentStage, fixtureManifest, fixtureApproval, fixtureComplete, cleanup };
}
beforeAll(() => {
  ownedTemp = mkdtempSync(path.join(os.tmpdir(), "core-profile-model-"));
  tempRoot = path.join(ownedTemp, "source");
  mkdirSync(tempRoot); mkdirSync(path.join(ownedTemp, "hooks")); writeFileSync(path.join(ownedTemp, "empty-git-config"), "");
  const known = ["supabase/staged/starting-equipment-transaction.sql", "docs/specs/2026-10-12-equipment-runtime.compose.yaml", "scripts/equipment-runtime.ts",
    ...["bootstrap-preflight", "baseline-assertions", "stage-assertions", "catalog-audit"].map(name => "scripts/equipment-runtime/" + name + ".sql"),
    ...FIXTURE_FILES, ...STAGES, "scripts/core-db-verification.ts", "scripts/core-db-verification/preflight.sql", "scripts/core-db-verification/disabled-assertions.sql",
    "tests/scripts/core-db-verification.test.ts", "tests/supabase/core-db-disabled-profile-contract.test.ts",
    ...readdirSync(path.join(projectRoot, "supabase/migrations")).filter(name => name.endsWith(".sql")).map(name => "supabase/migrations/" + name)];
  for (const relative of new Set(known)) {
    const destination = path.join(tempRoot, relative); mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(projectRoot, relative), destination);
  }
  git(["init", "--quiet"]); git(["config", "core.autocrlf", "false"]); git(["config", "core.hooksPath", path.join(ownedTemp, "hooks")]);
  git(["config", "commit.gpgsign", "false"]); git(["config", "user.name", "MODEL ONLY"]); git(["config", "user.email", "model@example.invalid"]);
  commitModel("isolated source");
  const scratch = path.join(ownedTemp, "synthetic-scratch");
  for (const directory of ["evidence", "bootstrap", "sql"]) mkdirSync(path.join(scratch, directory), { recursive: true });
  const bootstrap = "-- MODEL ONLY; never a native bootstrap or authority\n";
  writeFileSync(path.join(scratch, "bootstrap/99-roles.sql"), bootstrap);
  copyFileSync(path.join(tempRoot, "scripts/equipment-runtime/catalog-audit.sql"), path.join(scratch, "sql/known-original-audit.sql"));
  model = { kind: "injected-model", scratch, bootstrapSha256: sha256(bootstrap) };
  files = Object.fromEntries(["equipmentManifest", "equipmentApproval", "baseline", "equipmentStage", "fixtureManifest", "fixtureApproval", "fixtureComplete", "cleanup"]
    .map(key => [key, path.join(scratch, "evidence", "MODEL-ONLY-" + key + ".json")])) as EvidenceFiles;
  lineage = makeLineage(); writeEvidence(lineage);
}, 30_000);
afterAll(() => {
  if (!ownedTemp) return;
  const resolved = realpathSync(ownedTemp), parent = realpathSync(os.tmpdir());
  if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith("core-profile-model-")) throw Error("Refuse unexpected model cleanup target");
  rmSync(resolved, { recursive: true, force: true });
});
describe("actual exported lineage/freeze in isolated model Git; no native authority", () => {
  it("validates complete modeled history and freezes actual committed source/raw refs", () => {
    expect(() => validateLineage(lineage)).not.toThrow();
    const value = freezeCore(tempRoot, files, model);
    expect(value.execution).toBe("injected-model"); expect(value.equipment.migrations).toHaveLength(83);
    expect(value.sourceSha).toBe(git(["rev-parse", "HEAD"]));
    expect(value.predecessor.cleanup.sha256).toBe(sha256(readFileSync(files.cleanup)));
    expect(value.mounts.bootstrap.sha256).toBe(model.bootstrapSha256);
    expect(value.files.every(file => /^[a-f0-9]{40}$/.test(file.gitBlob) && /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });
  it.each(["history-hash", "cleanup-status", "audit-prefix", "target", "fixture-id", "phase-order"] as const)("rejects one modeled lineage mutation: %s", kind => {
    const changed = structuredClone(lineage);
    if (kind === "history-hash") changed.fixtureManifest.predecessor.stageSha256 = "f".repeat(64);
    if (kind === "cleanup-status") changed.cleanup.status = "fixtures-complete";
    if (kind === "audit-prefix") changed.cleanup.audits[1].rowCounts[0].rows = 1;
    if (kind === "target") changed.equipmentManifest.target = { ...TARGET, context: "wrong" } as unknown as typeof TARGET;
    if (kind === "fixture-id") changed.cleanup.state.ids["public.characters"] = ["bad-id"];
    if (kind === "phase-order") changed.fixtureComplete.steps.reverse();
    expect(() => validateLineage(changed)).toThrow();
  });
  it("rejects missing and raw-reformatted immutable evidence through real freeze", () => {
    expect(() => freezeCore(tempRoot, { ...files, cleanup: files.cleanup + ".missing" }, model)).toThrow();
    const original = readFileSync(files.equipmentManifest);
    try {
      const envelope = JSON.parse(original.toString()); envelope.manifestSha256 = "f".repeat(64);
      writeFileSync(files.equipmentManifest, JSON.stringify(envelope));
      expect(() => freezeCore(tempRoot, files, model)).toThrow("envelope hash");
    } finally { writeFileSync(files.equipmentManifest, original); }
  });
  it("rejects out-of-scratch evidence and an uncommitted working source without transport", () => {
    const outside = path.join(ownedTemp, "MODEL-outside.json"); writeFileSync(outside, readFileSync(files.cleanup));
    expect(() => freezeCore(tempRoot, { ...files, cleanup: outside }, model)).toThrow("bounded scratch");
    const dirty = path.join(tempRoot, "scripts/equipment-runtime.ts"), original = readFileSync(dirty);
    try {
      writeFileSync(dirty, Buffer.concat([original, Buffer.from("\n--MODEL dirty\n")]));
      expect(() => freezeCore(tempRoot, files, model)).toThrow("committed and clean");
    } finally { writeFileSync(dirty, original); }
  });
  it("rejects committed protected-byte and unknown mounted-byte changes; restores exact source", () => {
    const relative = "scripts/equipment-runtime/catalog-audit.sql", protectedFile = path.join(tempRoot, relative), original = readFileSync(protectedFile);
    try {
      writeFileSync(protectedFile, Buffer.concat([original, Buffer.from("\n-- MODEL changed byte\n")])); commitModel("protected byte mutation");
      expect(() => freezeCore(tempRoot, files, model)).toThrow("original equipment helper");
    } finally { writeFileSync(protectedFile, original); commitModel("exact protected byte restore"); }
    expect(sha256(readFileSync(protectedFile))).toBe(sha256(original));
    const mounted = path.join(model.scratch, "sql/unreviewed.sql");
    try { writeFileSync(mounted, "-- MODEL unknown\n"); expect(() => freezeCore(tempRoot, files, model)).toThrow("unreviewed scratch"); }
    finally { rmSync(mounted); }
    expect(() => freezeCore(tempRoot, files, { ...model, bootstrapSha256: "f".repeat(64) })).toThrow("bootstrap bytes");
  });
});

function runtimeResult(command: Command): Result {
  const args = command.args, format = args[args.indexOf("--format") + 1];
  let value: unknown;
  if (args.includes("info")) value = resourceIds.engineId;
  else if (args.includes("image")) value = { id: resourceIds.imageId, digests: [TARGET.image], os: "linux", architecture: "amd64" };
  else if (args.includes("network")) value = format === "{{json .Containers}}" ? { [resourceIds.containerId]: { Name: TARGET.containerName } }
    : { id: resourceIds.networkId, name: TARGET.networkName, internal: true };
  else if (format.includes('"memory"')) value = { id: resourceIds.containerId, memory: 1073741824, cpus: 1000000000, pids: 256, restart: "no" };
  else value = { id: resourceIds.containerId, name: "/" + TARGET.containerName, imageId: resourceIds.imageId, running: true,
    project: TARGET.prefix, service: "db", ports: null, networks: { [TARGET.networkName]: { NetworkID: resourceIds.networkId } },
    mounts: [
      { Type: "volume", Name: TARGET.volumes[0], Destination: "/var/lib/postgresql/data", RW: true },
      { Type: "volume", Name: TARGET.volumes[1], Destination: "/etc/postgresql-custom", RW: true },
      { Type: "bind", Source: TARGET.scratch + "\\bootstrap\\99-roles.sql", Destination: "/docker-entrypoint-initdb.d/init-scripts/99-roles.sql", RW: false },
      { Type: "bind", Source: TARGET.scratch + "\\sql", Destination: "/e1-sql", RW: false },
    ] };
  return { code: 0, stdout: JSON.stringify(value) };
}
describe("actual verifyCoreRuntime via modeled transport; no real metadata queries", () => {
  it("checks all six independent runtime/resource objects", async () => {
    const transport = vi.fn(async (command: Command) => runtimeResult(command));
    await expect(verifyCoreRuntime(transport, approval())).resolves.toBeUndefined();
    expect(transport).toHaveBeenCalledTimes(6);
  });
  it.each(["engine", "container", "image", "network", "cap", "endpoint", "malformed"] as const)("refuses modeled %s metadata drift", async kind => {
    const transport: Transport = async command => {
      const result = runtimeResult(command); const value = JSON.parse(result.stdout), args = command.args;
      if (kind === "engine" && args.includes("info")) return { ...result, stdout: JSON.stringify("engine:foreign") };
      if (kind === "container" && typeof value === "object" && value.service) value.id = "f".repeat(64);
      if (kind === "image" && args.includes("image")) value.digests = [];
      if (kind === "network" && value.internal === true) value.internal = false;
      if (kind === "cap" && value.memory) value.memory = 0;
      if (kind === "endpoint" && args.includes("{{json .Containers}}")) value.foreign = { Name: "foreign" };
      if (kind === "malformed" && args.includes("info")) return { ...result, stdout: "not JSON" };
      return { ...result, stdout: JSON.stringify(value) };
    };
    await expect(verifyCoreRuntime(transport, approval())).rejects.toThrow();
  });
});
type PipelineFault = "none" | "stage-D2" | "missing-D4-bridge" | "extra-finalizer" | "malformed-matrix" | "object" | "cap" | "after-exit" | "fast-child" | "time" | "evidence" | "journal" | "commands";
function pipeline(fault: PipelineFault = "none") {
  const selectedLineage = fault === "commands" ? makeLineage(100) : lineage;
  writeEvidence(selectedLineage);
  let time = 1000;
  const binding: ModelBindings = { ...model, now: () => time };
  const value = freezeCore(tempRoot, files, binding), commands: Command[] = [], records: ReturnType<typeof runtimeProcessRecords> = [];
  const journals: CoreJournal[] = [], sqlStages = STAGES.map(file => readFileSync(path.join(tempRoot, file), "utf8"));
  const auditSql = readFileSync(path.join(tempRoot, "scripts/equipment-runtime/catalog-audit.sql"), "utf8");
  const transport: Transport = async command => {
    commands.push(command);
    const record = { pid: 20000 + commands.length, parentPid: process.pid, cwd: process.cwd(), executable: "MODEL_BOUNDARY",
      args: command.args, startedUTC: "2026-10-13T17:00:00Z" }; records.push(record);
    let result: Result = runtimeResult(command);
    const sql = command.stdin;
    if (sql !== undefined) {
      if (sql === auditSql) {
        const audit = modelAudit(fault === "commands" ? 100 : 2);
        result = { code: 0, stdout: JSON.stringify(fault === "evidence" ? { ...audit, modelPadding: "x".repeat(1900 * 1024) } : audit) };
      } else if (/^BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT count\(\*\) FROM "/.test(sql)) result = { code: 0, stdout: "0" };
      else if (sql.includes("SET inkborne.core.stage=")) {
        const stage = Number(/SET inkborne\.core\.stage='(\d)'/.exec(sql)![1]);
        const metadata = expectedFunctionMetadata(sqlStages.slice(0, stage)).map(row => ({ ...row, definition_md5: "a".repeat(32), execute: expectedExecuteMatrix(stage, row), acl_grantees: Object.entries(expectedExecuteMatrix(stage, row)).filter(([, allowed]) => allowed).map(([role]) => role).sort() }));
        if (stage === 4 && fault === "missing-D4-bridge") metadata.find(row => row.name === "class_origin_metadata_delta_v1")!.execute.inkborne_hit_die_authority_owner = false;
        if (stage === 4 && fault === "extra-finalizer") metadata.find(row => row.name === "class_origin_finalize_transition_v1")!.execute.inkborne_hit_die_authority_owner = true;
        if (fault === "malformed-matrix") delete metadata[0].execute.PUBLIC;
        const constraints = fault === "evidence" ? [{ definition: "MODEL nonsecret padding " + "x".repeat(256 * 1024) }] : [];
        result = { code: 0, stdout: JSON.stringify({ profile: PROFILE, stage, passed: true, database: "postgres", actor: "postgres", backend_pid: 123, constraints, metadata }) };
      } else if (sqlStages.includes(sql)) {
        const index = sqlStages.indexOf(sql);
        if (fault === "stage-D2" && index === 1) result = { code: 1, stdout: "", stderr: "ERROR: 23514 MODEL failure after exit" };
        else result = { code: 0, stdout: "" };
        if (fault === "time" && index === 0) time += LIMITS.durationMs + 1;
      } else result = { code: 0, stdout: JSON.stringify({ profile: PROFILE, phase: "preflight", passed: true }) };
    } else if (fault === "object" && command.args.includes("info")) result.stdout = JSON.stringify("engine:foreign");
    else if (fault === "cap" && result.stdout.includes('"memory"')) result.stdout = JSON.stringify({ ...JSON.parse(result.stdout), cpus: 0 });
    await Promise.resolve(); Object.assign(record, { finishedUTC: "2026-10-13T17:00:01Z" });
    if (fault === "after-exit" && sql === sqlStages[1]) throw Error("MODEL rejected after child exit");
    return result;
  };
  const captures = new Map<number, number>();
  const observer = { resources: () => ({ kind: "injected-model", processCount: 0, listeners: 0 }), capture: (pid: number): OsIdentity | null => {
    const n = (captures.get(pid) ?? 0) + 1; captures.set(pid, n);
    if (fault === "fast-child" || n > 1) return null;
    const record = records.find(record => record.pid === pid)!;
    return { pid, parentPid: process.pid, birthUtc: "2026-10-13T17:00:00.0000000Z", command: "MODEL_BOUNDARY " + record.args.join(" ") };
  } };
  const save = (journal: CoreJournal) => {
    // Retain first and newest receipts only; padding-budget controls must not
    // multiply snapshots into an unrelated large-memory verification job.
    const snapshot = structuredClone(journal);
    if (journals.length < 2) journals.push(snapshot); else journals[1] = snapshot;
    if (fault === "journal" && journal.steps.some(step => step.name === STAGES[1] && step.outcome === "passed")) throw Error("MODEL evidence sink unavailable");
  };
  const options = { root: tempRoot, manifest: value, approval: modelApproval(value), confirmation: coreManifestHash(value),
    transport, observer, records: () => structuredClone(records), model: binding, save };
  return { options, commands, journals, sqlStages };
}
describe("actual executeCore pipeline with injected MODEL boundaries; not native approval/SQL", () => {
  it("freezes and validates full lineage, all five stages/matrices, resources and owned readbacks", async () => {
    const run = pipeline();
    const result = await executeCore(run.options);
    expect(result).toMatchObject({ execution: "injected-model", status: "disabled-installed", resourcesAfter: { kind: "injected-model" } });
    expect(result.assertions).toHaveLength(5); expect(result.audits).toHaveLength(6);
    expect(run.sqlStages.map(sql => run.commands.filter(command => command.stdin === sql).length)).toEqual([1, 1, 1, 1, 1]);
    expect(result.processes.length).toBe(run.commands.length);
    expect(result.processes.every(record => record.osIdentity && record.absent && record.finishedUTC)).toBe(true);
    expect(run.journals[0]).toMatchObject({ status: "incomplete", processes: [] });
  });
  it.each(["stage-D2", "missing-D4-bridge", "extra-finalizer", "malformed-matrix", "object", "cap", "after-exit", "fast-child", "time", "evidence", "journal", "commands"] as const)(
    "retains the first incomplete/uncertain receipt and makes no later stage command: %s", async fault => {
      const run = pipeline(fault);
      await expect(executeCore(run.options)).rejects.toThrow("uncertain");
      const attempted = run.sqlStages.map(sql => run.commands.filter(command => command.stdin === sql).length);
      expect(attempted.every(count => count <= 1)).toBe(true); expect(attempted[4]).toBe(0);
      if (["stage-D2", "after-exit", "journal"].includes(fault)) expect(attempted).toEqual([1, 1, 0, 0, 0]);
      if (["missing-D4-bridge", "extra-finalizer"].includes(fault)) expect(attempted).toEqual([1, 1, 1, 1, 0]);
      if (["object", "cap", "fast-child"].includes(fault)) expect(attempted).toEqual([0, 0, 0, 0, 0]);
      if (["time", "malformed-matrix"].includes(fault)) expect(attempted).toEqual([1, 0, 0, 0, 0]);
      expect(run.journals.length).toBeGreaterThan(0);
      expect(run.journals.at(-1)!.status).not.toBe("disabled-installed");
      if (fault !== "evidence") expect(run.journals.at(-1)!.status).toBe("uncertain");
      if (fault === "commands") expect(run.commands).toHaveLength(LIMITS.commands);
      if (fault === "after-exit") expect(run.journals.at(-1)!.processes.at(-1)).toMatchObject({ absent: true, finishedUTC: "2026-10-13T17:00:01Z" });
      if (fault === "stage-D2") expect(run.journals.at(-1)!.steps.at(-1)).toMatchObject({ name: STAGES[1], outcome: "uncertain", sqlstate: "23514" });
      writeEvidence(lineage);
    });
  it("refuses changed raw predecessor bytes, despite semantically identical JSON, before transport", async () => {
    const run = pipeline(), original = readFileSync(files.cleanup);
    try {
      writeFileSync(files.cleanup, JSON.stringify(JSON.parse(original.toString()), null, 2));
      await expect(executeCore(run.options)).rejects.toThrow("byte/order drift");
      expect(run.commands).toHaveLength(0); expect(run.journals).toHaveLength(0);
    } finally { writeFileSync(files.cleanup, original); }
  });
  it("refuses wrong targets/budgets and injected-model use of either native adapter before transport", async () => {
    const run = pipeline();
    for (const adapter of [{ transport: actualTransport }, { observer: nativeObserver }, { model: undefined }]) {
      await expect(executeCore({ ...run.options, ...adapter })).rejects.toThrow("cannot use native adapters");
    }
    for (const changed of [
      { ...run.options.manifest, limits: { ...LIMITS, commands: 501 } },
      { ...run.options.manifest, target: { ...TARGET, context: "default" } },
    ]) {
      const value = changed as CoreManifest;
      await expect(executeCore({ ...run.options, manifest: value, approval: modelApproval(value), confirmation: coreManifestHash(value) })).rejects.toThrow("actual separate human G2");
    }
    expect(run.commands).toHaveLength(0); expect(run.journals).toHaveLength(0);
  });
});
