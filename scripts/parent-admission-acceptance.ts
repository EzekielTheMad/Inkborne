import assert from "node:assert/strict";
import { z } from "zod";
import { nativeSchema } from "./parent-admission-fixture";
import { ANCESTRY_FAMILY_CHECKS } from "./ancestry-hp-acceptance";
import { PARENT_CONTENTION_CASES } from "./builder-parent-admission-concurrency";

// Evidence validation only. A successful synthetic validation cannot establish
// runtime/JWT acceptance; the recorder binds real artifacts and fresh readbacks.
export const PARENT_POSITIVE_LABELS = ["prepared", "race-saved", "abilities-saved", "asi-saved", "background-choice-saved",
  "background-narrative-saved", "details-saved", "equipment-choice-saved", "equipment-awarded", "sheet-reloaded", "access-refused"] as const;
export const PARENT_FIEND_LABELS = ["fiend-before", "fiend-applied", "fiend-replayed", "fiend-reloaded"] as const;
export const PARENT_ACCEPTANCE_CHECKS = ["genuineB3", "sixOrdinaryBuilderSteps", "backgroundZeroAndOneWrites", "backgroundTwoWriteScope",
  "fiendStrictReplayAndRetainedRows", "originalNativeAward", "ownerAndServiceRefusals", "threeSessionGuardBeforeParent", "allTransactionsClosed"] as const;
const id = z.uuid(), sha = z.string().regex(/^[a-f0-9]{64}$/), md5 = z.string().regex(/^[a-f0-9]{32}$/);
export const parentSourceSchema = z.object({ head: z.string().regex(/^[a-f0-9]{40}$/), diffSha256: sha }).strict();
export const parentLinkSchema = z.object({ path: z.string().min(1), sha256: sha }).strict();
export const parentNativeSchema = nativeSchema.omit({ choices: true, startingAwards: true, level: true }).extend({
  level: z.number().int().min(1).max(20), choices: z.record(z.string(), z.unknown()),
  classRoles: nativeSchema.shape.classRoles.extend({ class_sources: z.array(z.object({ role: z.enum(["original", "secondary"]), occurrence_id: id,
    controller_ref_id: id, content_id: id, content_version: z.number().int().positive() }).passthrough()).min(1) }),
  startingAwards: z.array(z.object({ id, status: z.enum(["eligible", "awarded"]), receipt: z.unknown() }).passthrough()),
});
export const parentDetailSchema = z.object({ kind: z.literal("builder-parent-positive-detail-v1"), characterId: id, actorId: id,
  pins: z.array(z.object({ id }).passthrough()), inventory: z.array(z.object({ id }).passthrough()), hpDraws: z.array(z.unknown()),
  featureGrants: z.array(z.object({ id, controller_ref_id: id }).passthrough()),
  spellGrants: z.array(z.object({ id, controller_ref_id: id }).passthrough()),
  spells: z.array(z.object({ id, source: z.string(), class_slug: z.string().nullable() }).passthrough()),
  updateReceipts: z.array(z.object({ operationId: id, request: z.record(z.string(), z.unknown()), receipt: z.record(z.string(), z.unknown()) }).strict()),
  inventoryFromAcceptedAward: z.literal(true), catalog: z.object({ count: z.literal(1535), fingerprint: md5 }).strict(),
  snapshots: z.object({ count: z.number().int().min(1537), fingerprint: md5 }).strict(),
}).strict();
export const parentObservationSchema = z.object({ native: parentNativeSchema, detail: parentDetailSchema,
  family: z.record(z.string(), z.unknown()) }).strict();
