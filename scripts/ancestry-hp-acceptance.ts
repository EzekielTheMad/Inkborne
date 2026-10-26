import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";

// This only validates evidence. It never creates fixtures or grants acceptance
// without the separate recorder's successful wrapper and fresh native readback.
export const ANCESTRY_HP_LABELS = [
  "old-v1-complete-before-publication", "hill-root-v2-old-control-unchanged",
  "new-v2-complete-average", "server-d12-original-operation",
  "average-with-original-draw-retained", "reselected-original-draw", "downlevel-two",
  "restored-three-original-draw", "averages-restored-draw-and-current-retained",
  "completed-sheet-reload", "old-control-preserved-and-foreign404",
] as const;
export const ANCESTRY_HP_CHECKS = [
  "oneOwnedTargetAndControl", "originalBarbarianProvenance", "exactSelectedAncestry", "allFrozenSrdPinsExact",
  "exactOwnedAncestryTraits", "standardArrayAndScores", "savedChoicesAndRequiredFeatures", "finiteSubclassAndHpRecords",
  "maximumHpMatchesIndependent2014", "drawsBindOriginalReceipts", "oneNativeStartingAward", "inventoryFromAcceptedAward",
  "noSpellsOrEquippedGear", "detailsConfirmed", "ownedReceiptsAndHistory", "fiveOrderBijections", "currentParentAndRoleOrder", "boundariesClosed",
] as const;
export const ANCESTRY_FAMILY_CHECKS = [
  "all_pinned_versions_exact", "feature_grants_exact", "physical_feature_grant_links_exact", "active_feature_projections_exact",
  "spell_grants_exact", "all_spell_rows_exact", "active_spell_grants_projected", "all_choice_checks", "all_child_checks", "all_favored_checks",
  "all_five_order_bijections", "all_boundaries_closed",
] as const;
const id = z.uuid(), digest = z.string().regex(/^[a-f0-9]{32}$/);
const scores = { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 };
const effective = { ...scores, constitution: 16, wisdom: 13 };
const sourceSchema = z.object({ head: z.string().regex(/^[a-f0-9]{40}$/), diffSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function captureAncestryHpSource(root: string) {
  const paths = ["app", "components", "lib", "scripts", "supabase", "e2e", "proxy.ts", "next.config.ts", "package.json", "package-lock.json"];
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, "source identity unavailable"); return result.stdout;
  };
  assert.equal(git(["ls-files", "--others", "--exclude-standard", "--", ...paths]), "", "commit new product/acceptance sources before an actual run");
  return { head: git(["rev-parse", "HEAD"]).trim(), diffSha256: createHash("sha256").update(git(["diff", "--binary", "HEAD", "--", ...paths])).digest("hex") };
}
const draw = z.object({ operationId: id, actorId: id, occurrenceId: id, level: z.literal(2), die: z.literal(12),
  value: z.number().int().min(1).max(12), createdAt: z.iso.datetime({ offset: true }) }).passthrough();
export const ancestryNativeSchema = z.object({
  evidenceKind: z.literal("read_only_after_actual_ancestry_hp_app_actions"), characterId: id, actorId: id,
  level: z.union([z.literal(2), z.literal(3)]), actionRevision: z.string().regex(/^\d+$/), maximumHp: z.number().int(), independentMaximumHp: z.number().int(),
  currentHp: z.null(), hasStoredCurrentHp: z.literal(false), baseScores: z.record(z.string(), z.number()), effectiveScores: z.record(z.string(), z.number()),
  originalOccurrenceId: id, barbarianOccurrenceId: id, classControllerRefId: id, racePinId: id, subracePinId: id, subraceContentId: id,
  subraceVersion: z.union([z.literal(1), z.literal(2)]), ancestryHpBonus: z.union([z.null(), z.literal(1)]),
  hpRolls: z.record(z.string(), z.object({ method: z.enum(["average", "rolled"]), value: z.number().int() }).strict()), hpDraws: z.array(draw),
  pins: z.array(z.object({ kind: z.string() }).passthrough()), inventory: z.array(z.unknown()).min(1),
  graphFingerprint: digest, completeFingerprint: digest, receiptCount: z.number().int().positive(), progressionHistoryCount: z.number().int().positive(),
  oldControl: z.object({ characterId: id, actorId: id, maximumHp: z.literal(35), subraceVersion: z.literal(1), fingerprint: digest }).strict(),
  catalog: z.object({ definitions: z.literal(1535), versions: z.number().int().positive(), hillDwarf: z.object({ contentId: id, version: z.number().int() }).strict(),
    hillSnapshots: z.array(z.object({ version: z.number().int(), fingerprint: digest, hpBonus: z.union([z.null(), z.literal(1)]) }).strict()),
    toughnessSnapshots: z.array(z.object({ version: z.number().int(), fingerprint: digest }).strict()).min(1) }).strict(),
  checks: z.record(z.string(), z.boolean()),
}).passthrough();
export const ancestryStorySchema = z.object({
  actualApp: z.literal(true), actualAuthCookies: z.literal(true), actualPostgrest: z.literal(true), uiWritesOnly: z.literal(true), caseId: z.literal("A4"),
  source: sourceSchema, runId: id,
  oldControlId: id, newCharacterId: id, allSixBuilderStepsSaved: z.literal(true), completedSheetReloadPassed: z.literal(true), foreignAccountRefused: z.literal(true),
  rawDraw: draw, snapshots: z.array(z.object({ label: z.string(), path: z.string(), data: ancestryNativeSchema }).strict()),
  blockedOrigins: z.array(z.string()).length(0), pageErrors: z.array(z.string()).length(0),
  storedCurrentHp: z.object({ initial: z.null(), final: z.null(), actualAcceptance: z.literal("initial absence preserved through existing class writes") }).strict(),
  clampScope: z.literal("no actual-app present-current-HP clamp claim; finite native F1 tests cover that existing class path separately; no race/ability clamp claim"),
}).passthrough();
export type AncestryNative = z.infer<typeof ancestryNativeSchema>;

