/** Additive disabled-install profile. No Docker startup, bootstrap, fixture writer or cutover. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  TARGET, actualTransport, auditCounts, freezeSource, manifestHash, psql,
  runtimeProcessRecords, sha256, validateApproval, verifyRuntime,
  type Command, type FrozenManifest, type Journal, type RuntimeApproval, type Transport,
} from "./equipment-runtime";
import {
  BUDGETS, FIXTURE_FILES, PHASES, ROOT_IDS, RUN, RUNTIME_LIMITS,
  fixtureManifestHash, validateFixtureApproval, validateState,
  type FixtureApproval, type FixtureJournal, type FixtureManifest,
} from "./equipment-runtime-fixtures";

export const PROFILE = "core-db-disabled-install-v1" as const;
export const LIMITS = { durationMs: 900_000, commands: 500, evidenceBytes: 10 * 1024 * 1024 } as const;
export const STAGES = [
  "supabase/staged/hit-die-transaction.sql", "supabase/staged/hit-die-authority-and-writers.sql",
  "supabase/staged/class-origin-producer.sql", "supabase/staged/class-origin-joint-revision.sql",
  "supabase/staged/class-origin-confirmation-producer.sql",
] as const;
const OWN_FILES = ["scripts/core-db-verification.ts", "scripts/core-db-verification/preflight.sql",
  "scripts/core-db-verification/disabled-assertions.sql", "tests/scripts/core-db-verification.test.ts",
  "tests/supabase/core-db-disabled-profile-contract.test.ts"];
export const EVIDENCE_KEYS = ["equipmentManifest", "equipmentApproval", "baseline", "equipmentStage",
  "fixtureManifest", "fixtureApproval", "fixtureComplete", "cleanup"] as const;
type Key = typeof EVIDENCE_KEYS[number];
type Files = Record<Key, string>;
type FrozenFile = { path: string; sha256: string; gitBlob: string };
type Reference = { absolutePath: string; sha256: string; bytes: number };
type Audit = { rowCounts: { schema: string; table: string; rows: number }[]; [key: string]: unknown };
type Lineage = {
  equipmentManifest: FrozenManifest; equipmentApproval: RuntimeApproval; baseline: Journal; equipmentStage: Journal;
  fixtureManifest: FixtureManifest; fixtureApproval: FixtureApproval; fixtureComplete: FixtureJournal; cleanup: FixtureJournal;
};
export type CoreManifest = {
  execution: "native" | "injected-model";
  contractVersion: 1; scope: typeof PROFILE; sourceSha: string; target: typeof TARGET;
  limits: typeof LIMITS; equipment: FrozenManifest; files: FrozenFile[];
  predecessor: Record<Key, Reference>; resourceIds: { engineId: string; containerId: string; imageId: string; networkId: string };
  mounts: { bootstrap: Reference; sqlDirectory: string; files: { relativePath: string; sha256: string; sourcePath: string }[] };
};
export type CoreApproval = Omit<RuntimeApproval, "scope"> & {
  scope: typeof PROFILE; operations: ["install-disabled-stages", "verify-disabled-stages"];
};
export type OsIdentity = { pid: number; parentPid: number; birthUtc: string; command: string };
export type OsObserver = {
  capture: (pid: number) => OsIdentity | null;
  resources: () => unknown;
};
type ProcessEvidence = ReturnType<typeof runtimeProcessRecords>[number] & { osIdentity?: OsIdentity; absent?: boolean; resultCode?: number; sqlstate?: string };
export type CoreJournal = {
  execution: CoreManifest["execution"];
  contractVersion: 1; scope: typeof PROFILE; sourceSha: string; manifestSha256: string;
  resourceIds: CoreManifest["resourceIds"]; status: "incomplete" | "uncertain" | "disabled-installed";
  steps: { name: string; outcome: "started" | "passed" | "uncertain"; sqlstate?: string }[];
  audits: Audit[]; assertions: unknown[]; processes: ProcessEvidence[];
  resourcesBefore?: unknown; resourcesAfter?: unknown; limits: typeof LIMITS;
};
export type ModelBindings = { kind: "injected-model"; scratch: string; bootstrapSha256: string; now?: () => number };
const refuse = (message: string): never => { throw new Error("Core profile refusal: " + message); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) refuse("malformed nonsecret evidence");
  return value as Record<string, unknown>;
};
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJson((value as Record<string, unknown>)[key])).join(",") + "}";
  return refuse("unsupported canonical JSON value");
}
export const coreManifestHash = (value: CoreManifest) => sha256(canonicalJson(value));
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function sourceBytes(root: string, relative: string): Buffer {
  if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.includes("..") || path.isAbsolute(relative)) refuse("unsafe source path");
  const base = realpathSync(root), resolved = path.join(base, relative);
  if (!lstatSync(resolved).isFile() || lstatSync(resolved).isSymbolicLink() || !realpathSync(resolved).startsWith(base + path.sep)) refuse("source symlink/escape");
  return readFileSync(resolved);
}
function evidenceBytes(file: string, model?: ModelBindings): Buffer {
  const base = realpathSync(path.join(model?.scratch ?? TARGET.scratch, "evidence")), resolved = realpathSync(file);
  if (path.extname(resolved) !== ".json" || lstatSync(file).isSymbolicLink() || !resolved.startsWith(base + path.sep)) refuse("existing bounded scratch evidence required");
  const bytes = readFileSync(file);
  if (bytes.length > 2 * 1024 * 1024) refuse("input evidence budget exceeded");
  return bytes;
}
function evidence(file: string): unknown {
  try { return JSON.parse(evidenceBytes(file).toString("utf8").replace(/^\uFEFF/, "")); }
  catch { return refuse("bounded JSON evidence unavailable"); }
}
function manifestEnvelope(value: unknown): unknown {
  const envelope = object(value);
  if (!equal(Object.keys(envelope).sort(), ["manifest", "manifestSha256"])) refuse("original manifest envelope required");
  return envelope.manifest;
}
function sameAudit(a: Audit, b: Audit): boolean {
  return ["extensions", "roles", "tables", "functions", "triggers", "policies", "table_grants", "rowCounts"].every(key => equal(a[key], b[key]));
}
export function validateLineage(lineage: Lineage): void {
  const m = lineage.equipmentManifest, approval = lineage.equipmentApproval;
  validateApproval(m, approval, manifestHash(m));
  if (m.scope !== "R07.1-baseline-and-stage" || m.version !== 1 || !equal(m.target, TARGET)) refuse("original equipment scope/target");
  const receipt = (value: Journal, phase: Journal["phase"], names: string[], audits: number) => {
    if (!value.complete || value.phase !== phase || value.sourceSha !== m.sourceSha || value.manifestSha256 !== manifestHash(m)
      || value.containerId !== approval.containerId || value.audits.length !== audits
      || !equal(value.steps.map(step => step.name), names) || value.steps.some(step => step.outcome !== "passed" || step.exitCode !== 0)) refuse("original full equipment receipt required");
  };
  receipt(lineage.baseline, "baseline", ["official-bootstrap-preflight", ...m.migrations.map(file => file.path), "baseline-assertions"], 1);
  receipt(lineage.equipmentStage, "stage", ["baseline-assertions", "stage-must-be-absent", "supabase/staged/starting-equipment-transaction.sql", "stage-assertions"], 2);
  if (!sameAudit(lineage.baseline.audits[0] as Audit, lineage.equipmentStage.audits[0] as Audit)) refuse("original equipment catalog lineage");
  const f = lineage.fixtureManifest, fa = lineage.fixtureApproval;
  validateFixtureApproval(f, fa, fixtureManifestHash(f));
  if (f.version !== 1 || f.scope !== "R07.2-real-role-fixtures" || !equal(f.target, TARGET) || f.run !== RUN
    || f.source.version !== 1 || f.source.scope !== m.scope || f.source.sourceSha !== f.sourceSha || !equal(f.source.target, TARGET)
    || !equal(f.fixtureIds, ROOT_IDS) || !equal(f.budgets, BUDGETS) || !equal(f.limits, RUNTIME_LIMITS)
    || f.predecessor.manifestSha256 !== manifestHash(m) || f.predecessor.approvalSha256 !== fixtureManifestHash(approval)
    || f.predecessor.baselineSha256 !== fixtureManifestHash(lineage.baseline) || f.predecessor.stageSha256 !== fixtureManifestHash(lineage.equipmentStage)
    || f.predecessor.sourceSha !== m.sourceSha
    || !equal([fa.engineId, fa.containerId, fa.imageId, fa.networkId], [approval.engineId, approval.containerId, approval.imageId, approval.networkId])) refuse("original fixture source/target lineage");
  const common = (value: FixtureJournal, status: FixtureJournal["status"], names: string[], audits: number) => {
    validateState(value.state);
    if (value.version !== 1 || value.scope !== f.scope || value.status !== status || value.sourceSha !== f.sourceSha
      || value.manifestSha256 !== fixtureManifestHash(f) || value.containerId !== approval.containerId || value.audits.length !== audits
      || !equal(value.steps.map(step => step.phase), names) || value.steps.some(step => step.outcome !== "passed")) refuse("original fixture/cleanup receipt required");
  };
  common(lineage.fixtureComplete, "fixtures-complete", ["preflight", ...PHASES], PHASES.length + 2);
  common(lineage.cleanup, "cleaned", ["preflight", ...PHASES, "cleanup"], PHASES.length + 3);
  if (!equal(lineage.fixtureComplete.state, lineage.cleanup.state)
    || !sameAudit(lineage.fixtureComplete.audits[0], lineage.equipmentStage.audits[1] as Audit)
    || !equal(lineage.cleanup.audits.slice(0, -1), lineage.fixtureComplete.audits)
    || !sameAudit(lineage.fixtureComplete.audits.at(-1)!, lineage.cleanup.audits.at(-2)!)
    || !sameAudit(lineage.cleanup.audits.at(-1)!, lineage.equipmentStage.audits[1] as Audit)) refuse("confirmed exact fixture cleanup lineage");
}
function freezeMounts(root: string, sqlFiles: string[], model?: ModelBindings): CoreManifest["mounts"] {
  const selected = model?.scratch ?? TARGET.scratch;
  const scratch = realpathSync(selected), bootstrapFile = path.join(scratch, "bootstrap", "99-roles.sql");
  if (lstatSync(selected).isSymbolicLink() || lstatSync(bootstrapFile).isSymbolicLink()) refuse("scratch/bootstrap symlink refused");
  const bootstrapBytes = readFileSync(bootstrapFile);
  if (sha256(bootstrapBytes) !== (model?.bootstrapSha256 ?? "3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2")) refuse("exact original official bootstrap bytes required");
  const directory = path.join(scratch, "sql"), files: CoreManifest["mounts"]["files"] = [];
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) refuse("selected read-only SQL mount directory required");
  const known = sqlFiles.map(sourcePath => ({ sourcePath, sha256: sha256(sourceBytes(root, sourcePath)) }));
  const walk = (relative: string) => {
    const absolute = path.join(directory, relative), stat = lstatSync(absolute);
    if (stat.isSymbolicLink() || !realpathSync(absolute).startsWith(realpathSync(directory) + path.sep)) refuse("SQL mount symlink/escape");
    if (stat.isDirectory()) { for (const entry of readdirSync(absolute).sort()) walk(path.join(relative, entry)); return; }
    if (!stat.isFile() || !relative.endsWith(".sql")) refuse("non-source scratch mount file refused");
    const bytes = readFileSync(absolute), digest = sha256(bytes), match = known.find(candidate => candidate.sha256 === digest);
    if (!match) refuse("unreviewed scratch SQL mount bytes");
    files.push({ relativePath: relative.replaceAll(path.sep, "/"), sha256: digest, sourcePath: match.sourcePath });
  };
  for (const entry of readdirSync(directory).sort()) walk(entry);
  return { bootstrap: { absolutePath: realpathSync(bootstrapFile), sha256: sha256(bootstrapBytes), bytes: bootstrapBytes.length }, sqlDirectory: realpathSync(directory), files };
}
function loadLineage(files: Files, expected?: CoreManifest["predecessor"], model?: ModelBindings): { lineage: Lineage; predecessor: CoreManifest["predecessor"] } {
  if (!equal(Object.keys(files).sort(), [...EVIDENCE_KEYS].sort())) refuse("exact original evidence inventory required");
  const predecessor = {} as CoreManifest["predecessor"];
  const values = Object.fromEntries(EVIDENCE_KEYS.map(key => {
    const bytes = evidenceBytes(files[key], model);
    predecessor[key] = { absolutePath: realpathSync(files[key]), sha256: sha256(bytes), bytes: bytes.length };
    if (expected && !equal(predecessor[key], expected[key])) refuse("immutable predecessor bytes changed while loading");
    return [key, JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""))];
  }));
  const equipmentEnvelope = object(values.equipmentManifest), fixtureEnvelope = object(values.fixtureManifest);
  const equipmentManifest = manifestEnvelope(equipmentEnvelope) as FrozenManifest;
  const fixtureManifest = manifestEnvelope(fixtureEnvelope) as FixtureManifest;
  if (equipmentEnvelope.manifestSha256 !== manifestHash(equipmentManifest)
    || fixtureEnvelope.manifestSha256 !== fixtureManifestHash(fixtureManifest)) refuse("original envelope hash mismatch");
  const lineage = { ...values, equipmentManifest, fixtureManifest } as Lineage;
  validateLineage(lineage); return { lineage, predecessor };
}
export function freezeCore(root: string, files: Files, model?: ModelBindings): CoreManifest {
  if (model && model.kind !== "injected-model") refuse("explicit non-native model binding required");
  const equipment = freezeSource(root), { lineage, predecessor } = loadLineage(files, undefined, model);
  if (equipment.migrations.length !== 83 || !equal(equipment.migrations, lineage.equipmentManifest.migrations)
    || !equal(equipment.migrations, lineage.fixtureManifest.source.migrations)) refuse("exact ordered original 83 migrations required");
  const current = new Map(equipment.files.map(file => [file.path, file.sha256]));
  for (const original of [...lineage.equipmentManifest.files, ...lineage.fixtureManifest.source.files]) {
    if (current.get(original.path) !== original.sha256) refuse("original equipment helper/bootstrap/stage/assertion/catalog bytes changed");
  }
  for (const original of lineage.fixtureManifest.files) if (sha256(sourceBytes(root, original.path)) !== original.sha256) refuse("original fixture bytes changed");
  if (!equal(lineage.fixtureManifest.files.map(file => file.path), FIXTURE_FILES)) refuse("original fixture path inventory changed");
  const fingerprint = (relative: string): FrozenFile => ({
    path: relative, sha256: sha256(sourceBytes(root, relative)),
    gitBlob: execFileSync("git", ["rev-parse", "HEAD:" + relative], { cwd: root, encoding: "utf8", windowsHide: true }).trim(),
  });
  const a = lineage.equipmentApproval;
  return { execution: model ? "injected-model" : "native", contractVersion: 1, scope: PROFILE, sourceSha: equipment.sourceSha, target: TARGET, limits: LIMITS, equipment,
    files: [...STAGES, ...OWN_FILES].map(fingerprint), predecessor,
    mounts: freezeMounts(root, [...equipment.migrations, ...equipment.files, ...lineage.fixtureManifest.files].map(file => file.path).filter(file => file.endsWith(".sql")), model),
    resourceIds: { engineId: a.engineId, containerId: a.containerId, imageId: a.imageId, networkId: a.networkId } };
}
export function validateCoreApproval(manifest: CoreManifest, approval: CoreApproval, confirmation: string): void {
  if (!["native", "injected-model"].includes(manifest.execution) || manifest.contractVersion !== 1 || manifest.scope !== PROFILE || !equal(manifest.target, TARGET) || !equal(manifest.limits, LIMITS)
    || approval.gate !== "G2" || approval.scope !== PROFILE || approval.approvedBy !== "Victor"
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(approval.approvedAtUTC)
    || !Number.isFinite(Date.parse(approval.approvedAtUTC)) || approval.sourceSha !== manifest.sourceSha
    || !/^[a-f0-9]{40}$/.test(manifest.sourceSha) || ![approval.containerId, approval.networkId].every(value => /^[a-f0-9]{64}$/.test(value))
    || !/^sha256:[a-f0-9]{64}$/.test(approval.imageId) || !/^[A-Za-z0-9:_-]{4,128}$/.test(approval.engineId)
    || approval.manifestSha256 !== coreManifestHash(manifest) || confirmation !== coreManifestHash(manifest)
    || !equal(approval.operations, ["install-disabled-stages", "verify-disabled-stages"])
    || !equal([approval.engineId, approval.containerId, approval.imageId, approval.networkId], [manifest.resourceIds.engineId, manifest.resourceIds.containerId, manifest.resourceIds.imageId, manifest.resourceIds.networkId])) refuse("actual separate human G2 record/profile/target confirmation required");
}

export const nativeObserver: OsObserver = {
  capture(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0) return null;
    const code = "$taskProcess=Get-CimInstance Win32_Process -Filter 'ProcessId=" + pid + "';if(!$taskProcess -or !$taskProcess.CreationDate -or !$taskProcess.CommandLine){'null';exit};@{pid=$taskProcess.ProcessId;parentPid=$taskProcess.ParentProcessId;birthUtc=$taskProcess.CreationDate.ToUniversalTime().ToString('o');command=$taskProcess.CommandLine}|ConvertTo-Json -Compress";
    return JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 65536 })) as OsIdentity | null;
  },
  resources() {
    const code = "$taskProcesses=@(Get-Process);@{timeUtc=(Get-Date).ToUniversalTime().ToString('o');processCount=$taskProcesses.Count;workingSetBytes=($taskProcesses|Measure-Object WorkingSet64 -Sum).Sum;cpuSeconds=($taskProcesses|Measure-Object CPU -Sum).Sum;listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue).Count}|ConvertTo-Json -Compress";
    return JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code], { encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 65536 })) as unknown;
  },
};
/** ActualTransport remains unchanged. Observer failure never certifies rollback.
 * An exited fast child without birth capture is an uncertain stop, even code0. */