export type ParentObservation = z.infer<typeof parentObservationSchema>;
const snapshotSchema = z.object({ label: z.string(), path: z.string(), data: parentObservationSchema }).strict();
export const parentPositiveStorySchema = z.object({ actualApp: z.literal(true), actualAuthCookies: z.literal(true), actualPostgrest: z.literal(true), uiWritesOnly: z.literal(true),
  source: parentSourceSchema, runId: id, engineId: z.string().min(1), databaseId: sha, actorId: id, characterId: id, fiendId: id,
  preparation: parentLinkSchema, nativeEvidence: parentLinkSchema, snapshots: z.array(snapshotSchema), fiendSnapshots: z.array(snapshotSchema),
  fiendEvidence: parentLinkSchema, fiendControl: z.object({ characterId: id, before: snapshotSchema, after: snapshotSchema }).strict(),
  roguePreparation: z.object({ characterId: id, snapshot: snapshotSchema }).strict(),
  fiendAction: z.object({ originalRequest: z.object({ contract_version: z.literal(1), character_id: id, operation_id: id,
    command: z.literal("update_subclass_version"), fields: z.record(z.string(), z.unknown()) }).strict(),
    applied: z.object({ status: z.literal("applied"), receipt: z.record(z.string(), z.unknown()) }).passthrough(),
    replayed: z.object({ status: z.literal("replayed"), receipt: z.record(z.string(), z.unknown()) }).passthrough() }).strict(),
  access: z.object({ foreignRouteStatus: z.literal(404), baselineLabel: z.literal("equipment-choice-saved"), attempts: z.array(z.object({ actor: z.enum(["owner", "foreign", "service"]),
    name: z.string().min(1), http: z.number().int(), code: z.string().nullable(), affectedRows: z.number().int().nonnegative().nullable(),
    outcome: z.enum(["refused", "zero_rows", "missing", "void_unchanged"]), beforeFingerprint: md5, afterFingerprint: md5 }).strict()) }).strict(),
  blockedOrigins: z.array(z.string()).length(0), pageErrors: z.array(z.string()).length(0),
}).strict();