function sameSources(before: AncestryNative, after: AncestryNative) {
  for (const key of ["originalOccurrenceId", "barbarianOccurrenceId", "classControllerRefId", "racePinId", "subracePinId", "subraceContentId", "subraceVersion"] as const)
    assert.deepEqual(after[key], before[key], `retained ${key} changed`);
  const persistentPins = (value: AncestryNative) => value.pins.filter(pin => ["race", "subrace", "trait", "class", "background"].includes(pin.kind));
  assert.deepEqual(persistentPins(after), persistentPins(before), "persistent source pins changed");
  for (const key of ["inventory", "catalog", "oldControl"] as const) assert.deepEqual(after[key], before[key], `retained ${key} changed`);
}

export function validateAncestryHpStory(input: unknown) {
  const story = ancestryStorySchema.parse(input);
  assert.notEqual(story.oldControlId, story.newCharacterId);
  assert.deepEqual(story.snapshots.map(item => item.label), [...ANCESTRY_HP_LABELS], "complete ordered A4 story required");
  for (const [index, snapshot] of story.snapshots.entries()) {
    const value = snapshot.data;
    assert.equal(value.characterId, index < 2 ? story.oldControlId : story.newCharacterId);
    assert.equal(value.actorId, story.rawDraw.actorId);
    assert.equal(value.oldControl.characterId, story.oldControlId); assert.equal(value.oldControl.actorId, value.actorId);
    assert.equal(value.originalOccurrenceId, value.barbarianOccurrenceId);
    assert.deepEqual(Object.keys(value.checks).sort(), [...ANCESTRY_HP_CHECKS].sort());
    for (const key of ANCESTRY_HP_CHECKS) assert.equal(value.checks[key], true, `${snapshot.label}: ${key}`);
    assert.deepEqual(value.baseScores, scores); assert.deepEqual(value.effectiveScores, effective);
    assert.equal(value.maximumHp, value.independentMaximumHp);
    assert.deepEqual(Object.keys(value.hpRolls).sort(), value.level === 3 ? ["barbarian-2", "barbarian-3"] : ["barbarian-2"]);
    if (value.level === 3) assert.deepEqual(value.hpRolls["barbarian-3"], { method: "average", value: 7 });
    assert.equal(value.subraceVersion, index < 2 ? 1 : 2); assert.equal(value.ancestryHpBonus, index < 2 ? null : 1);
    assert.equal(value.level, index === 6 ? 2 : 3);
    const method = [3, 5, 6, 7].includes(index) ? "rolled" : "average";
    assert.deepEqual(value.hpRolls["barbarian-2"], { method, value: method === "rolled" ? story.rawDraw.value : 7 });
    assert.deepEqual(value.hpDraws, index < 3 ? [] : [story.rawDraw]);
    assert.equal(value.maximumHp, index < 2 ? 35 : index === 6 ? 20 + story.rawDraw.value : method === "rolled" ? 31 + story.rawDraw.value : 38);
  }
  const values = story.snapshots.map(item => item.data), [old, published, initial, rolled] = values;
  assert.deepEqual(published.oldControl, old.oldControl); assert.equal(published.completeFingerprint, old.completeFingerprint);
  assert.deepEqual(published.pins, old.pins); assert.deepEqual(published.inventory, old.inventory);
  assert.deepEqual(published.catalog, { ...old.catalog, versions: old.catalog.versions + 1,
    hillDwarf: { contentId: old.subraceContentId, version: 2 }, hillSnapshots: [old.catalog.hillSnapshots[0], published.catalog.hillSnapshots[1]] });
  assert.deepEqual(old.catalog.hillDwarf, { contentId: old.subraceContentId, version: 1 });
  assert.equal(old.catalog.hillSnapshots.length, 1); assert.equal(old.catalog.hillSnapshots[0].version, 1); assert.equal(old.catalog.hillSnapshots[0].hpBonus, null);
  assert.equal(published.catalog.hillSnapshots.length, 2); assert.equal(published.catalog.hillSnapshots[1].version, 2); assert.equal(published.catalog.hillSnapshots[1].hpBonus, 1);
  assert.deepEqual(initial.catalog, published.catalog); assert.deepEqual(initial.oldControl, old.oldControl);
  assert.equal(initial.subraceContentId, old.subraceContentId); assert.notEqual(initial.subracePinId, old.subracePinId);
  assert.equal(story.rawDraw.occurrenceId, initial.barbarianOccurrenceId);
  for (const value of values.slice(3)) sameSources(initial, value);
  for (let index = 3; index <= 8; index++) {
    assert(BigInt(values[index].actionRevision) > BigInt(values[index - 1].actionRevision), "a genuine edit must advance the revision");
    assert(values[index].receiptCount > values[index - 1].receiptCount, "a genuine edit must retain its new receipt");
  }
  assert.deepEqual(values[9], values[8], "sheet reload wrote character state");
  assert.deepEqual(values[10], values[8], "foreign account inspection changed owned state");
  assert.equal(rolled.hpDraws.length, 1);
  return story;
}

