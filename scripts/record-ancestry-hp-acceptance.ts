// Read-only recorder for one complete A4 run. Never starts or installs a runtime.
// node --import tsx scripts/record-ancestry-hp-acceptance.ts <story.json> <wrapper-summary.json>
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { captureAncestryHpSource, validateAncestryHpStory, validateAncestryNativeArtifact,
  validateAncestryHpWrapper, validateAncestryHpProfile } from "./ancestry-hp-acceptance";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), runtime = path.resolve(root, "../equipment-runtime/app-flow-runtime");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function publicEvidence(file: string, base: string) {
  const lexical = path.resolve(file), actual = fs.realpathSync(lexical), allowed = fs.realpathSync(base);
  for (const candidate of [lexical, actual]) {
    assert(candidate.startsWith(allowed + path.sep), "evidence escaped its public root");
    assert(!candidate.split(/[\\/]/).some(part => /private|credential|secret/i.test(part)), "public evidence required");
  }
  assert(fs.statSync(actual).isFile()); const bytes = fs.readFileSync(actual);
  return { path: actual, sha256: hash(bytes), data: JSON.parse(bytes.toString("utf8")) as unknown };
}
const runtimeSchema = z.object({ project: z.literal("inkborne-app-flow-20261022"), catalogMode: z.literal("real-srd"), ready: z.literal(true),
  stoppedUtc: z.never().optional(), engineId: z.string().min(1), containers: z.array(z.object({ name: z.string(), id: z.string().regex(/^[a-f0-9]{64}$/) })) });
