// Synthetic evidence validation only; no native, Auth or browser acceptance.
import { describe, expect, it } from "vitest";
import { ANCESTRY_FAMILY_CHECKS, ANCESTRY_HP_CHECKS, ANCESTRY_HP_LABELS, ancestryNativeSchema,
  validateAncestryHpStory, validateAncestryNativeArtifact, validateAncestryHpWrapper, validateAncestryHpProfile } from "../../scripts/ancestry-hp-acceptance";

const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rawDraw = { operationId: id(20), actorId: id(3), occurrenceId: id(6), level: 2, die: 12, value: 5, createdAt: "2026-10-26T17:00:00Z" };
function fixture() {
  const oldControl = { characterId: id(1), actorId: id(3), maximumHp: 35, subraceVersion: 1, fingerprint: "a".repeat(32) };
  const oldCatalog = { definitions: 1535, versions: 1537, hillDwarf: { contentId: id(9), version: 1 },
    hillSnapshots: [{ version: 1, fingerprint: "b".repeat(32), hpBonus: null }], toughnessSnapshots: [{ version: 1, fingerprint: "c".repeat(32) }] };
  const catalog = { ...oldCatalog, versions: 1538, hillDwarf: { contentId: id(9), version: 2 },
    hillSnapshots: [...oldCatalog.hillSnapshots, { version: 2, fingerprint: "d".repeat(32), hpBonus: 1 }] };
  const snapshots = ANCESTRY_HP_LABELS.map((label, index) => {
    const method = [3, 5, 6, 7].includes(index) ? "rolled" : "average";
    const maximumHp = index < 2 ? 35 : index === 6 ? 25 : method === "rolled" ? 36 : 38;
    const data = ancestryNativeSchema.parse({ evidenceKind: "read_only_after_actual_ancestry_hp_app_actions", characterId: id(index < 2 ? 1 : 2), actorId: id(3),
      level: index === 6 ? 2 : 3, actionRevision: String(index < 3 ? 1 : index - 1), maximumHp, independentMaximumHp: maximumHp,
      currentHp: null, hasStoredCurrentHp: false, baseScores: { strength: 15, dexterity: 13, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
      effectiveScores: { strength: 15, dexterity: 13, constitution: 16, intelligence: 8, wisdom: 13, charisma: 10 },
      originalOccurrenceId: id(index < 2 ? 4 : 6), barbarianOccurrenceId: id(index < 2 ? 4 : 6), classControllerRefId: id(index < 2 ? 5 : 7),
      racePinId: id(index < 2 ? 8 : 10), subracePinId: id(index < 2 ? 11 : 12), subraceContentId: id(9), subraceVersion: index < 2 ? 1 : 2,
      ancestryHpBonus: index < 2 ? null : 1, hpRolls: { "barbarian-2": { method, value: method === "rolled" ? 5 : 7 },
        ...(index === 6 ? {} : { "barbarian-3": { method: "average", value: 7 } }) }, hpDraws: index < 3 ? [] : [rawDraw],
      pins: [{ kind: "race", id: id(index < 2 ? 8 : 10), snapshotFingerprint: "e".repeat(32) }], inventory: [{ id: id(index < 2 ? 13 : 14) }],
      graphFingerprint: "f".repeat(32), completeFingerprint: "a".repeat(32), receiptCount: index < 3 ? 10 : 10 + index,
      progressionHistoryCount: 1, oldControl, catalog: index === 0 ? oldCatalog : catalog,
      checks: Object.fromEntries(ANCESTRY_HP_CHECKS.map(key => [key, true])) });
    return { label, path: `/synthetic/native-${index}.json`, data };
  });
  snapshots[9].data = structuredClone(snapshots[8].data); snapshots[10].data = structuredClone(snapshots[8].data);
  return { actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true, caseId: "A4", source: { head: "1".repeat(40), diffSha256: "2".repeat(64) },
    runId: id(40), oldControlId: id(1), newCharacterId: id(2), allSixBuilderStepsSaved: true, completedSheetReloadPassed: true, foreignAccountRefused: true,
    rawDraw: structuredClone(rawDraw), snapshots, blockedOrigins: [] as string[], pageErrors: [] as string[], storedCurrentHp: { initial: null, final: null,
      actualAcceptance: "initial absence preserved through existing class writes" },
    clampScope: "no actual-app present-current-HP clamp claim; finite native F1 tests cover that existing class path separately; no race/ability clamp claim" };
}

describe("A4 complete evidence validation", () => {
  it("accepts the complete synthetic sequence without executing a runtime", () => expect(validateAncestryHpStory(fixture()).snapshots).toHaveLength(11));
  it("rejects a memory-interrupted prefix and reordered snapshots", () => {
    const prefix = fixture(); prefix.snapshots.pop(); expect(() => validateAncestryHpStory(prefix)).toThrow();
    const reordered = fixture(); [reordered.snapshots[4], reordered.snapshots[5]] = [reordered.snapshots[5], reordered.snapshots[4]];
    expect(() => validateAncestryHpStory(reordered)).toThrow();
  });
  it("rejects a native failure even when the browser summary says success", () => {
    const story = fixture(); story.snapshots[7].data.checks.fiveOrderBijections = false;
    expect(() => validateAncestryHpStory(story)).toThrow();
  });
  it("requires the new HP38 oracle and one retained original d12", () => {
    const wrongHp = fixture(); wrongHp.snapshots[8].data.maximumHp = 35; expect(() => validateAncestryHpStory(wrongHp)).toThrow();
    const replaced = fixture(); replaced.snapshots[5].data.hpDraws[0].operationId = id(22); expect(() => validateAncestryHpStory(replaced)).toThrow();
    const absent = fixture(); absent.snapshots[4].data.hpDraws = []; expect(() => validateAncestryHpStory(absent)).toThrow();
  });
  it("rejects an old character or immutable snapshot changing after publication", () => {
    const changed = fixture(); changed.snapshots[1].data.oldControl.fingerprint = "0".repeat(32); expect(() => validateAncestryHpStory(changed)).toThrow();
    const snapshot = fixture(); snapshot.snapshots[1].data.catalog.hillSnapshots[0].fingerprint = "0".repeat(32);
    expect(() => validateAncestryHpStory(snapshot)).toThrow();
  });
  it("rejects source identity, inventory or ownership drift", () => {
    const pin = fixture(); pin.snapshots[6].data.subracePinId = id(30); expect(() => validateAncestryHpStory(pin)).toThrow();
    const inventory = fixture(); inventory.snapshots[5].data.inventory = []; expect(() => validateAncestryHpStory(inventory)).toThrow();
    const foreign = fixture(); foreign.snapshots[5].data.actorId = id(30); expect(() => validateAncestryHpStory(foreign)).toThrow();
  });
  it("requires real revision and receipt advances and unchanged reloads", () => {
    const revision = fixture(); revision.snapshots[4].data.actionRevision = revision.snapshots[3].data.actionRevision;
    expect(() => validateAncestryHpStory(revision)).toThrow();
    const receipt = fixture(); receipt.snapshots[4].data.receiptCount = receipt.snapshots[3].data.receiptCount;
    expect(() => validateAncestryHpStory(receipt)).toThrow();
    const reload = fixture(); reload.snapshots[9].data.actionRevision = "100"; expect(() => validateAncestryHpStory(reload)).toThrow();
  });
  it("rejects present current HP and prevents a broader clamp claim", () => {
    const hp = fixture(); expect(() => validateAncestryHpStory({ ...hp, snapshots: hp.snapshots.map(item => ({ ...item, data: { ...item.data, currentHp: 20, hasStoredCurrentHp: true } })) })).toThrow();
    expect(() => validateAncestryHpStory({ ...fixture(), clampScope: "all clamps accepted" })).toThrow();
  });
  it("rejects missing completion, foreign refusal or network/error evidence", () => {
    for (const key of ["actualAuthCookies", "allSixBuilderStepsSaved", "completedSheetReloadPassed", "foreignAccountRefused"]) {
      expect(() => validateAncestryHpStory({ ...fixture(), [key]: false })).toThrow();
    }
    expect(() => validateAncestryHpStory({ ...fixture(), blockedOrigins: ["https://example.com"] })).toThrow();
    expect(() => validateAncestryHpStory({ ...fixture(), pageErrors: ["error"] })).toThrow();
  });
  it("checks independent standalone native artifacts and family oracles", () => {
    const snapshot = fixture().snapshots[8];
    const artifact = { ...snapshot.data, label: snapshot.label, observedUtc: "2026-10-26T17:00:00Z",
      processes: [1, 2, 3, 4].map(pid => ({ pid, exitCode: 0 })), family: Object.fromEntries(ANCESTRY_FAMILY_CHECKS.map(key => [key, true])) };
    expect(() => validateAncestryNativeArtifact(artifact, snapshot.data, snapshot.label)).not.toThrow();
    expect(() => validateAncestryNativeArtifact({ ...artifact, family: { ...artifact.family, all_child_checks: false } }, snapshot.data, snapshot.label)).toThrow();
    expect(() => validateAncestryNativeArtifact({ ...artifact, actionRevision: "999" }, snapshot.data, snapshot.label)).toThrow();
    expect(() => validateAncestryNativeArtifact({ ...artifact, processes: [{ pid: 1, exitCode: 1 }] }, snapshot.data, snapshot.label)).toThrow();
  });
  it("rejects an older successful wrapper paired with a different run", () => {
    const wrapper = { gate: "ancestry-hp-app", runId: id(40), exitCode: 0, remainingIdentities: [], finishedUtc: "2026-10-26T17:01:00Z",
      command: "npm.cmd run test:e2e -- --config e2e/local-app/playwright.config.ts ancestry-hit-points.spec.ts" };
    expect(() => validateAncestryHpWrapper(wrapper, id(40))).not.toThrow();
    expect(() => validateAncestryHpWrapper(wrapper, id(41))).toThrow();
    expect(() => validateAncestryHpWrapper({ ...wrapper, exitCode: 1 }, id(40))).toThrow();
    expect(() => validateAncestryHpWrapper({ ...wrapper, remainingIdentities: [{ pid: 123 }] }, id(40))).toThrow();
  });
  it("binds native fences and the downstream A6 catalog to the accepted publication", () => {
    const last = fixture().snapshots[10].data;
    const closed = { caps: 0, seals: 0, parentInstalled: true, readinessCount: 13, readyCount: 0, classGate: false, hitDieGate: false, servicePrivateUsage: false };
    const profiles = { functions: [{ signature: "public.fixture()", bodyMd5: "a".repeat(32), profile: { owner: 10 } }],
      wires: [{ relation: "public.characters", callback: "private.guard()", profile: { tgenabled: "O" } }], roles: [{ name: "postgres" }], memberships: [] };
    const roots = { "subrace/hill-dwarf": { id: id(9), version: 2, data: { hit_points_bonus_per_character_level: 1 } } };
    const before = { ...profiles, closure: closed, rows: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`table${i}`, { count: 1, fingerprint: "a".repeat(32) }])),
      definitions: 1535, versions: 1537, chainRoots: {}, allSnapshotsFingerprint: "b".repeat(32), otherSnapshotsFingerprint: "c".repeat(32), otherDefinitionsFingerprint: "d".repeat(32) };
    const publication = { before, after: { ...structuredClone(before), versions: 1538, chainRoots: roots, allSnapshotsFingerprint: "e".repeat(32) } };
    const fresh = { ...structuredClone(profiles), closure: closed, snapshotsFingerprint: "e".repeat(32), catalog: { definitions: 1535, versions: 1538, chainRoots: roots } };
    expect(validateAncestryHpProfile(fresh, publication, last).catalog.chainRoots).toEqual(roots);
    const disabled = structuredClone(fresh); disabled.wires[0].profile.tgenabled = "D";
    expect(() => validateAncestryHpProfile(disabled, publication, last)).toThrow();
    const changedBody = structuredClone(fresh); changedBody.functions[0].bodyMd5 = "f".repeat(32);
    expect(() => validateAncestryHpProfile(changedBody, publication, last)).toThrow();
    expect(() => validateAncestryHpProfile({ ...fresh, catalog: { ...fresh.catalog, chainRoots: {} } }, publication, last)).toThrow();
    expect(() => validateAncestryHpProfile({ ...fresh, closure: { ...closed, seals: 1 } }, publication, last)).toThrow();
    const unqualified = structuredClone(fresh); unqualified.functions[0].signature = "fixture()"; unqualified.wires[0].relation = "characters";
    expect(() => validateAncestryHpProfile(unqualified, publication, last)).not.toThrow();
  });
});
