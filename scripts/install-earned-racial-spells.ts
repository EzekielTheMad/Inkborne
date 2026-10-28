// SOURCE ONLY until a separately released, serialized disposable-local slot.
// node --import tsx scripts/install-earned-racial-spells.ts install <engine-id> <database-container-id>
// Imports are inert. This starts no runtime, reads no credentials, publishes no
// catalog root and creates no parent/A4/A6 acceptance from installation success.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { EARNED_RACIAL_STAGE, validateEarnedRacialStage, validateEarnedRacialPrerequisites,
  validateEarnedRacialPreimage, validateEarnedRacialPostimage, type EarnedRacialProfile } from "./earned-racial-installation";
import { validateAncestryHpStory, validateAncestryHpWrapper, validateAncestryNativeArtifact,
  validateAncestryHpProfile } from "./ancestry-hp-acceptance";
import { validateParentPositiveStory, validateParentPositiveWrapper, validateParentNativeReport } from "./parent-admission-acceptance";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const linkSchema = z.object({ path: z.string().min(1), sha256: hashSchema }).passthrough();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.resolve(root, "../equipment-runtime/app-flow-runtime");
const docker = "C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
const profileFile = "supabase/verification/earned-racial-installation-profile.sql";
const profileSha = "fb8b96b90b90f20de2a770208d22595f68770f82701d666185b72eed3ef664e1";
type PublicFile = { path: string; sha256: string; data: unknown };