const output = path.join(runtime, "ancestry-hit-points-actual-readback.json");
assert.equal(process.argv.length, 4, "provide exactly the A4 story and its completed wrapper summary");
assert(!fs.existsSync(output), "preserve previous accepted evidence");
const storyFile = publicEvidence(process.argv[2], path.join(root, "test-results/local-app"));
const story = validateAncestryHpStory(storyFile.data), source = captureAncestryHpSource(root);
assert.deepEqual(story.source, source, "the current product source differs from the actual run");
const wrapperFile = publicEvidence(process.argv[3], path.resolve(runtime, "../evidence"));
const wrapper = validateAncestryHpWrapper(wrapperFile.data, story.runId);
const resources = publicEvidence(path.join(path.dirname(wrapperFile.path), "resources-before.json"), path.dirname(wrapperFile.path));
const startedUtc = z.object({ utc: z.iso.datetime({ offset: true }) }).parse(resources.data).utc;
const artifacts = story.snapshots.map(snapshot => {
  const file = publicEvidence(snapshot.path, path.dirname(storyFile.path));
  validateAncestryNativeArtifact(file.data, snapshot.data, snapshot.label); return file;
});
assert.equal(new Set(artifacts.map(item => item.path)).size, 11, "distinct native snapshots required");
for (const file of [storyFile, ...artifacts]) {
  const written = fs.statSync(file.path).mtimeMs;
  assert(written >= Date.parse(startedUtc) && written <= Date.parse(wrapper.finishedUtc), "evidence was written outside its actual wrapper run");
}
const stateBytes = fs.readFileSync(path.join(runtime, "state.json")), state = runtimeSchema.parse(JSON.parse(stateBytes.toString("utf8")));
const db = state.containers.filter(item => item.name === `/${state.project}-db`); assert.equal(db.length, 1);
const publication = publicEvidence(path.join(runtime, "publish-corrected-ancestry-hit-points-readback.json"), runtime);
const publicationData = z.object({ engineId: z.literal(state.engineId), databaseId: z.literal(db[0].id), onlyChangedIdentity: z.literal("subrace/hill-dwarf"),
  oldControlId: z.literal(story.oldControlId), characterRowsUnchanged: z.literal(true), historicalSnapshotsPreserved: z.literal(true),
  stageReceipts: z.array(z.object({ file: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) }).passthrough().parse(publication.data);
const expectedStages = new Map([
  ["install-hp-bonus-readback.json", "supabase/staged/character-builder-hp-bonus.sql"],
  ["install-parent-admission-readback.json", "supabase/staged/character-builder-parent-admission.sql"],
  ["install-ancestry-hp-bonus-readback.json", "supabase/staged/character-builder-ancestry-hp-bonus.sql"],
]);
const stages = publicationData.stageReceipts.map(link => {
  const file = publicEvidence(path.resolve(runtime, link.file), runtime); assert.equal(file.sha256, link.sha256);
  const stage = z.object({ engineId: z.literal(state.engineId), databaseId: z.literal(db[0].id), file: z.string(), sourceSha256: z.string(), installed: z.boolean().optional() }).passthrough().parse(file.data);
  assert.equal(stage.file, expectedStages.get(path.basename(file.path)), "unexpected installation evidence");
  if (path.basename(file.path) !== "install-hp-bonus-readback.json") assert.equal(stage.installed, true);
  assert.equal(hash(fs.readFileSync(path.join(root, stage.file))), stage.sourceSha256); return file;
});
assert.deepEqual(stages.map(item => path.basename(item.path)).sort(), [...expectedStages.keys()].sort());
const runId = randomUUID(), tag = `ib-a4-${runId}`, observerTag = `${tag}-c`, processes: unknown[] = [], backends: unknown[] = [];
const journalPath = path.join(runtime, `ancestry-hp-recorder-${runId}.json`);
let status = "running";
const journal = () => fs.writeFileSync(journalPath, JSON.stringify({ runId, status, pid: process.pid, parentPid: process.ppid, cwd: root,
  engineId: state.engineId, databaseId: db[0].id, applicationName: tag, processes, backends }, null, 2) + "\n");
assert(!fs.existsSync(journalPath)); journal();
function run(args: string[], input?: string) {
  const startedUtc = new Date().toISOString(), result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
    { cwd: root, input, encoding: "utf8", windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  processes.push({ pid: result.pid, parentPid: process.pid, cwd: root, args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }); journal();
  assert.equal(result.status, 0, "owned read-only native command failed; raw output withheld"); return result.stdout.trim();
}
function sql(text: string, variables: string[] = [], applicationName = tag) {
  return JSON.parse(run(["exec", "-i", "--env", `PGAPPNAME=${applicationName}`, "--env", "PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=5000 -c default_transaction_read_only=on", db[0].id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "supabase_admin",
    "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", ...variables.flatMap(value => ["--set", value]), "--file", "-"], text)) as unknown;
}
let fresh: unknown, profile: ReturnType<typeof validateAncestryHpProfile> | undefined, cleanupConfirmed = false, failed = false, runtimeVerified = false;
try {
  assert.equal(run(["info", "--format", "{{.ID}}"]), state.engineId);
  const identity = JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"status":{{json .State.Status}}}', db[0].id]));
  assert.deepEqual(identity, { id: db[0].id, project: state.project, status: "running" });
  runtimeVerified = true;
  fresh = sql(fs.readFileSync(path.join(root, "supabase/verification/ancestry-hit-points-readback.sql"), "utf8"),
    [`character_id=${story.newCharacterId}`, `control_id=${story.oldControlId}`]);
  const family = sql(fs.readFileSync(path.join(root, "supabase/verification/builder-class-choices-readback.sql"), "utf8"), [`character_id=${story.newCharacterId}`]);
  validateAncestryNativeArtifact({ ...(fresh as Record<string, unknown>), label: story.snapshots[10].label, observedUtc: new Date().toISOString(), processes, family }, story.snapshots[10].data, story.snapshots[10].label);
  profile = validateAncestryHpProfile(sql(fs.readFileSync(path.join(root, "supabase/verification/ancestry-hp-acceptance-profile.sql"), "utf8")), publication.data, story.snapshots[10].data);
  assert.equal(hash(fs.readFileSync(path.join(runtime, "state.json"))), hash(stateBytes), "runtime state changed during recording");
  assert.deepEqual(captureAncestryHpSource(root), source);
  for (const item of [storyFile, wrapperFile, resources, publication, ...stages, ...artifacts]) assert.equal(hash(fs.readFileSync(item.path)), item.sha256, "evidence changed during recording");
} catch { failed = true; }
finally {
  try {
    assert(runtimeVerified, "do not issue native cleanup without the exact owned engine/container proof");
    // Use an independent observer even after Docker-client timeout. Capture
    // unique tag + PID + backend birth before any targeted termination.
    const outstanding = z.array(z.object({ pid: z.number().int().positive(), birth: z.iso.datetime({ offset: true }) }).strict()).parse(sql(`BEGIN READ ONLY;
      SELECT COALESCE(jsonb_agg(jsonb_build_object('pid',pid,'birth',backend_start)),'[]') FROM pg_catalog.pg_stat_activity
      WHERE application_name IN ('${tag}','${observerTag}') AND datname=current_database() AND pid<>pg_backend_pid(); ROLLBACK;`, [], observerTag));
    backends.push(...outstanding); journal();
    for (const backend of outstanding) {
      sql(`BEGIN READ ONLY; SELECT COALESCE(bool_and(pg_catalog.pg_terminate_backend(pid)),true) FROM pg_catalog.pg_stat_activity
        WHERE pid=${backend.pid} AND backend_start='${backend.birth}'::timestamptz AND application_name IN ('${tag}','${observerTag}') AND datname=current_database(); ROLLBACK;`, [], observerTag);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = sql(`BEGIN READ ONLY; SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE application_name IN ('${tag}','${observerTag}') AND datname=current_database() AND pid<>pg_backend_pid(); ROLLBACK;`, [], observerTag);
      if (remaining === 0) { cleanupConfirmed = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch { failed = true; }
  status = !failed && cleanupConfirmed ? "passed" : "failed"; journal();
}
if (failed || !cleanupConfirmed || !profile) throw Error("A4 recording refused; preserve the process journal and original failed evidence; raw output withheld");
assert.deepEqual(captureAncestryHpSource(root), source);
assert.equal(hash(fs.readFileSync(path.join(runtime, "state.json"))), hash(stateBytes));
const link = ({ path: file, sha256 }: { path: string; sha256: string }) => ({ path: file, sha256 });
fs.writeFileSync(output, JSON.stringify({ accepted: true, actualApp: true, caseId: "A4", observedUtc: new Date().toISOString(), ...source, runId: story.runId,
    engineId: state.engineId, databaseId: db[0].id, oldControlId: story.oldControlId, newCharacterId: story.newCharacterId, acceptedNativeSnapshots: 11,
    story: link(storyFile), wrapper: { ...link(wrapperFile), exitCode: wrapper.exitCode, remainingIdentities: [] }, nativeEvidence: artifacts.map(link),
    publication: link(publication), installationEvidence: stages.map(link), freshNativeReadback: fresh, catalog: profile.catalog, nativeProfile: profile,
    cleanup: { remainingBackends: 0, allClientsExited: true }, processJournal: journalPath,
    currentHpAcceptance: "absence preserved only; present-value clamp not accepted", hostedAcceptance: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ accepted: true, caseId: "A4", acceptedNativeSnapshots: 11, output }));
