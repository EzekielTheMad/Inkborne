// Genuine app preparation only. Never installs a fence or fabricates a fixture.
// node --import tsx scripts/record-parent-admission-fixture.ts <story.json> <wrapper-summary.json>
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { captureAncestryHpSource as captureSource } from "./ancestry-hp-acceptance";

const id = z.uuid(), revision = z.string().regex(/^\d+$/), digest = z.string().regex(/^[a-f0-9]{32}$/);
const baseScores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 };
const allocation = z.object({ mode: z.literal("asi"), allocations: z.array(z.object({ ability: z.literal("strength"), amount: z.literal(2) }).strict()).length(1) }).strict();
const nativeSchema = z.object({ kind: z.literal("builder-parent-admission-fixture-readback-v1"), characterId: id, actorId: id, level: z.literal(4),
  actionRevision: revision, fixtureFingerprint: digest, graphFingerprint: digest, enrolled: z.literal(true), originalOccurrenceId: id,
  choices: z.object({ ability_method: z.literal("standard_array"), race: z.literal("human"), background: z.literal("acolyte"),
    classes: z.array(z.object({ slug: z.literal("fighter"), level: z.literal(4), occurrence_id: id }).passthrough()).length(1),
    asi_choices: z.record(z.string(), allocation), starting_equipment: z.object({ confirmed: z.literal(false).optional() }).passthrough().optional() }).passthrough(),
  scores: z.record(z.string(), z.number().int()), state: z.record(z.string(), z.unknown()),
  classRoles: z.object({ status: z.literal("available"), contract_version: z.literal(1), character_id: id, system_id: id, action_revision: revision,
    original_occurrence_id: id, class_sources: z.array(z.object({ role: z.literal("original"), occurrence_id: id, controller_ref_id: id,
      content_id: id, content_version: z.number().int().positive() }).passthrough()).length(1) }).passthrough(),
  startingAwards: z.array(z.object({ status: z.literal("eligible"), canonical_intent: z.null(), receipt: z.null(), completed_at: z.null() }).passthrough()),
  receipts: z.array(z.object({ operationId: id, command: z.string(), fields: z.unknown(), receipt: z.unknown() }).passthrough()),
  firstClassProofs: z.array(z.object({ phase: z.literal("observed"), actorId: id, operationId: id, acceptanceId: id }).passthrough()).length(1),
  orderBijections: z.record(z.string(), z.boolean()), parentOrderRevisionEqual: z.literal(true), capsRemaining: z.literal(0), sealsRemaining: z.literal(0),
  readinessCount: z.literal(13), readyCount: z.literal(0), classGate: z.literal(false), hitDieGate: z.literal(false), servicePrivateUsage: z.literal(false),
}).passthrough();
const eligibilitySchema = z.object({ characterId: id, actorId: id, activeAsiCount: z.literal(1), featureSlug: z.string().regex(/^[a-z0-9-]{1,200}$/),
  legalChangedAbilities: z.array(z.enum(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"])).min(1),
  unawarded: z.literal(true), inventoryCount: z.literal(0), hasStoredCurrentHp: z.literal(false) }).strict();

export const PARENT_ASI_ELIGIBILITY_SQL = `BEGIN READ ONLY;
SELECT jsonb_build_object('characterId',c.id,'actorId',c.user_id,
 'activeAsiCount',(SELECT count(*) FROM public.character_feature_grants x JOIN public.content_versions v
   ON v.content_id=x.feature_content_id AND v.version=x.feature_version WHERE x.character_id=c.id
   AND v.data_snapshot->>'feature_type'='asi' AND private.is_character_feature_grant_active(x.id)),
 'featureSlug',g.feature_slug,
 'legalChangedAbilities',(SELECT COALESCE(jsonb_agg(e.key ORDER BY e.key),'[]') FROM jsonb_each(private.character_ability_scores(c.id,NULL,g.feature_slug,NULL)) e
   WHERE e.key IN ('strength','dexterity','constitution','intelligence','wisdom','charisma') AND jsonb_typeof(e.value)='number' AND (e.value#>>'{}')::numeric<=18
   AND c.choices#>ARRAY['asi_choices',g.feature_slug] IS DISTINCT FROM jsonb_build_object('mode','asi','allocations',jsonb_build_array(jsonb_build_object('ability',e.key,'amount',2)))),
 'unawarded',NOT EXISTS(SELECT 1 FROM public.character_starting_grants a WHERE a.character_id=c.id AND a.status<>'eligible')
   AND NOT COALESCE(c.choices#>'{starting_equipment,confirmed}'='true'::jsonb,false),
 'inventoryCount',(SELECT count(*) FROM public.character_inventory i WHERE i.character_id=c.id),'hasStoredCurrentHp',c.state?'current_hp')
FROM public.characters c JOIN LATERAL (SELECT f.feature_slug FROM public.character_feature_grants f JOIN public.content_versions v
 ON v.content_id=f.feature_content_id AND v.version=f.feature_version WHERE f.character_id=c.id AND v.data_snapshot->>'feature_type'='asi'
 AND private.is_character_feature_grant_active(f.id) AND (SELECT count(*) FROM public.character_feature_grants x WHERE x.character_id=c.id AND x.feature_slug=f.feature_slug)=1
 ORDER BY f.feature_slug LIMIT 1) g ON true WHERE c.id=:'character_id'::uuid AND c.user_id=:'actor_id'::uuid;
ROLLBACK;`;

export function validateParentPreparationNative(input: unknown, eligibilityInput: unknown, characterId: string, actorId: string) {
  const native = nativeSchema.parse(input), eligibility = eligibilitySchema.parse(eligibilityInput);
  for (const value of [native, eligibility]) { assert.equal(value.characterId, characterId); assert.equal(value.actorId, actorId); }
  assert.deepEqual(native.scores, baseScores); assert(!Object.hasOwn(native.state, "current_hp"), "do not invent stored HP for the fixture");
  assert.equal(native.choices.classes[0].occurrence_id, native.originalOccurrenceId);
  assert.equal(native.classRoles.character_id, characterId); assert.equal(native.classRoles.action_revision, native.actionRevision);
  assert.equal(native.classRoles.original_occurrence_id, native.originalOccurrenceId); assert.equal(native.classRoles.class_sources[0].occurrence_id, native.originalOccurrenceId);
  assert.equal(native.firstClassProofs[0].actorId, actorId);
  assert.deepEqual(Object.keys(native.orderBijections).sort(), ["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  assert(Object.values(native.orderBijections).every(value => value === true));
  assert(!native.receipts.some(item => item.command === "award_equipment"));
  for (const command of ["save_abilities", "select_background", "select_asi", "select_equipment", "set_class_level"])
    assert(native.receipts.some(item => item.command === command), `missing genuine ${command} receipt`);
  assert.deepEqual(Object.keys(native.choices.asi_choices), [eligibility.featureSlug]);
  return { native, eligibility };
}

const storySchema = z.object({ actualApp: z.literal(true), actualAuthCookies: z.literal(true), actualPostgrest: z.literal(true), uiWritesOnly: z.literal(true),
  fixtureKind: z.literal("unawarded-fighter4-acolyte"), allSixAbilityScoresSaved: z.literal(true), equipmentConfirmEnabledButNotClicked: z.literal(true),
  runId: id, actorId: id, characterId: id, source: z.object({ head: z.string().regex(/^[a-f0-9]{40}$/), diffSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  nativePath: z.string(), native: nativeSchema, eligibility: eligibilitySchema, blockedOrigins: z.array(z.string()).length(0), pageErrors: z.array(z.string()).length(0),
}).passthrough();

async function main() {
  assert.equal(process.argv.length, 4, "provide the actual preparation story and its exact wrapper summary");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), runtime = path.resolve(root, "../equipment-runtime/app-flow-runtime");
  const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
  const file = (target: string, base: string) => {
    const lexical = path.resolve(target), actual = fs.realpathSync(lexical), allowed = fs.realpathSync(base);
    assert(lexical.startsWith(allowed + path.sep) && actual.startsWith(allowed + path.sep), "public evidence escaped its root");
    assert(!actual.split(/[\\/]/).some(part => /private|secret|credential/i.test(part))); assert(fs.statSync(actual).isFile());
    const bytes = fs.readFileSync(actual); return { path: actual, sha256: hash(bytes), data: JSON.parse(bytes.toString("utf8")) as unknown };
  };
  const storyFile = file(process.argv[2], path.join(root, "test-results/local-app")), story = storySchema.parse(storyFile.data);
  assert.deepEqual(story.source, captureSource(root), "actual preparation source changed");
  validateParentPreparationNative(story.native, story.eligibility, story.characterId, story.actorId);
  const wrapperFile = file(process.argv[3], path.resolve(runtime, "../evidence"));
  const wrapper = z.object({ gate: z.literal("parent-preparation-app"), runId: z.literal(story.runId), exitCode: z.literal(0), remainingIdentities: z.array(z.unknown()).length(0),
    command: z.literal("npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts parent-admission-preparation.spec.ts"), finishedUtc: z.iso.datetime({ offset: true }) }).passthrough().parse(wrapperFile.data);
  const started = z.object({ utc: z.iso.datetime({ offset: true }) }).parse(file(path.join(path.dirname(wrapperFile.path), "resources-before.json"), path.dirname(wrapperFile.path)).data).utc;
  const artifactFile = file(story.nativePath, path.dirname(storyFile.path));
  for (const item of [storyFile, artifactFile]) assert(fs.statSync(item.path).mtimeMs >= Date.parse(started) && fs.statSync(item.path).mtimeMs <= Date.parse(wrapper.finishedUtc));
  const artifact = z.object({ observedUtc: z.iso.datetime({ offset: true }), native: nativeSchema, eligibility: eligibilitySchema,
    processes: z.array(z.object({ pid: z.number().int().positive(), exitCode: z.literal(0) }).passthrough()).length(4) }).passthrough().parse(artifactFile.data);
  assert.deepEqual(artifact.native, story.native); assert.deepEqual(artifact.eligibility, story.eligibility);
  const stateBytes = fs.readFileSync(path.join(runtime, "state.json"));
  const state = z.object({ project: z.literal("inkborne-app-flow-20261022"), catalogMode: z.literal("real-srd"), ready: z.literal(true), stoppedUtc: z.never().optional(), engineId: z.string().min(1),
    containers: z.array(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), name: z.string() })) }).passthrough().parse(JSON.parse(stateBytes.toString("utf8")));
  const db = state.containers.filter(item => item.name === `/${state.project}-db`); assert.equal(db.length, 1);
  const installFile = file(path.join(runtime, "install-parent-admission-readback.json"), runtime);
  const install = z.object({ installed: z.literal(true), engineId: z.literal(state.engineId), databaseId: z.literal(db[0].id),
    file: z.literal("supabase/staged/character-builder-parent-admission.sql"), sourceSha256: z.literal("0b19cc210223575fa194e8b1f46b1cf50e18683788bdea9d8b77be1851887202") }).passthrough().parse(installFile.data);
  assert.equal(hash(fs.readFileSync(path.join(root, install.file))), install.sourceSha256);
  const output = path.join(runtime, `parent-admission-fixture-${story.runId}.json`); assert(!fs.existsSync(output), "preserve existing fixture evidence");
  const tag = `ib-pf-${randomUUID()}`, observer = `${tag}-c`, processes: unknown[] = [], captured: unknown[] = [];
  const journalPath = path.join(runtime, `parent-preparation-recorder-${story.runId}.json`); assert(!fs.existsSync(journalPath));
  let verified = false, clean = false, failed = false;
  const journal = () => fs.writeFileSync(journalPath, JSON.stringify({ pid: process.pid, parentPid: process.ppid, cwd: root, tag, observer, processes, captured, clean, failed }, null, 2) + "\n"); journal();
  const run = (args: string[], input?: string) => {
    const startedUtc = new Date().toISOString(), result = spawnSync("C:/Users/kaios/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe", ["--context", "desktop-linux", ...args],
      { cwd: root, input, encoding: "utf8", windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
    processes.push({ pid: result.pid, parentPid: process.pid, cwd: root, args, startedUtc, finishedUtc: new Date().toISOString(), exitCode: result.status }); journal();
    assert.equal(result.status, 0, "owned preparation readback failed; raw output withheld"); return result.stdout.trim();
  };
  const sql = (text: string, name = tag) => JSON.parse(run(["exec", "-i", "--env", `PGAPPNAME=${name}`, "--env", "PGOPTIONS=-c statement_timeout=15000 -c lock_timeout=5000 -c default_transaction_read_only=on",
    db[0].id, "psql", "-X", "--no-password", "--host", "/var/run/postgresql", "--username", "postgres", "--dbname", "postgres", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1",
    "--set", `character_id=${story.characterId}`, "--set", `actor_id=${story.actorId}`, "--file", "-"], text)) as unknown;
  try {
    assert.equal(run(["info", "--format", "{{.ID}}"]), state.engineId);
    assert.deepEqual(JSON.parse(run(["inspect", "--format", '{"id":{{json .Id}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"status":{{json .State.Status}}}', db[0].id])),
      { id: db[0].id, project: state.project, status: "running" }); verified = true;
    const native = sql(fs.readFileSync(path.join(root, "supabase/verification/builder-parent-admission-readback.sql"), "utf8")), eligibility = sql(PARENT_ASI_ELIGIBILITY_SQL);
    validateParentPreparationNative(native, eligibility, story.characterId, story.actorId); assert.deepEqual(native, story.native); assert.deepEqual(eligibility, story.eligibility);
  } catch { failed = true; }
  finally {
    try {
      assert(verified, "cleanup requires the exact owned runtime identity");
      const outstanding = z.array(z.object({ pid: z.number().int().positive(), birth: z.iso.datetime({ offset: true }) }).strict()).parse(sql(`BEGIN READ ONLY;
        SELECT COALESCE(jsonb_agg(jsonb_build_object('pid',pid,'birth',backend_start)),'[]') FROM pg_stat_activity WHERE datname=current_database()
        AND application_name IN ('${tag}','${observer}') AND pid<>pg_backend_pid(); ROLLBACK;`, observer));
      captured.push(...outstanding); journal();
      for (const backend of outstanding) sql(`BEGIN READ ONLY; SELECT to_json(COALESCE(bool_and(pg_terminate_backend(pid)),true)) FROM pg_stat_activity
        WHERE pid=${backend.pid} AND backend_start='${backend.birth}'::timestamptz AND datname=current_database() AND application_name IN ('${tag}','${observer}'); ROLLBACK;`, observer);
      for (let attempt = 0; attempt < 3; attempt++) {
        const remaining = sql(`BEGIN READ ONLY; SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name IN ('${tag}','${observer}') AND pid<>pg_backend_pid(); ROLLBACK;`, observer);
        if (remaining === 0) { clean = true; break; } await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch { failed = true; } journal();
  }
  assert(!failed && clean, "preparation recording refused; preserve process journal; raw output withheld");
  assert.deepEqual(captureSource(root), story.source); assert.equal(hash(fs.readFileSync(path.join(runtime, "state.json"))), hash(stateBytes));
  for (const item of [storyFile, wrapperFile, artifactFile, installFile]) assert.equal(hash(fs.readFileSync(item.path)), item.sha256);
  const link = ({ path: filePath, sha256 }: { path: string; sha256: string }) => ({ path: filePath, sha256 });
  fs.writeFileSync(output, JSON.stringify({ version: 1, purpose: "parent-admission-genuine-fighter4", actorId: story.actorId, characterId: story.characterId,
    sourceSha: story.source.head, fixtureFingerprint: story.native.fixtureFingerprint, engineId: state.engineId, databaseId: db[0].id,
    story: link(storyFile), wrapper: link(wrapperFile), parentInstall: link(installFile), nativeEvidence: link(artifactFile), processJournal: journalPath,
    actualBrowserPreparation: true, nativeContentionAccepted: false, fullParentAcceptance: false, cleanup: { allCapturedBackendsGone: true, allClientsExited: true },
    physicalEligibleGrantCreated: false }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ prepared: true, characterId: story.characterId, output, fullParentAcceptance: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
