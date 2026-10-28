// Read-only aggregate; never installs, starts services or manufactures a pass.
// node --import tsx scripts/record-parent-admission-acceptance.ts <positive-story.json> <wrapper-summary.json> <background-native.json>
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { captureAncestryHpSource } from "./ancestry-hp-acceptance";
import { validateParentPreparationNative } from "./parent-admission-fixture";
import { PARENT_ACCEPTANCE_CHECKS, parentLinkSchema, validateParentPositiveStory, validateParentObservation, validateParentPositiveWrapper,
  validateParentBackgroundVector, validateParentNativeReport, validateParentPositiveArtifact, PARENT_NATIVE_SOURCES, PARENT_NATIVE_EXTERNAL_SOURCES } from "./parent-admission-acceptance";
import { readParentEvidence, readParentLink, parentFileLink, assertParentFilesUnchanged, openParentEvidenceRuntime, hashParentEvidence, type ParentFile } from "./parent-acceptance-files";

async function main() {
  assert.equal(process.argv.length, 5, "provide actual app story, exact wrapper and rollback-native report");
  const root = process.cwd(), directory = path.resolve(root, "../equipment-runtime/app-flow-runtime"), appRoot = path.join(root, "test-results/local-app");
  assert.equal(fs.realpathSync(root), fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")), "run from this exact checkout");
  assert.equal(path.basename(root), "equipment-verification", "integrate source before native recording");
  const output = path.join(directory, "parent-admission-actual-readback.json"); assert(!fs.existsSync(output), "preserve previous accepted evidence");
  const storyFile = readParentEvidence(process.argv[2], appRoot), story = validateParentPositiveStory(storyFile.data), source = captureAncestryHpSource(root);
  assert.deepEqual(story.source, source, "actual source changed");
  const wrapperFile = readParentEvidence(process.argv[3], path.resolve(directory, "../evidence")), wrapper = validateParentPositiveWrapper(wrapperFile.data, story.runId);
  const resourcesFile = readParentEvidence(path.join(path.dirname(wrapperFile.path), "resources-before.json"), path.dirname(wrapperFile.path));
  const started = z.object({ utc: z.iso.datetime({ offset: true }) }).parse(resourcesFile.data).utc;
  assert(Date.parse(started) < Date.parse(wrapper.finishedUtc));
  const files: ParentFile[] = [storyFile, wrapperFile, resourcesFile];
  for (const snapshot of [...story.snapshots, ...story.fiendSnapshots, story.roguePreparation.snapshot, story.fiendControl.before, story.fiendControl.after]) {
    const file = readParentEvidence(snapshot.path, path.dirname(storyFile.path)); files.push(file);
    validateParentPositiveArtifact(file.data, story, snapshot);
    assert(fs.statSync(file.path).mtimeMs >= Date.parse(started) && fs.statSync(file.path).mtimeMs <= Date.parse(wrapper.finishedUtc), "native artifact outside wrapper");
  }
  assert(fs.statSync(storyFile.path).mtimeMs >= Date.parse(started) && fs.statSync(storyFile.path).mtimeMs <= Date.parse(wrapper.finishedUtc));
  assert.equal(new Set(files.map(file => file.path)).size, files.length, "distinct standalone artifacts required");
  const descriptorFile = readParentLink(story.preparation, directory), descriptor = z.object({ purpose: z.literal("parent-admission-genuine-fighter4"), version: z.literal(1),
    actorId: z.literal(story.actorId), characterId: z.literal(story.characterId), engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId),
    actualBrowserPreparation: z.literal(true), parentInstall: parentLinkSchema, story: parentLinkSchema, wrapper: parentLinkSchema,
    cleanup: z.object({ allCapturedBackendsGone: z.literal(true), allClientsExited: z.literal(true) }) }).passthrough().parse(descriptorFile.data);
  files.push(descriptorFile);
  const preparationFile = readParentLink(descriptor.story, appRoot), preparation = z.object({ native: z.unknown(), eligibility: z.unknown(),
    actualApp: z.literal(true), actualAuthCookies: z.literal(true), actualPostgrest: z.literal(true), uiWritesOnly: z.literal(true) }).passthrough().parse(preparationFile.data);
  validateParentPreparationNative(preparation.native, preparation.eligibility, story.characterId, story.actorId);
  assert.deepEqual(story.snapshots[0].data.native, preparation.native, "positive story did not start from the exact genuine fixture"); files.push(preparationFile);
  const preparationWrapperFile = readParentLink(descriptor.wrapper, path.resolve(directory, "../evidence")); files.push(preparationWrapperFile);
  z.object({ gate: z.literal("parent-preparation-app"), exitCode: z.literal(0), remainingIdentities: z.array(z.unknown()).length(0) }).passthrough().parse(preparationWrapperFile.data);
  const installationFile = readParentLink(descriptor.parentInstall, directory), installation = z.object({ installed: z.literal(true),
    engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId), file: z.literal("supabase/staged/character-builder-parent-admission.sql"),
    sourceSha256: z.literal("43988b054442805577b8e97be14b82c365c4d5b580d32e6abcc9bfcbab331e19"), after: z.record(z.string(), z.unknown()) }).passthrough().parse(installationFile.data);
  assert.equal(hashParentEvidence(fs.readFileSync(path.join(root, installation.file))), installation.sourceSha256); files.push(installationFile);
  const nativeFile = readParentLink(story.nativeEvidence, directory), native = validateParentNativeReport(nativeFile.data, story); files.push(nativeFile);
  for (const [file, digest] of Object.entries(PARENT_NATIVE_SOURCES)) assert.equal(hashParentEvidence(fs.readFileSync(path.join(root, file))), digest);
  for (const [file, digest] of Object.entries(PARENT_NATIVE_EXTERNAL_SOURCES)) assert.equal(hashParentEvidence(fs.readFileSync(path.join(directory, file))), digest);
  const nativeDescriptor = parentLinkSchema.parse((native as Record<string, unknown>).prerequisites && ((native as Record<string, unknown>).prerequisites as Record<string, unknown>).descriptor);
  assert.deepEqual(nativeDescriptor, parentFileLink(descriptorFile));
  const backgroundFile = readParentEvidence(process.argv[4], directory), background = z.object({ kind: z.literal("parent-background-native-report-v1"), passed: z.literal(true),
    authenticationAccepted: z.literal(false), source: z.unknown(), engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId),
    positiveAppEvidence: parentLinkSchema, nativeEvidence: parentLinkSchema, vector: z.unknown(), before: z.unknown(), after: z.unknown(),
    vectorSourceSha256: z.string(), cleanup: z.object({ allCapturedBackendsGone: z.literal(true), allClientsExited: z.literal(true) }) }).passthrough().parse(backgroundFile.data);
  assert.deepEqual(background.source, source); assert.deepEqual(background.positiveAppEvidence, parentFileLink(storyFile));
  assert.deepEqual(background.externalSources, Object.fromEntries(Object.entries(PARENT_NATIVE_EXTERNAL_SOURCES).filter(([file]) => file !== "parent-admission-control-20261025.mjs")));
  assert.deepEqual(background.nativeEvidence, parentFileLink(nativeFile)); assert.deepEqual(background.after, background.before);
  validateParentBackgroundVector(background.vector, story.roguePreparation.characterId, story.actorId);
  assert.equal(background.vectorSourceSha256, hashParentEvidence(fs.readFileSync(path.join(root, "supabase/verification/builder-parent-background-vector.sql"), "utf8"))); files.push(backgroundFile);
  const fiendFile = readParentLink(story.fiendEvidence, directory); files.push(fiendFile);
  z.object({ accepted: z.literal(true), engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId), acceptedNativeSnapshots: z.literal(11),
    controlId: z.literal(story.fiendId), targetId: z.literal(story.fiendControl.characterId), wrapper: z.object({ exitCode: z.literal(0), remainingIdentities: z.array(z.unknown()).length(0) }) }).passthrough().parse(fiendFile.data);
  const { runtime, assertClosure, assertParentProfiles, expected } = await openParentEvidenceRuntime(directory);
  let failed = false, fresh: unknown, cleanup: unknown;
  try {
    runtime.verify(); assert.equal(runtime.engineId, story.engineId); assert.equal(runtime.databaseId, story.databaseId);
    const readSource = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
    const observe = (characterId: string) => {
      const variables = [`character_id=${characterId}`, `actor_id=${story.actorId}`];
      return validateParentObservation({ native: runtime.json(readSource("supabase/verification/builder-parent-admission-readback.sql"), { variables }),
        detail: runtime.json(readSource("supabase/verification/builder-parent-positive-detail.sql"), { variables }),
        family: runtime.json(readSource("supabase/verification/builder-class-choices-readback.sql"), { variables: [variables[0]] }) }, characterId, story.actorId);
    };
    assert.deepEqual(observe(story.characterId), story.snapshots.at(-1)!.data);
    assert.deepEqual(observe(story.fiendId), story.fiendSnapshots.at(-1)!.data);
    assert.deepEqual(observe(story.fiendControl.characterId), story.fiendControl.after.data);
    assert.deepEqual(observe(story.roguePreparation.characterId), story.roguePreparation.snapshot.data);
    fresh = runtime.closure(); assertClosure(fresh, true); assertParentProfiles(fresh); assert.deepEqual(fresh, background.after);
    assert.deepEqual(runtime.json(readSource("supabase/verification/builder-parent-admission-catalog.sql")), native.catalogBefore, "native negative catalog changed");
    const current = z.record(z.string(), z.unknown()).parse(fresh);
    for (const key of ["functions", "wires", "roles", "memberships", "schemas", "policies", "relationPrivileges"])
      assert.deepEqual(current[key], installation.after[key], `installed ${key} changed`);
    for (const key of ["catalog", "snapshots"]) assert.deepEqual(current[key], installation.after[key], `immutable ${key} changed`);
    assertParentFilesUnchanged(files); assert.deepEqual(captureAncestryHpSource(root), source);
  } catch { failed = true; }
  try { cleanup = await runtime.cleanup(); } catch { failed = true; }
  runtime.finish(); assert(!failed, `parent aggregation refused; preserve ${path.basename(runtime.journalPath)}; raw output withheld`);
  assertParentFilesUnchanged(files); assert.deepEqual(captureAncestryHpSource(root), source);
  fs.writeFileSync(output, JSON.stringify({ kind: "builder-parent-admission-actual-acceptance-v1", accepted: true, actualApp: true, authenticationAccepted: true,
    nativeContentionPassed: true, source, engineId: runtime.engineId, databaseId: runtime.databaseId, observedUtc: new Date().toISOString(),
    parentInstallReceipt: parentFileLink(installationFile), positiveAppEvidence: parentFileLink(storyFile), nativeEvidence: parentFileLink(nativeFile),
    backgroundNativeEvidence: parentFileLink(backgroundFile), wrapper: wrapperFile.data, wrapperEvidence: parentFileLink(wrapperFile),
    acceptanceChecks: Object.fromEntries(PARENT_ACCEPTANCE_CHECKS.map(name => [name, true])), after: fresh, cleanup,
    processJournal: runtime.journalPath, externalSources: expected,
    limitations: ["background zero/one/two-write vector uses explicitly scoped rollback-only private native fixtures and SQL claims, not JWT",
      "global readiness, copy/lifecycle/provider/RI/hosted and release acceptance remain open"] }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ accepted: true, actualApp: true, output }));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Parent aggregation refused"); process.exitCode = 1; });