export function validateParentObservation(input: unknown, characterId: string, actorId: string) {
  const value = parentObservationSchema.parse(input), { native, detail } = value;
  for (const item of [native, detail]) { assert.equal(item.characterId, characterId); assert.equal(item.actorId, actorId); }
  assert.equal(native.classRoles.character_id, characterId); assert.equal(native.classRoles.action_revision, native.actionRevision);
  assert.equal(native.classRoles.original_occurrence_id, native.originalOccurrenceId);
  assert.equal(native.firstClassProofs[0].actorId, actorId);
  assert.deepEqual(Object.keys(native.orderBijections).sort(), ["feature_grants", "inventory", "pins", "spell_grants", "spells"]);
  assert(Object.values(native.orderBijections).every(item => item));
  for (const check of ANCESTRY_FAMILY_CHECKS) assert.equal(value.family[check], true, `native family failure: ${check}`);
  assert.equal(new Set(native.receipts.map(item => item.operationId)).size, native.receipts.length, "duplicate operation receipt");
  for (const rows of [detail.pins, detail.inventory]) assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  return value;
}
function sameImmutable(left: ParentObservation, right: ParentObservation) {
  for (const key of ["originalOccurrenceId", "firstClassProofs"] as const) assert.deepEqual(right.native[key], left.native[key], `original ${key} changed`);
  const classSources = (value: ParentObservation) => value.native.classRoles.class_sources.map(({ role, occurrence_id, controller_ref_id, content_id, content_version }) =>
    ({ role, occurrence_id, controller_ref_id, content_id, content_version }));
  assert.deepEqual(classSources(right), classSources(left), "class source identity changed");
  for (const key of ["hpDraws", "catalog", "snapshots"] as const) assert.deepEqual(right.detail[key], left.detail[key], `retained ${key} changed`);
  for (const receipt of left.native.receipts) assert.deepEqual(right.native.receipts.find(item => item.operationId === receipt.operationId), receipt, "old receipt changed");
}
export function validateParentPositiveStory(input: unknown) {
  const story = parentPositiveStorySchema.parse(input);
  assert.notEqual(story.characterId, story.fiendId);
  assert.deepEqual(story.snapshots.map(item => item.label), [...PARENT_POSITIVE_LABELS]);
  assert.deepEqual(story.fiendSnapshots.map(item => item.label), [...PARENT_FIEND_LABELS]);
  const ordinary = story.snapshots.map(item => validateParentObservation(item.data, story.characterId, story.actorId));
  const fiend = story.fiendSnapshots.map(item => validateParentObservation(item.data, story.fiendId, story.actorId));
  assert(![story.characterId, story.fiendId].includes(story.fiendControl.characterId));
  for (const point of [story.fiendControl.before, story.fiendControl.after]) validateParentObservation(point.data, story.fiendControl.characterId, story.actorId);
  assert.equal(story.fiendControl.before.label, "fiend-control-before"); assert.equal(story.fiendControl.after.label, "fiend-control-after");
  assert.deepEqual(story.fiendControl.after.data, story.fiendControl.before.data, "accepted Fiend control changed");
  const rogue = validateParentObservation(story.roguePreparation.snapshot.data, story.roguePreparation.characterId, story.actorId);
  assert.equal(story.roguePreparation.snapshot.label, "rogue-prepared");
  assert(![story.characterId, story.fiendId].includes(rogue.native.characterId)); assert.equal(rogue.native.level, 1);
  assert.equal(z.array(z.object({ slug: z.string() }).passthrough()).length(1).parse(rogue.native.choices.classes)[0].slug, "rogue");
  assert.equal(rogue.native.choices.background, "acolyte"); assert.deepEqual(rogue.detail.inventory, []);
  assert.deepEqual((rogue.native.choices.resolved_choices as Record<string, unknown>)["rogue-expertise-1"], ["skill-insight", "thieves-tools"]);
  assert.equal(ordinary[0].native.level, 4); assert.equal(ordinary[0].detail.inventory.length, 0);
  assert(!ordinary[0].native.receipts.some(item => item.command === "award_equipment"));
  const commands = ["select_race", "save_abilities", "select_asi", "background_choice", "background_narrative", "save_details", "select_equipment", "award_equipment"];
  for (let index = 1; index <= commands.length; index++) {
    const before = ordinary[index - 1], after = ordinary[index]; sameImmutable(before, after);
    assert(BigInt(after.native.actionRevision) > BigInt(before.native.actionRevision), `${story.snapshots[index].label}: no physical save`);
    const added = after.native.receipts.filter(item => !before.native.receipts.some(old => old.operationId === item.operationId));
    const expectedCommands = index === 1 ? ["clear_race", "select_race"] : [commands[index - 1]];
    assert.deepEqual(added.map(item => item.command).sort(), expectedCommands.sort(), "logical step must retain its exact accepted operations");
    if (index < 8) assert.deepEqual(after.detail.inventory, []);
  }
  assert.notDeepEqual(ordinary[2].native.scores, ordinary[1].native.scores, "ability edit was a no-op");
  assert.notDeepEqual(ordinary[3].native.choices.asi_choices, ordinary[2].native.choices.asi_choices, "ASI edit was a no-op");
  assert.notDeepEqual(ordinary[6].native.name, ordinary[5].native.name, "details edit was a no-op");
  const final = ordinary[8]; assert(final.detail.inventory.length > 0);
  assert.equal(final.native.startingAwards.filter(item => item.status === "awarded").length, 1);
  for (const value of ordinary.slice(9)) assert.deepEqual(value, final, "reload/access changed accepted character");
  for (const value of [...ordinary, ...fiend]) assert.deepEqual(value.detail.catalog, ordinary[0].detail.catalog);
  for (const value of [...ordinary, ...fiend]) assert.deepEqual(value.detail.snapshots, ordinary[0].detail.snapshots);
  const [old, applied, replayed, reloaded] = fiend; sameImmutable(old, applied);
  for (const key of ["choices", "scores", "state", "level", "startingAwards"] as const) assert.deepEqual(applied.native[key], old.native[key], `Fiend changed ${key}`);
  assert.deepEqual(applied.detail.inventory, old.detail.inventory);
  assert(BigInt(applied.native.actionRevision) > BigInt(old.native.actionRevision));
  assert.equal(applied.detail.updateReceipts.length, old.detail.updateReceipts.length + 1);
  const fiendAdded = applied.native.receipts.filter(item => !old.native.receipts.some(previous => previous.operationId === item.operationId));
  assert.equal(fiendAdded.length, 1); assert.equal(fiendAdded[0].command, "update_subclass_version");
  assert.equal(fiendAdded[0].operationId, story.fiendAction.originalRequest.operation_id);
  const update = applied.detail.updateReceipts.find(item => item.operationId === story.fiendAction.originalRequest.operation_id);
  assert(update); assert.deepEqual(update.request, story.fiendAction.originalRequest);
  assert.equal(update.request.character_id, story.fiendId); assert.deepEqual(update.receipt, story.fiendAction.applied.receipt);
  assert.deepEqual(story.fiendAction.replayed.receipt, update.receipt);
  assert.deepEqual(replayed, applied, "strict replay mutated accepted state"); assert.deepEqual(reloaded, applied);
  assert.equal(story.fiendAction.originalRequest.fields.expected_content_version, 1);
  assert.equal(story.fiendAction.originalRequest.fields.target_content_version, 2);
  const oldPin = old.detail.pins.find(pin => pin.id === story.fiendAction.originalRequest.fields.subclass_ref_id);
  assert(oldPin); assert.equal(oldPin.content_id, story.fiendAction.originalRequest.fields.content_id); assert.equal(oldPin.content_version, 1);
  const nextPins = applied.detail.pins.filter(pin => pin.content_id === oldPin.content_id && pin.content_version === 2);
  assert.equal(nextPins.length, 1); assert.notEqual(nextPins[0].id, oldPin.id);
  const relatedPins = (value: ParentObservation, rootId: string) => value.detail.pins.filter(pin => pin.id === rootId ||
    value.detail.featureGrants.some(grant => grant.controller_ref_id === rootId && grant.id === pin.feature_grant_id));
  assert.deepEqual(applied.detail.pins.filter(pin => !relatedPins(applied, nextPins[0].id).includes(pin)),
    old.detail.pins.filter(pin => !relatedPins(old, oldPin.id).includes(pin)), "Fiend changed unrelated pins");
  for (const key of ["featureGrants", "spellGrants"] as const) assert.deepEqual(applied.detail[key].filter(row => row.controller_ref_id !== nextPins[0].id),
    old.detail[key].filter(row => row.controller_ref_id !== oldPin.id), `Fiend changed unrelated ${key}`);
  assert.deepEqual(applied.detail.spells.filter(row => row.source === "selection" || row.class_slug !== "warlock"),
    old.detail.spells.filter(row => row.source === "selection" || row.class_slug !== "warlock"), "Fiend changed learned/other-class spells");
  validateParentAccess(story.access);
  for (const attempt of story.access.attempts) {
    assert.equal(attempt.beforeFingerprint, ordinary[7].native.fixtureFingerprint);
    assert.equal(attempt.afterFingerprint, attempt.beforeFingerprint, "HTTP probe changed owned state");
  }
  return story;
}

