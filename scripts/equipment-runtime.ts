/** R07.1 preparation + separately approved disposable DB replay. Never starts Docker. */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TARGET = {
  context: "desktop-linux",
  prefix: "inkborne-equipment-e1-20261011",
  containerName: "inkborne-equipment-e1-20261011-db",
  networkName: "inkborne-equipment-e1-20261011-net",
  scratch: "C:\\Users\\kaios\\Documents\\Codex\\2026-10-11\\task-2\\equipment-runtime",
  image: "supabase/postgres@sha256:06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108",
  volumes: ["inkborne-equipment-e1-20261011-db-data", "inkborne-equipment-e1-20261011-db-config"],
} as const;
const DOCKER = "C:\\Users\\kaios\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe";
const STAGE = "supabase/staged/starting-equipment-transaction.sql";
const COMPOSE = "docs/specs/2026-10-12-equipment-runtime.compose.yaml";
const SQL = {
  preflight: "scripts/equipment-runtime/bootstrap-preflight.sql",
  baseline: "scripts/equipment-runtime/baseline-assertions.sql",
  stage: "scripts/equipment-runtime/stage-assertions.sql",
  audit: "scripts/equipment-runtime/catalog-audit.sql",
} as const;
type FrozenFile = { path: string; sha256: string };
export type FrozenManifest = {
  version: 1;
  scope: "R07.1-baseline-and-stage";
  sourceSha: string;
  target: typeof TARGET;
  migrations: FrozenFile[];
  files: FrozenFile[];
  fixtureIds: [];
};
export type RuntimeApproval = {
  gate: "G2";
  scope: "R07.1-baseline-and-stage";
  approvedBy: "Victor";
  approvedAtUTC: string;
  sourceSha: string;
  manifestSha256: string;
  engineId: string;
  containerId: string;
  imageId: string;
  networkId: string;
};
export type Command = { args: string[]; stdin?: string; timeoutMs: number };
export type Result = { code: number; stdout: string; stderr?: string };
export type Transport = (command: Command) => Promise<Result>;
type ProcessRecord = { pid: number; parentPid: number; cwd: string; executable: string; args: string[]; startedUTC: string; finishedUTC?: string };
const processRecords: ProcessRecord[] = [];
export type Journal = { manifestSha256: string; sourceSha: string; containerId: string; phase: "baseline" | "stage"; steps: { name: string; outcome: "passed" | "failed"; exitCode: number }[]; complete: boolean; audits: unknown[]; processes?: ProcessRecord[] };
function refusal(message: string): never { throw new Error(`R07.1 refusal: ${message}`); }
export const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export const manifestHash = (manifest: FrozenManifest) => sha256(JSON.stringify(manifest));
function git(root: string, args: string[]) { return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function sourceBytes(root: string, relative: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.includes("..") || path.isAbsolute(relative)) refusal("non-allowlisted source path");
  const resolvedRoot = realpathSync(root);
  const file = path.join(resolvedRoot, relative);
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(resolvedRoot + path.sep)) refusal("source symlink/escape");
  return readFileSync(file);
}
export function freezeSource(root: string): FrozenManifest {
  if (git(root, ["status", "--porcelain", "--untracked-files=normal"])) refusal("source must be committed and clean before freeze");
  const sourceSha = git(root, ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) refusal("source SHA malformed");
  const migrations = readdirSync(path.join(root, "supabase/migrations")).filter(name => name.endsWith(".sql")).sort();
  if (!migrations.length || migrations.some(name => !/^\d{5,14}_[a-z0-9_]+\.sql$/i.test(name))) refusal("migration inventory malformed");
  const fingerprint = (relative: string) => ({ path: relative, sha256: sha256(sourceBytes(root, relative)) });
  return { version: 1, scope: "R07.1-baseline-and-stage", sourceSha, target: TARGET,
    migrations: migrations.map(name => fingerprint(`supabase/migrations/${name}`)),
    files: [STAGE, COMPOSE, "scripts/equipment-runtime.ts", ...Object.values(SQL)].map(fingerprint), fixtureIds: [] };
}
export function validateFrozen(root: string, manifest: FrozenManifest) {
  const fresh = freezeSource(root);
  if (JSON.stringify(fresh) !== JSON.stringify(manifest)) refusal("frozen SHA/file inventory/hash/target drift");
  // Retain exact approved bytes in memory before any Docker call; do not reread during replay.
  return new Map([...manifest.migrations, ...manifest.files].map(file => {
    const bytes = sourceBytes(root, file.path);
    if (sha256(bytes) !== file.sha256) refusal("source changed while loading frozen bytes");
    return [file.path, bytes.toString("utf8")];
  }));
}
export function validateApproval(manifest: FrozenManifest, approval: RuntimeApproval, confirmation: string) {
  const hash = manifestHash(manifest);
  if (approval.gate !== "G2" || approval.scope !== manifest.scope || approval.approvedBy !== "Victor"
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(approval.approvedAtUTC)
      || approval.sourceSha !== manifest.sourceSha || approval.manifestSha256 !== hash || confirmation !== hash)
    refusal("matching human G2 record and explicit manifest confirmation required");
  if (![approval.containerId, approval.networkId].every(id => /^[a-f0-9]{64}$/.test(id))
      || !/^sha256:[a-f0-9]{64}$/.test(approval.imageId) || !/^[A-Za-z0-9:_-]{4,128}$/.test(approval.engineId))
    refusal("exact Docker resource IDs required");
}
const inspectTemplate = '{"id":{{json .Id}},"name":{{json .Name}},"imageId":{{json .Image}},"running":{{json .State.Running}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}}}';
const docker = (args: string[], stdin?: string, timeoutMs = 30000): Command => ({ args: ["--context", TARGET.context, ...args], stdin, timeoutMs });
async function checked(transport: Transport, command: Command) {
  let result: Result;
  try { result = await transport(command); } catch { refusal("transport failed/timeout; no raw output retained"); }
  if (result.code !== 0) refusal("runtime metadata/SQL command failed; no raw output retained");
  return result.stdout;
}
function parseJson(text: string): unknown { try { return JSON.parse(text.trim()); } catch { return refusal("invalid runtime JSON"); } }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) refusal("runtime object malformed");
  return value as Record<string, unknown>;
}
export async function verifyRuntime(transport: Transport, approval: RuntimeApproval) {
  const engineId = parseJson(await checked(transport, docker(["info", "--format", "{{json .ID}}"]))) as string;
  if (engineId !== approval.engineId) refusal("wrong Docker daemon");
  const container = record(parseJson(await checked(transport, docker(["inspect", "--type", "container", "--format", inspectTemplate, approval.containerId]))));
  if (container.id !== approval.containerId || container.name !== `/${TARGET.containerName}` || container.imageId !== approval.imageId
      || container.running !== true || container.project !== TARGET.prefix || container.service !== "db") refusal("wrong container/image/ownership/state");
  if (container.ports && Object.keys(record(container.ports)).length) refusal("published host ports");
  const networks = record(container.networks);
  if (Object.keys(networks).length !== 1 || !networks[TARGET.networkName]
      || record(networks[TARGET.networkName]).NetworkID !== approval.networkId) refusal("unexpected container network");
  const network = record(parseJson(await checked(transport, docker(["network", "inspect", "--format", '{"id":{{json .Id}},"name":{{json .Name}},"internal":{{json .Internal}}}', approval.networkId]))));
  if (network.id !== approval.networkId || network.name !== TARGET.networkName || network.internal !== true) refusal("network not owned/internal");
  const image = record(parseJson(await checked(transport, docker(["image", "inspect", "--format", '{"id":{{json .Id}},"digests":{{json .RepoDigests}},"os":{{json .Os}},"architecture":{{json .Architecture}}}', approval.imageId]))));
  if (image.id !== approval.imageId || image.os !== "linux" || image.architecture !== "amd64"
      || !Array.isArray(image.digests) || !image.digests.includes(TARGET.image)) refusal("unpinned runtime image");
  if (!Array.isArray(container.mounts) || container.mounts.length !== 4) refusal("unexpected mount count");
  const expectedMounts = [
    { type: "volume", name: TARGET.volumes[0], destination: "/var/lib/postgresql/data", rw: true },
    { type: "volume", name: TARGET.volumes[1], destination: "/etc/postgresql-custom", rw: true },
    { type: "bind", source: `${TARGET.scratch}\\bootstrap\\99-roles.sql`, destination: "/docker-entrypoint-initdb.d/init-scripts/99-roles.sql", rw: false },
    { type: "bind", source: `${TARGET.scratch}\\sql`, destination: "/e1-sql", rw: false },
  ];
  for (const expected of expectedMounts) {
    const actual = container.mounts.map(record).find(mount => mount.Destination === expected.destination);
    const normalize = (value: unknown) => String(value).replace(/\\/g, "/").toLowerCase();
    if (!actual || actual.Type !== expected.type || actual.RW !== expected.rw
        || ("name" in expected && actual.Name !== expected.name)
        || ("source" in expected && ![normalize(expected.source), normalize(expected.source).replace(/^c:\//,"/run/desktop/mnt/host/c/")].includes(normalize(actual.Source)))) refusal("non-allowlisted writable/path/socket mount");
  }
}
function psql(approval: RuntimeApproval, sql: string) {
  return docker(["exec", "-i", approval.containerId, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "postgres", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", "VERBOSITY=sqlstate", "--command", "SET statement_timeout='60s'; SET lock_timeout='5s';", "--file", "-"], sql, 120000);
}
async function auditCounts(transport: Transport, approval: RuntimeApproval, sql: string) {
  const audit = record(parseJson(await checked(transport, psql(approval, sql))));
  if (audit.database !== "postgres" || audit.actor !== "postgres" || !Array.isArray(audit.tables)) refusal("audit DB/role/table result malformed");
  const tables = audit.tables.map(record);
  if (tables.length > 256) refusal("audit table-count budget exceeded");
  const counts: { schema: string; table: string; rows: number }[] = [];
  for (const table of tables) {
    const schema = String(table.schema), name = String(table.name);
    if (!["public", "private", "auth", "storage"].includes(schema) || !/^[a-z][a-z0-9_]*$/.test(name)) refusal("unsafe audit identifier");
    const result = await checked(transport, psql(approval, `BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; SELECT count(*) FROM "${schema}"."${name}"; COMMIT;`));
    if (!/^\d+\s*$/.test(result) || !Number.isSafeInteger(Number(result))) refusal("invalid exact row count");
    counts.push({ schema, table: name, rows: Number(result) });
  }
  return { ...audit, rowCounts: counts };
}
export async function executeApproved(options: {
  root: string; manifest: FrozenManifest; approval: RuntimeApproval; confirmation: string;
  phase: "baseline" | "stage"; transport: Transport; saveJournal: (journal: Journal) => void; baselineReceipt?: Journal;
}) {
  const { manifest, approval, transport } = options;
  validateApproval(manifest, approval, options.confirmation);
  const bytes = validateFrozen(options.root, manifest);
  if (options.phase === "stage") {
    const receipt = options.baselineReceipt;
    const expected = ["official-bootstrap-preflight", ...manifest.migrations.map(file => file.path), "baseline-assertions"];
    if (!receipt || !receipt.complete || receipt.phase !== "baseline" || receipt.manifestSha256 !== manifestHash(manifest)
        || receipt.sourceSha !== manifest.sourceSha || receipt.containerId !== approval.containerId
        || JSON.stringify(receipt.steps.map(step => step.name)) !== JSON.stringify(expected)
        || receipt.steps.some(step => step.outcome !== "passed" || step.exitCode !== 0) || receipt.audits.length !== 1)
      refusal("stage requires exact completed full baseline receipt");
  }
  await verifyRuntime(transport, approval);
  const journal: Journal = { manifestSha256: manifestHash(manifest), sourceSha: manifest.sourceSha,
    containerId: approval.containerId, phase: options.phase, steps: [], complete: false, audits: [] };
  const save = () => { journal.processes = [...processRecords]; options.saveJournal(structuredClone(journal)); };
  save();
  const sqlStep = async (name: string, sql: string) => {
    // Recheck exact target/isolation before every SQL command, including each migration.
    await verifyRuntime(transport, approval);
    let result: Result;
    try { result = await transport(psql(approval, sql)); } catch { result = { code: -1, stdout: "" }; }
    journal.steps.push({ name, outcome: result.code === 0 ? "passed" : "failed", exitCode: result.code });
    save();
    if (result.code !== 0) refusal(`first SQL failure at ${name}; fresh replay required; raw error suppressed`);
  };
  if (options.phase === "baseline") {
    await sqlStep("official-bootstrap-preflight", bytes.get(SQL.preflight)!);
    for (const migration of manifest.migrations) await sqlStep(migration.path, bytes.get(migration.path)!);
    await sqlStep("baseline-assertions", bytes.get(SQL.baseline)!);
  } else {
    await sqlStep("baseline-assertions", bytes.get(SQL.baseline)!);
    await sqlStep("stage-must-be-absent", "DO $$ BEGIN IF pg_catalog.to_regclass('public.character_starting_grants') IS NOT NULL THEN RAISE EXCEPTION 'Stage already present'; END IF; END $$;");
    journal.audits.push(await auditCounts(transport, approval, bytes.get(SQL.audit)!));
    const fingerprint = (value: unknown) => {
      const audit = record(value);
      return sha256(JSON.stringify(["extensions","roles","tables","functions","triggers","policies","table_grants","rowCounts"].map(key => audit[key])));
    };
    if (fingerprint(journal.audits[0]) !== fingerprint(options.baselineReceipt!.audits[0])) refusal("baseline catalog/grants/counts drift before stage");
    save();
    await sqlStep(STAGE, bytes.get(STAGE)!);
    await sqlStep("stage-assertions", bytes.get(SQL.stage)!);
  }
  await verifyRuntime(transport, approval);
  journal.audits.push(await auditCounts(transport, approval, bytes.get(SQL.audit)!));
  journal.complete = true;
  save();
  return journal;
}
export const actualTransport: Transport = command => new Promise((resolve, reject) => {
  const child = spawn(DOCKER, command.args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const processRecord: ProcessRecord = { pid: child.pid ?? -1, parentPid: process.pid, cwd: process.cwd(), executable: DOCKER, args: command.args, startedUTC: new Date().toISOString() };
  processRecords.push(processRecord);
  let stdout = "", stderr = "", exceeded = false;
  const timer = setTimeout(() => { exceeded = true; child.kill(); }, command.timeoutMs);
  const capture = (kind: "stdout" | "stderr", chunk: Buffer) => {
    if (kind === "stdout") stdout += chunk.toString(); else stderr += chunk.toString();
    if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > 2 * 1024 * 1024) { exceeded = true; child.kill(); }
  };
  child.stdout.on("data", chunk => capture("stdout", chunk));
  child.stderr.on("data", chunk => capture("stderr", chunk));
  child.on("error", () => { clearTimeout(timer); reject(new Error("R07.1 transport spawn failed")); });
  child.on("close", code => { clearTimeout(timer); processRecord.finishedUTC = new Date().toISOString(); if (exceeded) reject(new Error("R07.1 transport limit exceeded")); else resolve({ code: code ?? -1, stdout, stderr }); });
  child.stdin.on("error", () => { /* EPIPE accompanies an already recorded child failure. */ });
  child.stdin.end(command.stdin);
});
async function main() {
  const args = process.argv.slice(2), mode = args.shift();
  if (mode === "freeze" && args.length === 0) {
    const manifest = freezeSource(process.cwd());
    console.log(JSON.stringify({ manifest, manifestSha256: manifestHash(manifest) }, null, 2));
    return;
  }
  if (mode !== "baseline" && mode !== "stage") refusal("use freeze, or separately approved baseline/stage");
  if (args.length !== 6 || args[0] !== "--manifest" || args[2] !== "--approval" || args[4] !== "--confirm-g2-manifest") refusal("exact manifest/approval/confirmation arguments required");
  const evidenceRoot = path.join(TARGET.scratch, "evidence", "r07.1");
  const readEvidence = (file: string) => {
    if (path.extname(file) !== ".json" || !realpathSync(file).startsWith(realpathSync(evidenceRoot) + path.sep)) refusal("manifest/approval must be existing scratch JSON evidence");
    const bytes = readFileSync(file); if (bytes.length > 1024 * 1024) refusal("input evidence too large");
    return JSON.parse(bytes.toString("utf8"));
  };
  const manifest = readEvidence(args[1]).manifest as FrozenManifest;
  const approval = readEvidence(args[3]) as RuntimeApproval;
  const receiptPath = path.join(evidenceRoot, `${mode}-receipt.json`);
  if (lstatSafe(receiptPath)) refusal("receipt already exists; never overwrite/resume an uncertain attempt");
  await executeApproved({ root: process.cwd(), manifest, approval, confirmation: args[5], phase: mode, transport: actualTransport,
    baselineReceipt: mode === "stage" ? readEvidence(path.join(evidenceRoot, "baseline-receipt.json")) as Journal : undefined,
    saveJournal: journal => writeFileSync(receiptPath, JSON.stringify(journal, null, 2), { mode: 0o600 }) });
  console.log(`R07.1 ${mode} completed on the recorded scratch target; receipt saved; remaining behavioral matrices are untested.`);
}
function lstatSafe(file: string) { try { return lstatSync(file); } catch { return undefined; } }
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error && error.message.startsWith("R07.1 refusal:") ? error.message : "R07.1 failed; raw output suppressed; preserve the scratch receipt"); process.exitCode = 1; });
}