export function validateAncestryNativeArtifact(input: unknown, expected: AncestryNative, label: string) {
  const artifact = z.object({ label: z.string(), observedUtc: z.iso.datetime({ offset: true }),
    processes: z.array(z.object({ pid: z.number().int().positive(), exitCode: z.literal(0) }).passthrough()).min(4),
    family: z.record(z.string(), z.unknown()) }).passthrough().parse(input);
  assert.equal(artifact.label, label);
  for (const key of ANCESTRY_FAMILY_CHECKS) assert.equal(artifact.family[key], true, `${label}: ${key}`);
  const { label: ignoredLabel, observedUtc, processes, family, ...native } = artifact;
  void ignoredLabel; void observedUtc; void processes; void family;
  assert.deepEqual(ancestryNativeSchema.parse(native), expected, "standalone native evidence differs from the story");
}

export function validateAncestryHpWrapper(input: unknown, runId: string) {
  const wrapper = z.object({ gate: z.literal("ancestry-hp-app"), runId: z.uuid(), exitCode: z.literal(0), remainingIdentities: z.array(z.unknown()).length(0),
    finishedUtc: z.iso.datetime({ offset: true }),
    command: z.literal("npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts ancestry-hit-points.spec.ts") }).passthrough().parse(input);
  assert.equal(wrapper.runId, runId, "successful wrapper belongs to another actual run"); return wrapper;
}

export function validateAncestryHpProfile(input: unknown, publication: unknown, last: AncestryNative) {
  const profiles = z.object({ functions: z.array(z.unknown()).min(1), wires: z.array(z.unknown()).min(1), roles: z.array(z.unknown()).min(1), memberships: z.array(z.unknown()) });
  const closure = z.object({ caps: z.literal(0), seals: z.literal(0), parentInstalled: z.literal(true), readinessCount: z.literal(13), readyCount: z.literal(0),
    classGate: z.literal(false), hitDieGate: z.literal(false), servicePrivateUsage: z.literal(false) }).strict();
  const side = profiles.extend({ closure, rows: z.record(z.string(), z.unknown()), definitions: z.literal(1535), versions: z.number().int(),
    chainRoots: z.record(z.string(), z.unknown()), allSnapshotsFingerprint: digest, otherSnapshotsFingerprint: digest, otherDefinitionsFingerprint: digest }).passthrough();
  const published = z.object({ before: side, after: side }).passthrough().parse(publication);
  const fresh = profiles.extend({ closure, snapshotsFingerprint: digest, catalog: z.object({ definitions: z.literal(1535), versions: z.number().int(),
    chainRoots: z.record(z.string(), z.unknown()) }).strict() }).passthrough().parse(input);
  assert.equal(Object.keys(published.before.rows).length, 15); assert.deepEqual(published.after.rows, published.before.rows);
  // pg_catalog renders public regprocedure/regclass names according to the
  // querying session's search_path. Normalize only those display fields.
  const canonical = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item: unknown) =>
    ["signature", "callback", "relation"].includes(key) && typeof item === "string" && !item.includes(".") ? "public." + item : item));
  for (const key of ["functions", "wires", "roles", "memberships"] as const) {
    assert.deepEqual(canonical(published.after[key]), canonical(published.before[key]), `publication changed ${key}`);
    assert.deepEqual(canonical(fresh[key]), canonical(published.after[key]), `accepted native ${key} profile drifted`);
  }
  assert.equal(published.after.versions, published.before.versions + 1);
  for (const key of ["otherSnapshotsFingerprint", "otherDefinitionsFingerprint"] as const) assert.equal(published.after[key], published.before[key]);
  assert.deepEqual(fresh.catalog.chainRoots, published.after.chainRoots);
  assert.equal(fresh.catalog.definitions, last.catalog.definitions); assert.equal(fresh.catalog.versions, last.catalog.versions);
  assert.equal(fresh.snapshotsFingerprint, published.after.allSnapshotsFingerprint);
  const hill = z.object({ id: z.literal(last.subraceContentId), version: z.literal(2), data: z.object({ hit_points_bonus_per_character_level: z.literal(1) }).passthrough() }).passthrough();
  hill.parse(fresh.catalog.chainRoots["subrace/hill-dwarf"]);
  return fresh;
}