export function validateParentAccess(access: z.infer<typeof parentPositiveStorySchema>["access"]) {
  // Fixed attempts prevent a broad success flag from omitting an access lane.
  const names = ["state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc", "direct_update", "direct_delete"];
  assert.deepEqual(access.attempts.map(item => `${item.actor}/${item.name}`).sort(),
    ["owner", "foreign", "service"].flatMap(actor => names.map(name => `${actor}/${name}`)).sort());
  for (const attempt of access.attempts) {
    if (attempt.actor === "foreign" && ["state_patch", "state_cas"].includes(attempt.name)) {
      assert.equal(attempt.http, attempt.name === "state_patch" ? 204 : 200); assert.equal(attempt.code, null); assert.equal(attempt.affectedRows, null);
      assert.equal(attempt.outcome, attempt.name === "state_patch" ? "void_unchanged" : "missing");
    } else if ((attempt.actor !== "service" && attempt.name === "direct_delete") || (attempt.actor === "foreign" && attempt.name === "direct_update")) {
      assert(attempt.http >= 200 && attempt.http < 300); assert.equal(attempt.affectedRows, 0); assert.equal(attempt.code, null);
      assert.equal(attempt.outcome, "zero_rows");
    } else { assert.equal(attempt.http, 403); assert.equal(attempt.code, "42501"); assert.equal(attempt.affectedRows, null); assert.equal(attempt.outcome, "refused"); }
  }
}

export function validateParentPositiveWrapper(input: unknown, runId: string) {
  const wrapper = z.object({ gate: z.literal("parent-positive-app"), runId: z.literal(runId), exitCode: z.literal(0),
    command: z.literal("npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts parent-admission-positive.spec.ts"),
    remainingIdentities: z.array(z.unknown()).length(0), finishedUtc: z.iso.datetime({ offset: true }) }).passthrough().parse(input);
  return wrapper;
}

export function validateParentPositiveArtifact(input: unknown, story: Pick<z.infer<typeof parentPositiveStorySchema>, "source" | "runId" | "engineId" | "databaseId">,
  snapshot: z.infer<typeof snapshotSchema>) {
  const artifact = z.object({ label: z.literal(snapshot.label), data: parentObservationSchema,
    runId: z.literal(story.runId), source: parentSourceSchema, engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId),
    processes: z.array(z.object({ lane: z.enum(["engine", "container", "native", "detail", "family"]),
      pid: z.number().int().positive(), exitCode: z.literal(0) }).passthrough()).length(5) }).passthrough().parse(input);
  assert.deepEqual(artifact.data, snapshot.data); assert.deepEqual(artifact.source, story.source);
  assert.deepEqual(artifact.processes.map(item => item.lane), ["engine", "container", "native", "detail", "family"]);
  return artifact;
}

