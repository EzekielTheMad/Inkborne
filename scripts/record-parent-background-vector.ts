// Explicit native fixture runner. Does not start a runtime or create Auth rows.
// node --import tsx scripts/record-parent-background-vector.ts <positive-story.json>
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { captureAncestryHpSource } from "./ancestry-hp-acceptance";
import { validateParentPositiveStory, validateParentObservation, validateParentBackgroundVector } from "./parent-admission-acceptance";
import { readParentEvidence, parentFileLink, readParentLink, assertParentFilesUnchanged, openParentEvidenceRuntime, hashParentEvidence } from "./parent-acceptance-files";

async function main() {
  assert.equal(process.argv.length, 3, "provide one completed positive app story");
  const root = process.cwd(), directory = path.resolve(root, "../equipment-runtime/app-flow-runtime");
  assert.equal(fs.realpathSync(root), fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")), "run from this exact checkout");
  assert.equal(path.basename(root), "equipment-verification", "integrate source before native execution");
  const storyFile = readParentEvidence(process.argv[2], path.join(root, "test-results/local-app")), story = validateParentPositiveStory(storyFile.data);
  const source = captureAncestryHpSource(root); assert.deepEqual(story.source, source);
  const nativeFile = readParentLink(story.nativeEvidence, directory);
  const native = z.object({ passed: z.literal(true), engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId),
    authenticationAccepted: z.literal(false), fixture: z.object({ characterId: z.literal(story.characterId), actorId: z.literal(story.actorId) }),
    cleanup: z.object({ allCapturedBackendsGone: z.literal(true), allClientsExited: z.literal(true) }) }).passthrough().parse(nativeFile.data); void native;
  const output = path.join(directory, `parent-background-native-${story.runId}.json`); assert(!fs.existsSync(output), "preserve previous native evidence");
  const { runtime, assertClosure, assertParentProfiles, expected } = await openParentEvidenceRuntime(directory);
  let phase = "identity", failed = false, vector: ReturnType<typeof validateParentBackgroundVector> | undefined, before: unknown, after: unknown, cleanup: unknown;
  const readSource = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
  const files = [storyFile, nativeFile];
  const variables = [`character_id=${story.roguePreparation.characterId}`, `actor_id=${story.actorId}`];
  const observe = () => validateParentObservation({
    native: runtime.json(readSource("supabase/verification/builder-parent-admission-readback.sql"), { variables }),
    detail: runtime.json(readSource("supabase/verification/builder-parent-positive-detail.sql"), { variables }),
    family: runtime.json(readSource("supabase/verification/builder-class-choices-readback.sql"), { variables: [variables[0]] }),
  }, story.roguePreparation.characterId, story.actorId);
  try {
    runtime.verify(); assert.equal(runtime.engineId, story.engineId); assert.equal(runtime.databaseId, story.databaseId);
    before = runtime.closure(); assertClosure(before, true); assertParentProfiles(before);
    assert.deepEqual(observe(), story.roguePreparation.snapshot.data, "genuine Rogue fixture drifted");
    phase = "rollback-native-vector";
    vector = validateParentBackgroundVector(runtime.json(readSource("supabase/verification/builder-parent-background-vector.sql"), { role: "supabase_admin", variables }),
      story.roguePreparation.characterId, story.actorId);
    phase = "independent-rollback-readback";
    runtime.verify(); after = runtime.closure(); assertClosure(after, true); assertParentProfiles(after); assert.deepEqual(after, before, "rollback changed global rows/catalog/profile");
    assert.deepEqual(observe(), story.roguePreparation.snapshot.data, "rollback changed genuine Rogue fixture");
    const ids = vector.privateFixtures.map(item => `'${item.id}'::uuid`).join(",");
    assert.deepEqual(runtime.json(`BEGIN READ ONLY; SELECT jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions WHERE id IN(${ids})),
      'snapshots',(SELECT count(*) FROM public.content_versions WHERE content_id IN(${ids}))); ROLLBACK;`), { definitions: 0, snapshots: 0 });
    assertParentFilesUnchanged(files); assert.deepEqual(captureAncestryHpSource(root), source);
  } catch { failed = true; }
  try { cleanup = await runtime.cleanup(); } catch { failed = true; }
  runtime.finish();
  fs.writeFileSync(output, JSON.stringify({ kind: "parent-background-native-report-v1", passed: !failed, authenticationAccepted: false, phase,
    source, engineId: runtime.engineId, databaseId: runtime.databaseId, positiveAppEvidence: parentFileLink(storyFile), nativeEvidence: parentFileLink(nativeFile),
    vector, before, after, cleanup, processJournal: runtime.journalPath, externalSources: expected,
    vectorSourceSha256: hashParentEvidence(readSource("supabase/verification/builder-parent-background-vector.sql")) }, null, 2) + "\n", { flag: "wx" });
  assert(!failed, "native background verification refused; preserve its report/journal; raw output withheld");
  console.log(JSON.stringify({ passed: true, output, authenticationAccepted: false }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Native verification refused"); process.exitCode = 1; });
