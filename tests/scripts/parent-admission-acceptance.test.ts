// Synthetic validation regressions only; no runtime/JWT/fixture acceptance.
import { describe, expect, it } from "vitest";
import { ANCESTRY_FAMILY_CHECKS } from "../../scripts/ancestry-hp-acceptance";
import { PARENT_CONTENTION_CASES } from "../../scripts/builder-parent-admission-concurrency";
import { PARENT_POSITIVE_LABELS, PARENT_FIEND_LABELS, parentObservationSchema, validateParentPositiveStory,
  validateParentPositiveWrapper, validateParentPositiveArtifact, validateParentBackgroundVector, validateParentNativeReport,
  PARENT_NATIVE_SOURCES, PARENT_NATIVE_EXTERNAL_SOURCES, type ParentObservation } from "../../scripts/parent-admission-acceptance";

const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const link = { path: "/synthetic/public.json", sha256: "a".repeat(64) };
const source = { head: "b".repeat(40), diffSha256: "c".repeat(64) };
function observation(characterId: string, level = 4): ParentObservation {
  const actorId = id(1), revision = "10";
  return parentObservationSchema.parse({ native: { kind: "builder-parent-admission-fixture-readback-v1", characterId, actorId,
    level, name: "Before", actionRevision: revision, fixtureFingerprint: "d".repeat(32), graphFingerprint: "e".repeat(32), enrolled: true,
    originalOccurrenceId: id(5), choices: { ability_method: "standard_array", race: "human", background: "acolyte",
      classes: [{ slug: level === 1 ? "rogue" : "fighter", level, occurrence_id: id(5) }],
      asi_choices: { "fighter-asi-4": { mode: "asi", allocations: [{ ability: "strength", amount: 2 }] } },
      ...(level === 1 ? { resolved_choices: { "rogue-expertise-1": ["skill-insight", "thieves-tools"] } } : {}) },
    scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }, state: {},
    classRoles: { status: "available", contract_version: 1, character_id: characterId, system_id: id(6), action_revision: revision,
      original_occurrence_id: id(5), class_sources: [{ role: "original", occurrence_id: id(5), controller_ref_id: id(7), content_id: id(8), content_version: 1 }] },
    startingAwards: [{ id: id(9), status: "eligible", receipt: null, canonical_intent: null, completed_at: null }], receipts: [{ operationId: id(10), command: "select_background", fields: {}, receipt: {} }],
    firstClassProofs: [{ phase: "observed", actorId, operationId: id(11), acceptanceId: id(12) }],
    orderBijections: Object.fromEntries(["pins", "inventory", "spells", "feature_grants", "spell_grants"].map(key => [key, true])),
    parentOrderRevisionEqual: true, capsRemaining: 0, sealsRemaining: 0, readinessCount: 13, readyCount: 0,
    classGate: false, hitDieGate: false, servicePrivateUsage: false },
    detail: { kind: "builder-parent-positive-detail-v1", characterId, actorId, pins: [], inventory: [], hpDraws: [], featureGrants: [], spellGrants: [], spells: [],
      updateReceipts: [], inventoryFromAcceptedAward: true, catalog: { count: 1535, fingerprint: "f".repeat(32) }, snapshots: { count: 1537, fingerprint: "0".repeat(32) } },
    family: Object.fromEntries(ANCESTRY_FAMILY_CHECKS.map(key => [key, true])) });
}
function fixture() {
  let data = observation(id(2));
  const snapshots = PARENT_POSITIVE_LABELS.map((label, index) => {
    data = structuredClone(data);
    if (index > 0 && index <= 8) {
      const commands = index === 1 ? ["clear_race", "select_race"] : [["save_abilities"], ["select_asi"], ["background_choice"],
        ["background_narrative"], ["save_details"], ["select_equipment"], ["award_equipment"]][index - 2];
      data.native.actionRevision = String(Number(data.native.actionRevision) + commands.length);
      data.native.classRoles.action_revision = data.native.actionRevision;
      data.native.receipts.push(...commands.map((command, offset) => ({ operationId: id(100 + index * 2 + offset), command, fields: {}, receipt: {} })));
      if (index === 2) data.native.scores = Object.fromEntries(Object.keys(data.native.scores).map(key => [key, 10]));
      if (index === 3) data.native.choices.asi_choices = { "fighter-asi-4": { mode: "asi", allocations: [{ ability: "dexterity", amount: 2 }] } };
      if (index === 6) data.native.name = "After";
      if (index === 8) { data.detail.inventory = [{ id: id(20) }]; data.native.startingAwards[0] = { id: id(9), status: "awarded", receipt: {} }; }
    }
    return { label, path: `/synthetic/native-${index}.json`, data: structuredClone(data) };
  });
  const old = observation(id(3)); old.detail.pins = [{ id: id(30), content_id: id(31), content_version: 1 }];
  old.detail.spells = [{ id: id(32), source: "selection", class_slug: "warlock" }];
  const originalRequest = { contract_version: 1 as const, character_id: id(3), operation_id: id(33), command: "update_subclass_version" as const,
    fields: { expected_content_version: 1, target_content_version: 2, subclass_ref_id: id(30), content_id: id(31) } };
  const applied = structuredClone(old); applied.native.actionRevision = "11"; applied.native.classRoles.action_revision = "11";
  applied.detail.pins = [{ id: id(34), content_id: id(31), content_version: 2 }];
  applied.native.receipts.push({ operationId: id(33), command: "update_subclass_version", fields: originalRequest.fields, receipt: { operation_id: id(33) } });
  applied.detail.updateReceipts.push({ operationId: id(33), request: originalRequest, receipt: { operation_id: id(33) } });
  const fiendSnapshots = PARENT_FIEND_LABELS.map((label, index) => ({ label, path: `/synthetic/fiend-${index}.json`, data: structuredClone(index === 0 ? old : applied) }));
  const attempts = (["owner", "foreign", "service"] as const).flatMap(actor =>
    ["state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc", "direct_update", "direct_delete"].map(name => {
      const hidden = actor === "foreign" && ["state_patch", "state_cas"].includes(name);
      const zero = actor !== "service" && name === "direct_delete" || actor === "foreign" && name === "direct_update";
      return { actor, name, http: hidden && name === "state_patch" ? 204 : hidden || zero ? 200 : 403, code: hidden || zero ? null : "42501", affectedRows: zero ? 0 : null,
        beforeFingerprint: "d".repeat(32), afterFingerprint: "d".repeat(32),
        outcome: hidden ? name === "state_patch" ? "void_unchanged" as const : "missing" as const : zero ? "zero_rows" as const : "refused" as const };
    }));
  return { actualApp: true as const, actualAuthCookies: true as const, actualPostgrest: true as const, uiWritesOnly: true as const,
    source, runId: id(40), engineId: "synthetic-engine", databaseId: "1".repeat(64), actorId: id(1), characterId: id(2), fiendId: id(3),
    preparation: link, nativeEvidence: link, snapshots, fiendSnapshots, fiendEvidence: link,
    fiendControl: { characterId: id(13), before: { label: "fiend-control-before", path: "/synthetic/control-before.json", data: observation(id(13)) },
      after: { label: "fiend-control-after", path: "/synthetic/control-after.json", data: observation(id(13)) } },
    roguePreparation: { characterId: id(4), snapshot: { label: "rogue-prepared", path: "/synthetic/rogue.json", data: observation(id(4), 1) } },
    fiendAction: { originalRequest, applied: { status: "applied" as const, receipt: { operation_id: id(33) } }, replayed: { status: "replayed" as const, receipt: { operation_id: id(33) } } },
    access: { foreignRouteStatus: 404 as const, baselineLabel: "equipment-choice-saved" as const, attempts }, blockedOrigins: [], pageErrors: [] };
}
function vector() {
  return { kind: "parent-background-native-vector-v1", authenticationAccepted: false, characterId: id(4), actorId: id(1),
    fixtureScope: "two private background inserts inside a rolled-back native transaction", capsRemaining: 0, sealsRemaining: 0,
    privateFixtures: [{ id: id(50), version: 1, fingerprint: "2".repeat(32) }, { id: id(51), version: 1, fingerprint: "3".repeat(32) }],
    cases: ["changed-one", "unchanged-zero", "changed-two"].map((label, index) => ({ label, physicalWrites: [1, 0, 2][index], beforeRevision: ["10", "11", "11"][index],
      afterRevision: ["11", "11", "13"][index], expertiseBefore: ["skill-insight", "thieves-tools"], expertiseAfter: index === 2 ? ["thieves-tools"] : ["skill-insight", "thieves-tools"],
      beforeGraphFingerprint: (index === 0 ? "4" : "5").repeat(32), afterGraphFingerprint: (index === 2 ? "6" : "5").repeat(32),
      operationId: id(52 + index), deferredConstraintsForced: true })) };
}
function nativeReport() {
  const story = fixture(), cases = ["state", "scores", "choices", "level", "system", "campaign", "archive", "owner", "identity", "revision", "delete",
    "state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc", "metadata"];
  const catalog = { kind: "builder-parent-admission-installed-catalog-v1", runtimeRole: "postgres", postgresPosture: { superuser: false, bypassRls: true },
    functions: Array.from({ length: 32 }, (_, index) => ({ signature: `private.synthetic_${index}()`, found: true, owner: "postgres", definer: true, volatility: "v",
      config: ['search_path=""'], acl: "{postgres=X/postgres}", bodyMd5: "a".repeat(32), bodyBytes: 1 })),
    parentTriggers: Array.from({ length: 11 }, (_, index) => ({ name: `synthetic_${index}`, callback: `private.synthetic_${index}()`, enabled: "O", mask: 19,
      columns: "", deferred: false, initiallyDeferred: false, predicate: null, arguments: 0 })),
    deferredClosure: ["parent_admission_finished", "builder_parent_admission_finished"].map(name => ({ name, relation: "private.synthetic", callback: "private.require_parent_admission_finished_v1()",
      enabled: "O", deferred: true, initiallyDeferred: true })),
    roles: Object.fromEntries(["anon", "authenticated", "service_role"].map(name => [name, { seal: false, bridge: name !== "anon", finish: false, lookup: false,
      privateUsage: name === "authenticated", originalInvokerUnion: name !== "anon" }])), capsRemaining: 0, sealsRemaining: 0, readinessCount: 13, readyCount: 0, classGate: false, hitDieGate: false };
  return { kind: "builder-parent-admission-native-actual-v1", passed: true, authenticationAccepted: false, engineId: story.engineId, databaseId: story.databaseId,
    sourceSha: story.source.head, sourceProfiles: { ...PARENT_NATIVE_SOURCES }, externalSources: { ...PARENT_NATIVE_EXTERNAL_SOURCES },
    fixture: { characterId: story.characterId, actorId: story.actorId }, fixtureBefore: story.snapshots[0].data.native, fixtureAfter: structuredClone(story.snapshots[0].data.native),
    catalogBefore: catalog, catalogAfter: structuredClone(catalog),
    negatives: { authenticationAccepted: false, caseCount: 34, cases: ["authenticated", "service_role"].flatMap(role => cases.map(name => {
      const metadata = name === "metadata", zero = role === "authenticated" && name === "delete";
      return { role, case: name, outcome: metadata ? "allowed_then_rolled_back" : zero ? "rls_no_rows_unchanged" : "refused_unchanged",
        sqlstate: metadata || zero ? "00000" : "42501", ...(zero ? { affectedRows: 0 } : {}) };
    })) }, contention: { passed: true, authenticationAccepted: false, sessionsClosed: true, cases: PARENT_CONTENTION_CASES.map(name => ({ name, status: "passed",
      beforeDigest: "7".repeat(32), afterDigest: "7".repeat(32), parentProbeSucceeded: true, edge: { waiterPid: 100, blockerPid: 101 },
      expectedSqlstate: name === "owner-delete" ? "00000" : "42501", observedSqlstate: name === "owner-delete" ? "00000" : "42501",
      ...(name === "owner-delete" ? { affectedRows: 0 } : {}) })) }, cleanup: { allCapturedBackendsGone: true, allClientsExited: true } };
}