export function validateParentBackgroundVector(input: unknown, characterId: string, actorId: string) {
  const value = z.object({ kind: z.literal("parent-background-native-vector-v1"), authenticationAccepted: z.literal(false),
    characterId: z.literal(characterId), actorId: z.literal(actorId),
    fixtureScope: z.literal("two private background inserts inside a rolled-back native transaction"),
    cases: z.array(z.object({ label: z.string(), physicalWrites: z.number().int(), beforeRevision: z.string().regex(/^\d+$/),
      afterRevision: z.string().regex(/^\d+$/), expertiseBefore: z.array(z.string()), expertiseAfter: z.array(z.string()),
      beforeGraphFingerprint: md5, afterGraphFingerprint: md5, operationId: id, deferredConstraintsForced: z.literal(true) }).strict()),
    privateFixtures: z.array(z.object({ id, version: z.literal(1), fingerprint: md5 }).strict()).length(2),
    capsRemaining: z.literal(0), sealsRemaining: z.literal(0),
  }).strict().parse(input);
  assert.deepEqual(value.cases.map(item => item.label), ["changed-one", "unchanged-zero", "changed-two"]);
  assert.equal(new Set(value.privateFixtures.map(item => item.id)).size, 2);
  assert.equal(new Set(value.cases.map(item => item.operationId)).size, 3);
  for (const [index, item] of value.cases.entries()) {
    const count = [1, 0, 2][index]; assert.equal(item.physicalWrites, count);
    assert.equal(BigInt(item.afterRevision) - BigInt(item.beforeRevision), BigInt(count));
    assert.deepEqual(item.expertiseBefore, ["skill-insight", "thieves-tools"]);
    assert.deepEqual(item.expertiseAfter, index === 2 ? ["thieves-tools"] : item.expertiseBefore);
    if (index > 0) { assert.equal(item.beforeRevision, value.cases[index - 1].afterRevision);
      assert.equal(item.beforeGraphFingerprint, value.cases[index - 1].afterGraphFingerprint); }
    if (index === 1) assert.equal(item.beforeGraphFingerprint, item.afterGraphFingerprint);
  }
  return value;
}

export function validateParentNativeReport(input: unknown, story: z.infer<typeof parentPositiveStorySchema>) {
  const report = z.object({ kind: z.literal("builder-parent-admission-native-actual-v1"), passed: z.literal(true), authenticationAccepted: z.literal(false),
    engineId: z.literal(story.engineId), databaseId: z.literal(story.databaseId),
    fixture: z.object({ characterId: z.literal(story.characterId), actorId: z.literal(story.actorId) }).strict(),
    negatives: z.object({ caseCount: z.literal(34), authenticationAccepted: z.literal(false),
      cases: z.array(z.object({ role: z.enum(["authenticated", "service_role"]), case: z.string(), outcome: z.string(), sqlstate: z.string(),
        affectedRows: z.number().optional() }).strict()).length(34) }).passthrough(),
    contention: z.object({ passed: z.literal(true), authenticationAccepted: z.literal(false), sessionsClosed: z.literal(true),
      cases: z.array(z.object({ name: z.string(), status: z.literal("passed"), beforeDigest: md5, afterDigest: md5, parentProbeSucceeded: z.literal(true),
        edge: z.object({ waiterPid: z.number().int().positive(), blockerPid: z.number().int().positive() }).passthrough(),
        expectedSqlstate: z.enum(["00000", "42501"]), observedSqlstate: z.enum(["00000", "42501"]), affectedRows: z.number().optional() }).passthrough()).length(8) }).passthrough(),
    sourceSha: z.literal(story.source.head), sourceProfiles: z.record(z.string(), sha), externalSources: z.record(z.string(), sha),
    fixtureBefore: nativeSchema, fixtureAfter: nativeSchema, catalogBefore: parentInstalledCatalogSchema, catalogAfter: parentInstalledCatalogSchema,
    cleanup: z.object({ allCapturedBackendsGone: z.literal(true), allClientsExited: z.literal(true) }).passthrough(),
  }).passthrough().parse(input);
  assert.deepEqual(report.sourceProfiles, PARENT_NATIVE_SOURCES); assert.deepEqual(report.externalSources, PARENT_NATIVE_EXTERNAL_SOURCES);
  assert.deepEqual(report.fixtureBefore, story.snapshots[0].data.native, "native negatives used a different genuine fixture");
  assert.deepEqual(report.fixtureAfter, report.fixtureBefore); assert.deepEqual(report.catalogAfter, report.catalogBefore);
  const cases = ["state", "scores", "choices", "level", "system", "campaign", "archive", "owner", "identity", "revision", "delete",
    "state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc", "metadata"];
  assert.deepEqual(report.negatives.cases.map(item => `${item.role}/${item.case}`).sort(),
    ["authenticated", "service_role"].flatMap(role => cases.map(name => `${role}/${name}`)).sort());
  for (const item of report.negatives.cases) {
    if (item.case === "metadata") { assert.equal(item.outcome, "allowed_then_rolled_back"); assert.equal(item.sqlstate, "00000"); }
    else if (item.role === "authenticated" && item.case === "delete") {
      assert.equal(item.outcome, "rls_no_rows_unchanged"); assert.equal(item.sqlstate, "00000"); assert.equal(item.affectedRows, 0);
    } else { assert.equal(item.outcome, "refused_unchanged"); assert.equal(item.sqlstate, "42501"); }
  }
  assert.deepEqual(report.contention.cases.map(item => item.name), [...PARENT_CONTENTION_CASES]);
  for (const item of report.contention.cases) {
    assert.equal(item.beforeDigest, item.afterDigest); assert.notEqual(item.edge.waiterPid, item.edge.blockerPid);
    const expected = item.name === "owner-delete" ? "00000" : "42501";
    assert.equal(item.observedSqlstate, expected); assert.equal(item.expectedSqlstate, expected);
    if (item.name === "owner-delete") assert.equal(item.affectedRows, 0);
  }
  return report;
}