export async function installEarnedRacialSpells(args: string[]) {
  assert(args.length === 3 && args[0] === "install", "provide install and both exact owned engine/database identities");
  const expectedEngine = z.string().regex(/^[a-zA-Z0-9-]{5,100}$/).parse(args[1]);
  const expectedDatabase = hashSchema.parse(args[2]);
  assert.equal(fs.realpathSync(process.cwd()), fs.realpathSync(root), "run from the exact current checkout");
  // The authoritative checkout is a deliberate finite target. A worker or old
  // backup cannot point this command at the shared disposable runtime.
  assert.equal(path.basename(root), "equipment-verification", "integrate this source before native execution");
  const statePath = path.join(runtime, "state.json"), stateBytes = fs.readFileSync(statePath);
  const state = z.object({ project: z.literal("inkborne-app-flow-20261022"), catalogMode: z.literal("real-srd"), ready: z.literal(true),
    stoppedUtc: z.never().optional(), engineId: z.literal(expectedEngine),
    containers: z.array(z.object({ name: z.string(), id: hashSchema })).length(5),
  }).parse(JSON.parse(stateBytes.toString("utf8")));
  const databases = state.containers.filter(item => item.name === `/${state.project}-db`);
  assert.equal(databases.length, 1); assert.equal(databases[0].id, expectedDatabase);
  assert.equal(new Set(state.containers.map(item => item.id)).size, 5);
  const stageRaw = fs.readFileSync(path.join(root, EARNED_RACIAL_STAGE.file)), stage = validateEarnedRacialStage(stageRaw);
  const profileRaw = fs.readFileSync(path.join(root, profileFile)), profileSql = profileRaw.toString("utf8").replaceAll("\r\n", "\n");
  assert.equal(sha(profileSql), profileSha, "reviewed read-only profile source changed");
  const output = path.join(runtime, "install-earned-racial-spells-readback.json");
  assert(!fs.existsSync(output), "preserve previous installation evidence");
  const files: PublicFile[] = [];
  function publicFile(file: string, base = runtime): PublicFile {
    const lexical = path.resolve(file), actual = fs.realpathSync(lexical), allowed = fs.realpathSync(base);
    assert(actual.startsWith(allowed + path.sep) && lexical.startsWith(allowed + path.sep), "evidence escaped its finite public root");
    for (const candidate of [lexical, actual]) assert(!candidate.split(/[\\/]/).some(part => /private|credential|secret/i.test(part)), "public evidence required");
    assert(fs.statSync(actual).isFile() && fs.statSync(actual).size <= 32 * 1024 * 1024, "finite public evidence file required");
    const bytes = fs.readFileSync(actual), item = { path: actual, sha256: sha(bytes), data: JSON.parse(bytes.toString("utf8")) as unknown };
    files.push(item); return item;
  }
  function linked(input: unknown, base = runtime) {
    const link = linkSchema.parse(input), item = publicFile(link.path, base); assert.equal(item.sha256, link.sha256, "prerequisite evidence hash changed"); return item;
  }
  const parentFile = publicFile(path.join(runtime, "parent-admission-actual-readback.json"));
  const parent = z.object({ parentInstallReceipt: linkSchema, nativeEvidence: linkSchema, positiveAppEvidence: linkSchema,
    wrapperEvidence: linkSchema, backgroundNativeEvidence: linkSchema, wrapper: z.unknown() }).passthrough().parse(parentFile.data);
  const parentInstall = linked(parent.parentInstallReceipt); assert.equal(path.basename(parentInstall.path), "install-parent-admission-readback.json");
  const parentNative = linked(parent.nativeEvidence), parentApp = linked(parent.positiveAppEvidence, path.join(root, "test-results/local-app"));
  const parentStory = validateParentPositiveStory(parentApp.data); validateParentNativeReport(parentNative.data, parentStory);
  const parentWrapper = linked(parent.wrapperEvidence, path.resolve(runtime, "../evidence")); assert.equal(path.basename(parentWrapper.path), "summary.json");
  validateParentPositiveWrapper(parentWrapper.data, parentStory.runId); assert.deepEqual(parent.wrapper, parentWrapper.data);
  const parentBackground = linked(parent.backgroundNativeEvidence), background = z.object({ positiveAppEvidence: linkSchema,
    nativeEvidence: linkSchema, vectorSourceSha256: hashSchema }).passthrough().parse(parentBackground.data);
  assert.deepEqual(background.positiveAppEvidence, parent.positiveAppEvidence); assert.deepEqual(background.nativeEvidence, parent.nativeEvidence);
  assert.equal(background.vectorSourceSha256, sha(fs.readFileSync(path.join(root, "supabase/verification/builder-parent-background-vector.sql"), "utf8")));
  const a4File = publicFile(path.join(runtime, "ancestry-hit-points-actual-readback.json"));
  const a4 = z.object({ story: linkSchema, wrapper: linkSchema, nativeEvidence: z.array(linkSchema).length(11),
    publication: linkSchema, installationEvidence: z.array(linkSchema).length(3), freshNativeReadback: z.unknown(), nativeProfile: z.unknown(),
  }).passthrough().parse(a4File.data);
  const a4Story = linked(a4.story, path.join(root, "test-results/local-app")), story = validateAncestryHpStory(a4Story.data);
  const a4Wrapper = linked(a4.wrapper, path.resolve(runtime, "../evidence")), wrapper = validateAncestryHpWrapper(a4Wrapper.data, story.runId);
  const resources = publicFile(path.join(path.dirname(a4Wrapper.path), "resources-before.json"), path.dirname(a4Wrapper.path));
  const startedUtc = z.object({ utc: z.iso.datetime({ offset: true }) }).parse(resources.data).utc;
  const artifacts = a4.nativeEvidence.map((link, index) => {
    const artifact = linked(link, path.dirname(a4Story.path)), snapshot = story.snapshots[index];
    assert.equal(artifact.path, fs.realpathSync(snapshot.path));
    validateAncestryNativeArtifact(artifact.data, snapshot.data, snapshot.label); return artifact;
  });
  assert.equal(new Set(artifacts.map(item => item.path)).size, 11);
  for (const file of [a4Story, ...artifacts]) assert(fs.statSync(file.path).mtimeMs >= Date.parse(startedUtc)
    && fs.statSync(file.path).mtimeMs <= Date.parse(wrapper.finishedUtc), "A4 artifact lies outside its bounded actual run");
  const publication = linked(a4.publication);
  const allowedStages = new Map([
    ["install-hp-bonus-readback.json", "supabase/staged/character-builder-hp-bonus.sql"],
    ["install-parent-admission-readback.json", "supabase/staged/character-builder-parent-admission.sql"],
    ["install-ancestry-hp-bonus-readback.json", "supabase/staged/character-builder-ancestry-hp-bonus.sql"],
  ]);
  const stageFiles = a4.installationEvidence.map(input => {
    const file = linked(input), data = z.object({ engineId: z.literal(expectedEngine), databaseId: z.literal(expectedDatabase),
      file: z.string(), sourceSha256: hashSchema, installed: z.boolean().optional() }).passthrough().parse(file.data);
    assert.equal(allowedStages.get(path.basename(file.path)), data.file, "unexpected A4 stage receipt");
    if (path.basename(file.path) !== "install-hp-bonus-readback.json") assert.equal(data.installed, true);
    assert.equal(sha(fs.readFileSync(path.join(root, data.file))), data.sourceSha256); return file;
  });
  assert.deepEqual(stageFiles.map(item => path.basename(item.path)).sort(), [...allowedStages.keys()].sort());
  const ancestryInstall = stageFiles.find(item => path.basename(item.path) === "install-ancestry-hp-bonus-readback.json")!;
  assert.equal(stageFiles.find(item => path.basename(item.path) === "install-parent-admission-readback.json")!.sha256, parentInstall.sha256);
  const finalSnapshot = story.snapshots[10];
  validateAncestryHpProfile(a4.nativeProfile, publication.data, finalSnapshot.data);
  assert.deepEqual(a4.freshNativeReadback, finalSnapshot.data, "A4 accepted final readback changed");

  const runId = randomUUID(), tag = `ib-f3-${runId}`, observerTag = `${tag}-c`;
  const journalPath = path.join(runtime, `earned-racial-installation-${runId}.json`);
  type ProcessRecord = { pid: number | null; parentPid: number; executable: string; args: string[]; cwd: string; ports: [];
    startedUtc: string; finishedUtc: string; exitCode: number | null; signal: string | null };
  const processes: ProcessRecord[] = [], backends: unknown[] = [];
  let phase = "prerequisites", runtimeVerified = false, installationMayHaveCommitted = false, completed = false, cleanupConfirmed = false;
  let before: EarnedRacialProfile | undefined, after: EarnedRacialProfile | undefined;
  const baseJournal = { kind: "earned-racial-installation-attempt-v1", runId, pid: process.pid, parentPid: process.ppid, cwd: root,
    engineId: expectedEngine, databaseId: expectedDatabase, applicationName: tag, observedUtc: new Date().toISOString(), hostedAcceptance: false };
  const journal = () => fs.writeFileSync(journalPath, JSON.stringify({ ...baseJournal, phase, installationMayHaveCommitted,
    completed, cleanupConfirmed, processes, backends }, null, 2) + "\n");
  fs.writeFileSync(journalPath, "{}\n", { flag: "wx" }); journal();
  function run(executable: string, args: string[], input?: string, timeout = 45000) {
    const startedUtc = new Date().toISOString(), result = spawnSync(executable, args,
      { cwd: root, input, encoding: "utf8", windowsHide: true, shell: false, timeout, maxBuffer: 24 * 1024 * 1024 });
    processes.push({ pid: result.pid ?? null, parentPid: process.pid, executable, args, cwd: root, ports: [], startedUtc,
      finishedUtc: new Date().toISOString(), exitCode: result.status, signal: result.signal ?? null }); journal();
    assert.equal(result.status, 0, "owned finite command failed; raw output withheld"); return result.stdout.trim();
  }
  const sourcePaths = ["app", "components", "lib", "scripts", "supabase", "e2e", "proxy.ts", "next.config.ts", "package.json", "package-lock.json"];
  function captureSource() {
    assert.equal(run("git", ["ls-files", "--others", "--exclude-standard", "--", ...sourcePaths]), "", "commit new sources before installing");
    const head = run("git", ["rev-parse", "HEAD"]); assert(/^[a-f0-9]{40}$/.test(head));
    const diff = run("git", ["diff", "--binary", "HEAD", "--", ...sourcePaths]); assert.equal(diff, "", "commit all candidate source changes before installing");
    return { head, diffSha256: sha(diff) };
  }
  function unchangedFiles() {
    assert.equal(sha(fs.readFileSync(statePath)), sha(stateBytes), "runtime state changed");
    assert.equal(sha(fs.readFileSync(path.join(root, EARNED_RACIAL_STAGE.file))), sha(stageRaw));
    assert.equal(sha(fs.readFileSync(path.join(root, profileFile))), sha(profileRaw));
    for (const file of files) assert.equal(sha(fs.readFileSync(file.path)), file.sha256, "linked prerequisite bytes changed");
  }
  function verifyOwnedTarget() {
    assert.equal(run(docker, ["--context", "desktop-linux", "info", "--format", "{{.ID}}"]), expectedEngine);
    const actual = JSON.parse(run(docker, ["--context", "desktop-linux", "inspect", "--format",
      '{"id":{{json .Id}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"status":{{json .State.Status}}}', expectedDatabase]));
    assert.deepEqual(actual, { id: expectedDatabase, project: state.project, status: "running" });
  }
  function verifyRuntime() { unchangedFiles(); verifyOwnedTarget(); }
  function sql(text: string, { role = "postgres", applicationName = tag, variables = [], install = false }:
    { role?: "postgres" | "supabase_admin"; applicationName?: string; variables?: string[]; install?: boolean } = {}) {
    assert(runtimeVerified, "owned runtime identity proof required before SQL");
    assert([tag, observerTag].includes(applicationName));
    assert(variables.every(value => /^(character_id|control_id)=[a-f0-9-]{36}$/.test(value)));
    const result = run(docker, ["--context", "desktop-linux", "exec", "-i", "--env", `PGAPPNAME=${applicationName}`,
      "--env", `PGOPTIONS=-c statement_timeout=${install ? 60000 : 15000} -c lock_timeout=5000${install ? "" : " -c default_transaction_read_only=on"}`,
      expectedDatabase, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", role, "--dbname", "postgres",
      "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--set", "VERBOSITY=sqlstate",
      ...variables.flatMap(value => ["--set", value]), "--file", "-"], text, install ? 90000 : 45000);
    return install ? undefined : JSON.parse(result) as unknown;
  }
  function freshA4() {
    const native = sql(fs.readFileSync(path.join(root, "supabase/verification/ancestry-hit-points-readback.sql"), "utf8"),
      { variables: [`character_id=${story.newCharacterId}`, `control_id=${story.oldControlId}`] });
    const family = sql(fs.readFileSync(path.join(root, "supabase/verification/builder-class-choices-readback.sql"), "utf8"),
      { variables: [`character_id=${story.newCharacterId}`] });
    validateAncestryNativeArtifact({ ...(native as Record<string, unknown>), label: finalSnapshot.label,
      observedUtc: new Date().toISOString(), processes, family }, finalSnapshot.data, finalSnapshot.label);
  }
  let source: ReturnType<typeof captureSource> | undefined;
  try {
    source = captureSource(); assert.deepEqual(story.source, source);
    validateEarnedRacialPrerequisites({ parent: parentFile.data, parentNative: parentNative.data, parentApp: parentApp.data,
      parentBackground: parentBackground.data, parentInstallation: parentInstall.data, ancestry: a4File.data, ancestryInstallation: ancestryInstall.data },
    { engineId: expectedEngine, databaseId: expectedDatabase }, source);
    verifyRuntime(); runtimeVerified = true;
    phase = "preimage"; journal();
    before = validateEarnedRacialPreimage(sql(profileSql), a4.nativeProfile, stage.parentProfiles); freshA4();
    assert.deepEqual(captureSource(), source); verifyRuntime();
    phase = "install"; installationMayHaveCommitted = true; journal();
    sql(stage.sql, { role: "supabase_admin", install: true });
    phase = "read-only-postimage"; journal(); verifyRuntime();
    after = validateEarnedRacialPostimage(before, sql(profileSql)); freshA4();
    assert.deepEqual(captureSource(), source); unchangedFiles(); completed = true;
  } finally {
    phase = completed ? "cleanup" : `failed-${phase}`; journal();
    if (runtimeVerified) {
      try {
        // Cleanup is still attempted after source/evidence/state drift. Only
        // the captured engine/container and unique tagged backend identities
        // authorize it; drifting prerequisite files never authorize a write.
        verifyOwnedTarget();
        const native = z.array(z.object({ pid: z.number().int().positive(), birth: z.iso.datetime({ offset: true }),
          database: z.literal("postgres"), actor: z.enum(["postgres", "supabase_admin"]), tag: z.enum([tag, observerTag]),
        }).strict()).parse(sql(`SELECT COALESCE(jsonb_agg(jsonb_build_object('pid',pid,'birth',backend_start,'database',datname,'actor',usename,'tag',application_name)),'[]')
          FROM pg_catalog.pg_stat_activity WHERE application_name IN ('${tag}','${observerTag}') AND pid<>pg_backend_pid()`, { role: "supabase_admin", applicationName: observerTag }));
        backends.push(...native); journal();
        for (const backend of native) assert.equal(sql(`SELECT COALESCE(bool_and(pg_catalog.pg_terminate_backend(pid)),true)
          FROM pg_catalog.pg_stat_activity WHERE pid=${backend.pid} AND backend_start='${backend.birth}'::timestamptz
          AND datname='postgres' AND usename='${backend.actor}' AND application_name='${backend.tag}'`, { role: "supabase_admin", applicationName: observerTag }), true);
        for (let attempt = 0; attempt < 3; attempt++) {
          const remaining = sql(`SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE application_name IN ('${tag}','${observerTag}') AND pid<>pg_backend_pid()`,
            { role: "supabase_admin", applicationName: observerTag });
          if (remaining === 0) { cleanupConfirmed = true; break; }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch { cleanupConfirmed = false; }
    }
    phase = completed && cleanupConfirmed ? "passed" : "failed"; journal();
  }
  assert(completed && cleanupConfirmed && before && after && source, "installation or cleanup unconfirmed; preserve its attempt journal");
  assert(processes.every(item => item.exitCode === 0), "a finite client did not exit successfully");
  assert.deepEqual(captureSource(), source); unchangedFiles();
  const publicProfile = (value: EarnedRacialProfile) => ({ ...value, functions: value.functions.map(({ oid, signature, bodyMd5, profile, owner, execute }) => ({ oid, signature, bodyMd5, profile, owner, execute })) });
  const link = ({ path: file, sha256 }: PublicFile) => ({ path: file, sha256 });
  fs.writeFileSync(output, JSON.stringify({ installed: true, file: EARNED_RACIAL_STAGE.file, sourceSha256: stage.sourceSha256,
    sourceRawSha256: stage.sourceRawSha256, sourceSha: source.head, source, observedUtc: new Date().toISOString(), engineId: expectedEngine,
    databaseId: expectedDatabase, runId, prerequisites: files.map(link), before: publicProfile(before), after: publicProfile(after),
    detailedBefore: before, detailedAfter: after, processJournal: journalPath,
    cleanup: { remainingBackends: 0, allClientsExited: true }, actualAppAcceptance: false, ancestryPublication: false,
    earnedRacialSpellAcceptance: false, hostedAcceptance: false }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ installed: true, file: EARNED_RACIAL_STAGE.file, output, actualAppAcceptance: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void installEarnedRacialSpells(process.argv.slice(2)).catch(() => {
    console.error("Finite F3 installation refused; preserve the attempt journal if created. Raw output withheld."); process.exitCode = 1;
  });
}