describe("parent positive acceptance evidence", () => {
  it("validates a complete synthetic story without granting runtime acceptance", () => expect(validateParentPositiveStory(fixture()).snapshots).toHaveLength(11));
  it("rejects truncated or reordered logical saves", () => {
    const partial = fixture(); partial.snapshots.pop(); expect(() => validateParentPositiveStory(partial)).toThrow();
    const reordered = fixture(); [reordered.snapshots[3], reordered.snapshots[4]] = [reordered.snapshots[4], reordered.snapshots[3]];
    expect(() => validateParentPositiveStory(reordered)).toThrow();
  });
  it("rejects failed native checks despite browser success", () => { const value = fixture(); value.snapshots[5].data.family.all_choice_checks = false; expect(() => validateParentPositiveStory(value)).toThrow(); });
  it("requires physical revision and exact accepted operations", () => {
    const revision = fixture(); revision.snapshots[4].data.native.actionRevision = revision.snapshots[3].data.native.actionRevision;
    expect(() => validateParentPositiveStory(revision)).toThrow();
    const receipt = fixture(); receipt.snapshots[5].data.native.receipts.pop(); expect(() => validateParentPositiveStory(receipt)).toThrow();
  });
  it("rejects ability/ASI no-ops and rewritten old receipts", () => {
    const scores = fixture(); scores.snapshots[2].data.native.scores = scores.snapshots[1].data.native.scores; expect(() => validateParentPositiveStory(scores)).toThrow();
    const asi = fixture(); asi.snapshots[3].data.native.choices.asi_choices = asi.snapshots[2].data.native.choices.asi_choices; expect(() => validateParentPositiveStory(asi)).toThrow();
    const old = fixture(); old.snapshots[1].data.native.receipts[0].fields = { forged: true }; expect(() => validateParentPositiveStory(old)).toThrow();
  });
  it("requires retained original class proof and closed boundaries", () => {
    const origin = fixture(); origin.snapshots[7].data.native.originalOccurrenceId = id(60); expect(() => validateParentPositiveStory(origin)).toThrow();
    const caps = fixture(); (caps.snapshots[8].data.native as Record<string, unknown>).capsRemaining = 1; expect(() => validateParentPositiveStory(caps)).toThrow();
  });
  it("requires a native award and unchanged reload/access snapshots", () => {
    const award = fixture(); award.snapshots[8].data.detail.inventory = []; expect(() => validateParentPositiveStory(award)).toThrow();
    const reload = fixture(); reload.snapshots[9].data.native.name = "Unexpected write"; expect(() => validateParentPositiveStory(reload)).toThrow();
  });
  it("rejects native award mismatch and immutable catalog drift", () => {
    const award = fixture(); (award.snapshots[8].data.detail as Record<string, unknown>).inventoryFromAcceptedAward = false; expect(() => validateParentPositiveStory(award)).toThrow();
    const catalog = fixture(); catalog.snapshots[6].data.detail.snapshots.fingerprint = "8".repeat(32); expect(() => validateParentPositiveStory(catalog)).toThrow();
  });
  it("requires actual original Rogue/Expertise preparation", () => {
    const rogue = fixture(); rogue.roguePreparation.snapshot.data.native.choices.resolved_choices = {}; expect(() => validateParentPositiveStory(rogue)).toThrow();
  });
  it("rejects changed Fiend learned rows, receipt substitution and replay writes", () => {
    const rows = fixture(); rows.fiendSnapshots[1].data.detail.spells = []; expect(() => validateParentPositiveStory(rows)).toThrow();
    const receipt = fixture(); receipt.fiendAction.replayed.receipt.operation_id = id(61); expect(() => validateParentPositiveStory(receipt)).toThrow();
    const replay = fixture(); replay.fiendSnapshots[2].data.native.actionRevision = "12"; expect(() => validateParentPositiveStory(replay)).toThrow();
  });
  it("requires all owner/foreign/service HTTP lanes and exact zero-row outcomes", () => {
    const missing = fixture(); missing.access.attempts.pop(); expect(() => validateParentPositiveStory(missing)).toThrow();
    const success = fixture(); success.access.attempts[0].http = 200; expect(() => validateParentPositiveStory(success)).toThrow();
    const hidden = fixture(); hidden.access.attempts.find(item => item.actor === "foreign" && item.name === "state_cas")!.outcome = "void_unchanged";
    expect(() => validateParentPositiveStory(hidden)).toThrow();
  });
  it("binds the exact successful wrapper and unique run", () => {
    const wrapper = { gate: "parent-positive-app", runId: id(40), exitCode: 0, command: "npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts parent-admission-positive.spec.ts",
      remainingIdentities: [], finishedUtc: "2026-10-27T21:00:00Z" };
    expect(validateParentPositiveWrapper(wrapper, id(40)).exitCode).toBe(0);
    expect(() => validateParentPositiveWrapper(wrapper, id(41))).toThrow(); expect(() => validateParentPositiveWrapper({ ...wrapper, remainingIdentities: [123] }, id(40))).toThrow();
  });
  it("rejects copied snapshots with old run/source/database or omitted native lanes", () => {
    const story = fixture(), snapshot = story.snapshots[0];
    const artifact = { label: snapshot.label, data: snapshot.data, source: story.source, runId: story.runId, engineId: story.engineId, databaseId: story.databaseId,
      processes: ["engine", "container", "native", "detail", "family"].map((lane, index) => ({ lane, pid: 100 + index, exitCode: 0 })) };
    expect(validateParentPositiveArtifact(artifact, story, snapshot).processes).toHaveLength(5);
    expect(() => validateParentPositiveArtifact({ ...artifact, runId: id(70) }, story, snapshot)).toThrow();
    expect(() => validateParentPositiveArtifact({ ...artifact, source: { ...source, head: "9".repeat(40) } }, story, snapshot)).toThrow();
    expect(() => validateParentPositiveArtifact({ ...artifact, databaseId: "9".repeat(64) }, story, snapshot)).toThrow();
    expect(() => validateParentPositiveArtifact({ ...artifact, processes: artifact.processes.slice(1) }, story, snapshot)).toThrow();
  });
  it("requires real zero/one/two write counts, retained tools and deferred closure", () => {
    expect(validateParentBackgroundVector(vector(), id(4), id(1)).cases).toHaveLength(3);
    const wrong = vector(); wrong.cases[2].physicalWrites = 1; expect(() => validateParentBackgroundVector(wrong, id(4), id(1))).toThrow();
    const tools = vector(); tools.cases[2].expertiseAfter = []; expect(() => validateParentBackgroundVector(tools, id(4), id(1))).toThrow();
    const deferred = vector(); deferred.cases[0].deferredConstraintsForced = false; expect(() => validateParentBackgroundVector(deferred, id(4), id(1))).toThrow();
  });
  it("requires all 34 native outcomes and eight observed contention edges", () => {
    expect(validateParentNativeReport(nativeReport(), validateParentPositiveStory(fixture())).negatives.caseCount).toBe(34);
    const duplicate = nativeReport(); duplicate.negatives.cases[0] = duplicate.negatives.cases[1]; expect(() => validateParentNativeReport(duplicate, validateParentPositiveStory(fixture()))).toThrow();
    const probe = nativeReport(); probe.contention.cases[0].parentProbeSucceeded = false; expect(() => validateParentNativeReport(probe, validateParentPositiveStory(fixture()))).toThrow();
    const edge = nativeReport(); edge.contention.cases[0].edge.waiterPid = 101; expect(() => validateParentNativeReport(edge, validateParentPositiveStory(fixture()))).toThrow();
  });
  it("rejects omitted fixture/catalog and mismatched reviewed native source hashes", () => {
    const empty = nativeReport(); Object.assign(empty, { fixtureBefore: {}, fixtureAfter: {}, catalogBefore: {}, catalogAfter: {} });
    expect(() => validateParentNativeReport(empty, validateParentPositiveStory(fixture()))).toThrow();
    const sourceDrift = nativeReport(); Object.assign(sourceDrift.sourceProfiles, { "supabase/verification/builder-parent-admission-cases.sql": "9".repeat(64) });
    expect(() => validateParentNativeReport(sourceDrift, validateParentPositiveStory(fixture()))).toThrow();
    const foreign = nativeReport(); foreign.fixtureBefore.characterId = id(71); expect(() => validateParentNativeReport(foreign, validateParentPositiveStory(fixture()))).toThrow();
  });
});