export const PARENT_NATIVE_SOURCES = {
  "scripts/builder-parent-admission-concurrency.ts": "3a8d697f7945817823ad04413560d10e779a4261645366457cf0d405773a6b2c",
  "scripts/character-command-psql.ts": "a832eb23ece9d561fb17574be45967848e5ae84f840e2f3adbb166a954c300c0",
  "supabase/verification/builder-parent-admission-cases.sql": "5f9d2530ef5a667a0255ff2b9f6108880990680b88a9c1352633dbd2792b30b0",
  "supabase/verification/builder-parent-admission-readback.sql": "28682bc53348ff75ed42850d92fbd9b29647d20604563cea32052c82c2f0a6e2",
  "supabase/verification/builder-parent-admission-catalog.sql": "3bc27b98258bbb0eec2318abab86d10ae064467243ede5b509915a3433b6538d",
} as const;
export const PARENT_NATIVE_EXTERNAL_SOURCES = {
  "parent-admission-control-20261025.mjs": "4b3fa6010381a8b23c2ded90419adeedd8454ffbd1efa01ed28449334430a080",
  "parent-admission-sessions-20261025.mjs": "3706b2521365766b7de62504fed312e020c5e7e58b1f177cfceab808eb49c639",
  "parent-admission-closure-20261025.sql": "295e3a374a1b34625c1da1b51ea51f1b60cb0edabe5623906cb86fca220cbf6b",
} as const;
const roleProfile = z.object({ seal: z.literal(false), bridge: z.boolean(), finish: z.literal(false), lookup: z.literal(false),
  privateUsage: z.boolean(), originalInvokerUnion: z.boolean() }).strict();
const parentInstalledCatalogSchema = z.object({ kind: z.literal("builder-parent-admission-installed-catalog-v1"), runtimeRole: z.literal("postgres"),
  postgresPosture: z.object({ superuser: z.literal(false), bypassRls: z.literal(true) }).strict(),
  functions: z.array(z.object({ signature: z.string().min(1), found: z.literal(true), owner: z.string().min(1), definer: z.boolean(),
    volatility: z.enum(["v", "s", "i"]), config: z.array(z.string()).nullable(), acl: z.string().nullable(), bodyMd5: md5, bodyBytes: z.number().int().positive() }).strict()).length(32),
  parentTriggers: z.array(z.object({ name: z.string(), callback: z.string(), enabled: z.literal("O"), mask: z.number().int(), columns: z.string(),
    deferred: z.literal(false), initiallyDeferred: z.literal(false), predicate: z.null(), arguments: z.literal(0) }).strict()).length(11),
  deferredClosure: z.array(z.object({ name: z.string(), relation: z.string(), callback: z.literal("private.require_parent_admission_finished_v1()"),
    enabled: z.literal("O"), deferred: z.literal(true), initiallyDeferred: z.literal(true) }).strict()).length(2),
  roles: z.object({ anon: roleProfile, authenticated: roleProfile, service_role: roleProfile }).strict(),
  capsRemaining: z.literal(0), sealsRemaining: z.literal(0), readinessCount: z.literal(13), readyCount: z.literal(0), classGate: z.literal(false), hitDieGate: z.literal(false),
}).strict();