export async function observedCommand(options: {
  command: Command; transport: Transport; observer: OsObserver;
  records: typeof runtimeProcessRecords; save: (value: ProcessEvidence) => void;
}) {
  const before = options.records().length;
  const settled = options.transport(options.command).then(result => ({ result }), () => ({ result: null }));
  const record = options.records().at(-1);
  let identity: OsIdentity | null = null, captureFailed = false;
  try {
    if (!record || options.records().length !== before + 1) refuse("one newly owned process record required");
    identity = options.observer.capture(record.pid);
    if (!identity || identity.pid !== record.pid || identity.parentPid !== record.parentPid
      || !/^\d{4}-\d\d-\d\dT.*Z$/.test(identity.birthUtc) || !identity.command.includes(record.executable)
      || record.cwd !== process.cwd() || !equal(record.args, options.command.args)) refuse("actual owned birth/parent/command capture unavailable");
  } catch { captureFailed = true; }
  const { result } = await settled;
  let absent = false;
  try {
    if (identity) {
      const fresh = options.observer.capture(identity.pid);
      absent = !fresh || fresh.birthUtc !== identity.birthUtc;
      if (fresh && fresh.birthUtc === identity.birthUtc
        && (fresh.parentPid !== identity.parentPid || fresh.command !== identity.command)) refuse("owned identity drift");
    }
  } catch { captureFailed = true; }
  const sqlstate = result ? /(?:ERROR:|FATAL:)\s+([0-9A-Z]{5})\b/.exec(result.stderr ?? "")?.[1] : undefined;
  options.save({ ...(record ?? { pid: -1, parentPid: process.pid, cwd: process.cwd(), executable: "", args: [], startedUTC: new Date().toISOString() }),
    ...(identity ? { osIdentity: identity } : {}), absent,
    ...(result ? { resultCode: result.code } : {}), ...(sqlstate ? { sqlstate } : {}) });
  if (captureFailed || !identity || !absent || !result || !options.records().at(-1)?.finishedUTC) refuse("uncertain child identity/completion; preserve evidence; no further command");
  return result;
}
function unchangedCounts(before: Audit, after: Audit) {
  const old = new Map(before.rowCounts.map(row => [row.schema + "." + row.table, row.rows]));
  for (const row of after.rowCounts) {
    const previous = old.get(row.schema + "." + row.table);
    if (previous !== undefined && previous !== row.rows) refuse("protected predecessor row-count drift");
  }
}
export function assertCatalogDelta(before: Audit, after: Audit) {
  unchangedCounts(before, after);
  for (const key of ["extensions", "roles"]) if (!equal(before[key], after[key])) refuse("unrelated catalog role/extension drift");
  const family = (row: Record<string, unknown>, key: string) => {
    const owner = String(row.owner ?? "");
    if (key === "functions") return ["inkborne_hit_die_kernel_owner", "inkborne_hit_die_authority_owner", "inkborne_class_origin_owner"].includes(owner);
    const table = String(row.table ?? "");
    const coreTables = new Set(["hit_die_gate_v1", "character_action_receipts", "character_writer_guard_v1", "character_writer_readiness_v1", "character_projection_order_v1", "class_origin_gate_v1", "character_class_origin_v1", "character_class_occurrences_v1", "class_save_occurrence_manifests_v1", "character_class_commands_v1", "character_creation_commands_v1", "class_writer_acceptance_v1", "class_writer_row_transitions_v1", "class_origin_revision_events_v1"]);
    if (key === "tables") return row.schema === "private" && coreTables.has(String(row.name));
    if (key === "table_grants") return table.startsWith("private.") && coreTables.has(table.slice(8));
    if (key === "policies") return /^(hit_die_|class_origin_|class_confirmation_|preserve_hit_die_)/.test(String(row.name));
    if (key === "triggers") return (table.startsWith("private.") && coreTables.has(table.slice(8))) || /^(hit_die_|preserve_hit_die_)/.test(String(row.name));
    return false;
  };
  for (const key of ["tables", "functions", "triggers", "policies", "table_grants"]) {
    const a = before[key], b = after[key];
    if (!Array.isArray(a) || !Array.isArray(b)) refuse("bounded catalog arrays required");
    const protectedBefore = a.map(object).filter(row => !family(row, key));
    const protectedAfter = b.map(object).filter(row => !family(row, key));
    if (!equal(protectedBefore, protectedAfter)) refuse("unrelated " + key + " catalog drift");
  }
}
export function expectedFunctionMetadata(stages: string[]) {
  const result = new Map<string, { schema: string; name: string; argument_types: string[]; source_md5: string; owner: string; security_definer: boolean }>();
  const owners = ["inkborne_hit_die_kernel_owner", "inkborne_hit_die_authority_owner", "inkborne_class_origin_owner", "inkborne_hit_die_authority_owner", "inkborne_class_origin_owner"];
  for (const [index, sql] of stages.entries()) {
    for (const match of sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+(public|private)\.([a-z0-9_]+)\(([\s\S]*?)\)\s+RETURNS[\s\S]*?\bAS\s+(\$[a-z0-9_]*\$)([\s\S]*?)\4/g)) {
      const header = match[0].slice(0, match[0].indexOf(match[4]));
      const aliases: Record<string, string> = { boolean: "bool", integer: "int4", bigint: "int8", "text[]": "_text", "uuid[]": "_uuid" };
      const argument_types = match[3].trim() ? match[3].split(",").map(parameter => {
        const type = parameter.trim().split(/\s+/).at(-1)!;
        return type.includes(".") ? type : "pg_catalog." + (aliases[type] ?? type);
      }) : [];
      result.set(match[1] + "." + match[2], { schema: match[1], name: match[2], argument_types, source_md5: createHash("md5").update(match[5]).digest("hex"), owner: owners[index], security_definer: /SECURITY DEFINER/.test(header) });
    }
    for (const match of sql.matchAll(/ALTER FUNCTION\s+(public|private)\.([a-z0-9_]+)\([\s\S]*?\) OWNER TO ([a-z0-9_]+);/g)) {
      const row = result.get(match[1] + "." + match[2]);
      if (row) row.owner = match[3];
    }
  }
  if (!result.size) refuse("frozen function metadata inventory unavailable");
  return [...result.values()];
}
export const FAMILY_ROLES = ["inkborne_hit_die_kernel_owner", "inkborne_hit_die_authority_owner", "inkborne_class_origin_owner"] as const;
const CROSS_EXECUTE: [number, string, string, string[]][] = [
  [2, FAMILY_ROLES[1], "private.hit_die_exact_keys_v1", ["pg_catalog.jsonb", "pg_catalog._text"]],
  [2, FAMILY_ROLES[1], "private.hit_die_native_v1", ["pg_catalog.timestamptz"]],
  [2, FAMILY_ROLES[1], "private.hit_die_millis_v1", ["pg_catalog.timestamptz"]],
  [2, FAMILY_ROLES[1], "private.hit_die_deadline_v1", ["pg_catalog.jsonb", "pg_catalog.timestamptz"]],
  [3, FAMILY_ROLES[2], "private.lock_character_writer_guard_v1", []],
  [4, FAMILY_ROLES[1], "private.class_origin_metadata_delta_v1", ["pg_catalog.uuid"]],
  [4, FAMILY_ROLES[1], "private.class_origin_consume_metadata_revision_v1", ["pg_catalog.uuid"]],
  [4, FAMILY_ROLES[1], "private.class_origin_assert_metadata_revision_v1", ["pg_catalog.uuid"]],
  [4, FAMILY_ROLES[2], "private.apply_class_metadata_revision_v1", ["pg_catalog.uuid"]],
  [5, FAMILY_ROLES[1], "private.class_confirmation_private_inputs_v1", ["pg_catalog.uuid", "pg_catalog.uuid"]],
  [5, FAMILY_ROLES[2], "private.lock_class_confirmation_sources_v1", ["pg_catalog.jsonb", "pg_catalog.uuid", "pg_catalog.uuid"]],
];
export function expectedExecuteMatrix(stage: number, definition: ReturnType<typeof expectedFunctionMetadata>[number]) {
  if (!Number.isInteger(stage) || stage < 1 || stage > 5) refuse("exact matrix stage required");
  const name = definition.schema + "." + definition.name;
  const roles = ["PUBLIC", "anon", "authenticated", "service_role", ...FAMILY_ROLES.slice(0, Math.min(stage, 3))];
  return Object.fromEntries(roles.map(role => [role,
    role === definition.owner
    || (role === "service_role" && (stage === 1 ? ["public.read_hit_die_receipt_v1", "public.resolve_hit_die_snapshot_v1", "public.commit_hit_die_v1"] : ["public.read_hit_die_graph_v1", "public.patch_character_state_at_revision_v1"]).includes(name))
    || CROSS_EXECUTE.some(([minimum, grantee, functionName, types]) => stage >= minimum && role === grantee && name === functionName && equal(definition.argument_types, types)),
  ]));
}
export function assertFunctionMetadata(sql: string[], metadata: unknown) {
  if (!Array.isArray(metadata)) refuse("actual function metadata array required");
  const rows = metadata.map(object), expected = expectedFunctionMetadata(sql);
  if (rows.length !== expected.length) refuse("exact installed function metadata count mismatch");
  for (const definition of expected) {
    const matching = rows.filter(row => row.schema === definition.schema && row.name === definition.name);
    if (matching.length !== 1 || Object.entries(definition).some(([key, value]) => !equal(matching[0][key], value))
      || typeof matching[0].definition_md5 !== "string" || !/^[a-f0-9]{32}$/.test(matching[0].definition_md5)) refuse("frozen function body/owner/security metadata mismatch");
    const effective = object(matching[0].execute), matrix = expectedExecuteMatrix(sql.length, definition);
    if (!equal(Object.keys(effective).sort(), Object.keys(matrix).sort()) || Object.values(effective).some(value => typeof value !== "boolean")
      || !equal(effective, matrix)) refuse("exact effective stage function EXECUTE matrix mismatch");
    const grantees = matching[0].acl_grantees;
    if (!Array.isArray(grantees) || grantees.some(role => typeof role !== "string")
      || !equal(grantees, Object.keys(matrix).filter(role => matrix[role]).sort())) refuse("exact explicit function EXECUTE ACL inventory mismatch");
  }
}
export async function verifyCoreRuntime(transport: Transport, approval: CoreApproval) {
  await verifyRuntime(transport, approval);
  const inspect = await transport({ args: ["--context", TARGET.context, "inspect", "--type", "container", "--format",
    '{"id":{{json .Id}},"memory":{{json .HostConfig.Memory}},"cpus":{{json .HostConfig.NanoCpus}},"pids":{{json .HostConfig.PidsLimit}},"restart":{{json .HostConfig.RestartPolicy.Name}}}', approval.containerId], timeoutMs: 30_000 });
  if (inspect.code !== 0) refuse("exact native resource-cap readback unavailable");
  const caps = object(JSON.parse(inspect.stdout));
  if (caps.id !== approval.containerId || caps.memory !== 1073741824 || caps.cpus !== 1000000000 || caps.pids !== 256 || caps.restart !== "no") refuse("original DB CPU/memory/PID/restart caps drift");
  const network = await transport({ args: ["--context", TARGET.context, "network", "inspect", "--format", "{{json .Containers}}", approval.networkId], timeoutMs: 30_000 });
  if (network.code !== 0) refuse("owned network endpoint inventory unavailable");
  const endpoints = object(JSON.parse(network.stdout));
  if (!equal(Object.keys(endpoints), [approval.containerId]) || object(endpoints[approval.containerId]).Name !== TARGET.containerName) refuse("unexpected running client in isolated core network");
}
export async function executeCore(options: {
  root: string; manifest: CoreManifest; approval: CoreApproval; confirmation: string;
  transport: Transport; observer: OsObserver; records: typeof runtimeProcessRecords;
  save: (journal: CoreJournal) => void;
  model?: ModelBindings;
}) {
  const { manifest, approval } = options;
  if ((manifest.execution === "injected-model") !== Boolean(options.model)
    || (options.model && (options.model.kind !== "injected-model" || options.transport === actualTransport || options.observer === nativeObserver))) refuse("model bindings/manifests cannot use native adapters");
  validateCoreApproval(manifest, approval, options.confirmation);
  const files = Object.fromEntries(EVIDENCE_KEYS.map(key => [key, manifest.predecessor[key].absolutePath])) as Files;
  const fresh = freezeCore(options.root, files, options.model);
  if (!equal(fresh, manifest)) refuse("current committed source/predecessor byte/order drift");
  const { lineage } = loadLineage(files, manifest.predecessor, options.model);
  const frozen = new Map(manifest.files.map(file => {
    const bytes = sourceBytes(options.root, file.path);
    if (sha256(bytes) !== file.sha256) refuse("approved source changed while caching");
    return [file.path, bytes.toString("utf8")];
  }));
  const auditBytes = sourceBytes(options.root, "scripts/equipment-runtime/catalog-audit.sql");
  if (sha256(auditBytes) !== manifest.equipment.files.find(file => file.path === "scripts/equipment-runtime/catalog-audit.sql")?.sha256) refuse("original audit source changed while caching");
  const auditSql = auditBytes.toString("utf8");
  const journal: CoreJournal = { execution: manifest.execution, contractVersion: 1, scope: PROFILE, sourceSha: manifest.sourceSha, manifestSha256: coreManifestHash(manifest),
    resourceIds: manifest.resourceIds, status: "incomplete", steps: [], audits: [], assertions: [], processes: [], limits: LIMITS };
  const save = () => {
    if (Buffer.byteLength(canonicalJson(journal)) > LIMITS.evidenceBytes) refuse("sanitized evidence budget exceeded");
    options.save(structuredClone(journal));
  };
  const now = options.model?.now ?? Date.now;
  let count = 0; const started = now();
  const transport: Transport = async command => {
    const remaining = LIMITS.durationMs - (now() - started);
    if (remaining <= 0 || ++count > LIMITS.commands) refuse("native command/time budget exhausted");
    return observedCommand({ command: { ...command, timeoutMs: Math.min(command.timeoutMs, remaining) },
      transport: options.transport, observer: options.observer, records: options.records,
      save: value => { journal.processes.push(value); save(); } });
  };
  const step = async (name: string, sql: string) => {
    await verifyCoreRuntime(transport, approval);
    journal.steps.push({ name, outcome: "started" }); save();
    const result = await transport(psql(approval, sql));
    if (result.code !== 0) {
      const sqlstate = /(?:ERROR:|FATAL:)\s+([0-9A-Z]{5})\b/.exec(result.stderr ?? "")?.[1];
      journal.steps.at(-1)!.outcome = "uncertain";
      if (sqlstate) journal.steps.at(-1)!.sqlstate = sqlstate;
      save(); refuse("first SQL failure/commit uncertainty at " + name);
    }
    journal.steps.at(-1)!.outcome = "passed"; save();
    return result.stdout;
  };
  save();
  try {
    journal.resourcesBefore = options.observer.resources(); save();
    await verifyCoreRuntime(transport, approval);
    const initial = await auditCounts(transport, approval, auditSql) as Audit;
    if (!sameAudit(initial, lineage.cleanup.audits.at(-1)!)) refuse("exact original cleanup catalog/count freshness drift");
    journal.audits.push(initial); save();
    const preflight = JSON.parse(await step("disabled-stage-preflight", frozen.get("scripts/core-db-verification/preflight.sql")!));
    if (!equal(preflight, { profile: PROFILE, phase: "preflight", passed: true })) refuse("preflight readback incomplete");
    for (const [index, file] of STAGES.entries()) {
      const sql = frozen.get(file)!;
      if (!/^\s*(?:--[^\n]*\n)*BEGIN;/.test(sql) || !/COMMIT;\s*$/.test(sql)) refuse("whole frozen stage transaction required");
      await step(file, sql);
      const response = object(JSON.parse(await step("disabled-assertions-D" + (index + 1),
        "SET inkborne.core.stage='" + (index + 1) + "';\n" + frozen.get("scripts/core-db-verification/disabled-assertions.sql")!)));
      if (response.profile !== PROFILE || response.stage !== index + 1 || response.passed !== true || !Array.isArray(response.metadata)
        || response.database !== "postgres" || response.actor !== "postgres" || !Number.isSafeInteger(response.backend_pid) || Number(response.backend_pid) <= 0
        || !Array.isArray(response.constraints)) refuse("exact disabled-stage assertion readback unavailable");
      assertFunctionMetadata(STAGES.slice(0, index + 1).map(stage => frozen.get(stage)!), response.metadata);
      journal.assertions.push(response); save();
      await verifyCoreRuntime(transport, approval);
      const after = await auditCounts(transport, approval, auditSql) as Audit;
      assertCatalogDelta(initial, after);
      journal.audits.push(after); save();
    }
    journal.resourcesAfter = options.observer.resources();
    if (now() - started > LIMITS.durationMs) refuse("native duration budget exceeded before final acceptance");
    journal.status = "disabled-installed"; save();
    return journal;
  } catch {
    journal.status = "uncertain";
    if (journal.steps.at(-1)?.outcome === "started") journal.steps.at(-1)!.outcome = "uncertain";
    try { journal.resourcesAfter = options.observer.resources(); } catch { /* Never continue after observer or journal uncertainty. */ }
    try { save(); } catch { /* Preserve even a partial first journal; no retry/deletion. */ }
    return refuse("profile incomplete/uncertain; preserve first receipt; no retry, continuation, fixture, teardown or activation");
  }
}
async function main() {
  const args = process.argv.slice(2), mode = args.shift();
  if (mode !== "freeze" && mode !== "install-disabled") refuse("use freeze or separately approved install-disabled");
  const flags = new Map<string, string>();
  while (args.length) { const key = args.shift()!, value = args.shift(); if (!key.startsWith("--") || !value || flags.has(key)) refuse("exact arguments required"); flags.set(key, value); }
  const expected = mode === "freeze" ? ["--predecessor-files"] : ["--manifest", "--approval", "--confirm-g2-manifest"];
  if (!equal([...flags.keys()].sort(), expected.sort())) refuse("unknown/missing profile arguments");
  if (mode === "freeze") {
    const manifest = freezeCore(process.cwd(), evidence(flags.get("--predecessor-files")!) as Files);
    console.log(canonicalJson({ manifest, manifestSha256: coreManifestHash(manifest) })); return;
  }
  const envelope = object(evidence(flags.get("--manifest")!)), manifest = manifestEnvelope(envelope) as CoreManifest;
  if (manifest.execution !== "native") refuse("CLI refuses injected-model manifests regardless of modeled approval");
  if (envelope.manifestSha256 !== coreManifestHash(manifest)) refuse("profile envelope hash");
  const approval = evidence(flags.get("--approval")!) as CoreApproval;
  validateCoreApproval(manifest, approval, flags.get("--confirm-g2-manifest")!);
  const evidenceRoot = realpathSync(path.join(TARGET.scratch, "evidence"));
  const output = path.join(evidenceRoot, "core-disabled-" + Date.now() + "-" + coreManifestHash(manifest).slice(0, 12) + ".json");
  let first = true;
  await executeCore({ root: process.cwd(), manifest, approval, confirmation: flags.get("--confirm-g2-manifest")!,
    transport: actualTransport, observer: nativeObserver, records: runtimeProcessRecords,
    save: journal => { writeFileSync(output, canonicalJson(journal), { flag: first ? "wx" : "w", mode: 0o600 }); first = false; } });
  console.log("Disabled installation/default-denial receipt only. Auth, history, writer cutover and unreachable bodies remain unaccepted.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => {
  console.error(error instanceof Error && error.message.startsWith("Core profile refusal:") ? error.message : "Core profile failed; raw output suppressed; preserve evidence");
  process.exitCode = 1;
});
