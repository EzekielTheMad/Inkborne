import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PARENT_ACCEPTANCE_CHECKS } from "../../scripts/parent-admission-acceptance";
import { EARNED_RACIAL_STAGE, EARNED_RACIAL_RETAINED_TABLES, validateEarnedRacialStage,
  validateEarnedRacialPreimage, validateEarnedRacialPostimage, validateEarnedRacialPrerequisites,
  type EarnedRacialProfile } from "../../scripts/earned-racial-installation";

// Synthetic validation envelopes only. These tests do not execute PostgreSQL,
// Docker, Auth, installation SQL or a browser, and produce no accepted receipt.
const stageBytes = readFileSync("supabase/staged/character-builder-earned-racial-spells.sql");
const stage = validateEarnedRacialStage(stageBytes);
const digest = { count: 0, fingerprint: "a".repeat(32) };
function fn(signature: string, bodyMd5: string, oid: number, owner = "postgres", definer = true, volatility = "v") {
  return { oid, signature, bodyMd5, owner, language: "plpgsql", returnType: "jsonb",
    execute: { anon: false, authenticated: false, service_role: false },
    executeAcl: [{ grantor: 10, grantee: 10, privilege_type: "EXECUTE", is_grantable: false }],
    profile: { oid, proowner: 10, prosecdef: definer, provolatile: volatility, prokind: "f", proretset: false,
      proisstrict: false, proleakproof: false, proparallel: "u", proconfig: ['search_path=""'] } };
}
function fixture() {
  const before: EarnedRacialProfile = { kind: "earned-racial-installation-profile-v1", runtimeRole: "postgres",
    rows: Object.fromEntries(EARNED_RACIAL_RETAINED_TABLES.map(table => [table, { ...digest }])), firstClassProofs: { ...digest },
    catalog: { ...digest, count: 1535 }, snapshots: { ...digest, count: 1538 }, chainRoots: {},
    functions: stage.parentProfiles.map((entry, index) => fn(entry.signature, entry.bodyMd5, 100 + index, entry.owner, entry.definer, entry.volatility)),
    wires: [{ oid: 1 }], schemas: [{ name: "public" }, { name: "private" }], policies: [{ oid: 2 }], relationPrivileges: [{ oid: 3 }],
    roles: [{ oid: 10, name: "postgres", superuser: false, bypassRls: true }, { oid: 11, name: "supabase_admin", superuser: true, bypassRls: true }], memberships: [],
    closure: { caps: 0, seals: 0, parentInstalled: true, readinessCount: 13, readyCount: 0, classGate: false, hitDieGate: false, servicePrivateUsage: false } };
  before.functions.push(fn(EARNED_RACIAL_STAGE.normalizer, EARNED_RACIAL_STAGE.before, 200),
    fn("private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)", "f1e31016bdf00414996ac0853ae5efc2", 201),
    fn("private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)", "19594d15276862e6d8e2a8ff3f8376f8", 202),
    fn("private.builder_catalog_dependency_v1(uuid,jsonb,text,text)", "9e049a6c5039f785f8ec1c8ddec0431d", 203));
  const a4 = { catalog: { definitions: 1535, versions: 1538, chainRoots: {} }, snapshotsFingerprint: digest.fingerprint,
    functions: before.functions.map(({ oid, signature, bodyMd5, profile, owner, execute }) => ({ oid, signature, bodyMd5, profile, owner, execute })),
    wires: before.wires, roles: before.roles, memberships: [], closure: before.closure };
  const after = structuredClone(before);
  after.functions.find(entry => entry.signature === EARNED_RACIAL_STAGE.normalizer)!.bodyMd5 = EARNED_RACIAL_STAGE.after;
  after.functions.push(...Object.entries(EARNED_RACIAL_STAGE.helpers).map(([signature, body], index) => fn(signature, body, 300 + index)));
  const parent = structuredClone({ schemas: before.schemas, policies: before.policies, relationPrivileges: before.relationPrivileges });
  return { before, after, a4, parent };
}
function prerequisites() {
  const identity = { engineId: "local-owned-engine", databaseId: "a".repeat(64) };
  const source = { head: "a".repeat(40), diffSha256: "b".repeat(64) };
  const actorId = "11111111-1111-4111-8111-111111111111", characterId = "22222222-2222-4222-8222-222222222222";
  const rogueId = "33333333-3333-4333-8333-333333333333";
  const cleanup = { allCapturedBackendsGone: true, allClientsExited: true };
  const negatives = ["authenticated", "service_role"].flatMap(role => ["state", "scores", "choices", "level", "system", "campaign", "archive", "owner", "identity", "revision", "delete", "state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc", "metadata"]
    .map(name => ({ role, case: name, outcome: name === "metadata" ? "allowed_then_rolled_back" : role === "authenticated" && name === "delete" ? "rls_no_rows_unchanged" : "refused_unchanged",
      sqlstate: name === "metadata" || role === "authenticated" && name === "delete" ? "00000" : "42501",
      ...(role === "authenticated" && name === "delete" ? { affectedRows: 0 } : {}) })));
  const input = {
    parent: { ...identity, kind: "builder-parent-admission-actual-acceptance-v1", accepted: true, actualApp: true, authenticationAccepted: true,
      nativeContentionPassed: true, source: { ...source }, acceptanceChecks: Object.fromEntries(PARENT_ACCEPTANCE_CHECKS.map(key => [key, true])),
      wrapper: { exitCode: 0, remainingIdentities: [] as unknown[] }, after: { catalog: { ...digest }, snapshots: { ...digest } }, cleanup: { ...cleanup } },
    parentApp: { ...identity, actualApp: true, actualAuthCookies: true, actualPostgrest: true, uiWritesOnly: true,
      source: { ...source }, actorId, characterId, roguePreparation: { characterId: rogueId } },
    parentNative: { ...identity, kind: "builder-parent-admission-native-actual-v1", passed: true, authenticationAccepted: false,
      fixture: { actorId, characterId }, fixtureBefore: { marker: "retained" }, fixtureAfter: { marker: "retained" },
      catalogBefore: { marker: "retained" }, catalogAfter: { marker: "retained" },
      negatives: { caseCount: 34, cases: negatives },
      contention: { passed: true, sessionsClosed: true, cases: ["owner-update", "service-update", "owner-delete", "state-patch", "state-cas", "ability-rpc", "background-rpc", "asi-rpc"]
        .map(name => ({ name, status: "passed", expectedSqlstate: name === "owner-delete" ? "00000" : "42501", observedSqlstate: name === "owner-delete" ? "00000" : "42501",
          ...(name === "owner-delete" ? { affectedRows: 0 } : {}), parentProbeSucceeded: true, beforeDigest: digest.fingerprint, afterDigest: digest.fingerprint,
          edge: { blockerPid: 101, waiterPid: 102 } })) }, cleanup: { ...cleanup } },
    parentBackground: { ...identity, kind: "parent-background-native-report-v1", passed: true, authenticationAccepted: false, source: { ...source },
      vectorSourceSha256: "c".repeat(64), before: { catalog: { ...digest }, snapshots: { ...digest } }, after: { catalog: { ...digest }, snapshots: { ...digest } }, cleanup: { ...cleanup },
      vector: { kind: "parent-background-native-vector-v1", authenticationAccepted: false, characterId: rogueId, actorId,
        fixtureScope: "two private background inserts inside a rolled-back native transaction",
        privateFixtures: ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"].map(id => ({ id, version: 1, fingerprint: digest.fingerprint })),
        capsRemaining: 0, sealsRemaining: 0,
        cases: ["changed-one", "unchanged-zero", "changed-two"].map((label, index) => ({ label, physicalWrites: [1, 0, 2][index],
          beforeRevision: ["8", "9", "9"][index], afterRevision: ["9", "9", "11"][index], expertiseBefore: ["skill-insight", "thieves-tools"],
          expertiseAfter: index === 2 ? ["thieves-tools"] : ["skill-insight", "thieves-tools"], beforeGraphFingerprint: digest.fingerprint,
          afterGraphFingerprint: digest.fingerprint, operationId: `${index + 6}6666666-6666-4666-8666-666666666666`, deferredConstraintsForced: true })) } },
    parentInstallation: { ...identity, installed: true, file: "supabase/staged/character-builder-parent-admission.sql",
      sourceSha256: "43988b054442805577b8e97be14b82c365c4d5b580d32e6abcc9bfcbab331e19" },
    ancestryInstallation: { ...identity, installed: true, file: "supabase/staged/character-builder-ancestry-hp-bonus.sql",
      sourceSha256: "edadfd7b882358dfaf96a3910795cca5eff8bea26118157b92119c30e225118c" },
    ancestry: { ...identity, accepted: true, actualApp: true, caseId: "A4", ...source, acceptedNativeSnapshots: 11,
      wrapper: { exitCode: 0, remainingIdentities: [] as unknown[] }, cleanup: { remainingBackends: 0, allClientsExited: true },
      catalog: { definitions: 1535, versions: 1538, chainRoots: {} }, nativeProfile: fixture().a4 },
  };
  return { input, identity, source };
}

describe("SOURCE ONLY finite F3 installation validation", () => {
  it("admits only the exact reviewed LF/CRLF stage and its 25 parent profiles", () => {
    const lf = stageBytes.toString("utf8").replaceAll("\r\n", "\n");
    expect(validateEarnedRacialStage(Buffer.from(lf)).sourceSha256).toBe(EARNED_RACIAL_STAGE.sha256);
    expect(validateEarnedRacialStage(Buffer.from(lf.replaceAll("\n", "\r\n"))).sourceSha256).toBe(EARNED_RACIAL_STAGE.sha256);
    expect(stage.parentProfiles).toHaveLength(25);
    expect(() => validateEarnedRacialStage(Buffer.from(lf + "-- changed\n"))).toThrow();
  });
  it("accepts exactly one normalizer change and two owner-only helpers", () => {
    const { before, after, a4, parent } = fixture();
    expect(validateEarnedRacialPreimage(before, a4, stage.parentProfiles, parent)).toEqual(before);
    expect(validateEarnedRacialPostimage(before, after)).toEqual(after);
  });
  it.each(["rows", "firstClassProofs", "catalog", "snapshots", "chainRoots", "wires", "roles", "memberships", "schemas", "policies", "relationPrivileges"] as const)("refuses changed %s", key => {
    const { before, after } = fixture();
    if (["rows", "chainRoots"].includes(key)) (after[key] as Record<string, unknown>).unexpected = true;
    else if (Array.isArray(after[key])) (after[key] as unknown[]).push({ changed: true });
    else (after[key] as Record<string, unknown>).fingerprint = "b".repeat(32);
    expect(() => validateEarnedRacialPostimage(before, after)).toThrow();
  });
  it.each(["body", "acl", "owner", "wire", "gate", "existing-profile", "extra-function"])("refuses %s drift", fault => {
    const { before, after } = fixture(), helper = after.functions.at(-1)!;
    if (fault === "body") helper.bodyMd5 = "b".repeat(32);
    if (fault === "acl") helper.execute.authenticated = true;
    if (fault === "owner") helper.profile.proowner = 11;
    if (fault === "wire") after.wires = [];
    if (fault === "gate") (after.closure as Record<string, unknown>).classGate = true;
    if (fault === "existing-profile") after.functions[0].profile.procost = 999;
    if (fault === "extra-function") after.functions.push(fn("public.unexpected()", "b".repeat(32), 999));
    expect(() => validateEarnedRacialPostimage(before, after)).toThrow();
  });
  it("refuses already-installed F3 or a profile that differs from accepted A4", () => {
    const { before, after, a4, parent } = fixture();
    expect(() => validateEarnedRacialPreimage(after, a4, stage.parentProfiles, parent)).toThrow();
    before.snapshots.fingerprint = "b".repeat(32);
    expect(() => validateEarnedRacialPreimage(before, a4, stage.parentProfiles, parent)).toThrow();
  });
  it.each(["schemas", "policies", "relationPrivileges"] as const)("refuses pre-install %s drift from accepted parent even when A4 still matches", key => {
    const { before, a4, parent } = fixture(); before[key].push({ unreviewed: true });
    expect(() => validateEarnedRacialPreimage(before, a4, stage.parentProfiles, parent)).toThrow(`fresh ${key} differs from accepted parent`);
  });
  it.each(["schemas", "policies", "relationPrivileges"] as const)("requires accepted parent %s baseline", key => {
    const { before, a4, parent } = fixture(), incomplete: Record<string, unknown> = { ...parent }; delete incomplete[key];
    expect(() => validateEarnedRacialPreimage(before, a4, stage.parentProfiles, incomplete)).toThrow();
  });
  it("refuses SQL-only or incomplete prerequisites before installation", () => {
    const identity = { engineId: "local-owned-engine", databaseId: "a".repeat(64) };
    const source = { head: "a".repeat(40), diffSha256: "b".repeat(64) };
    for (const parent of [{ accepted: true, authenticationAccepted: false }, { accepted: true, actualApp: true }, { accepted: false }])
      expect(() => validateEarnedRacialPrerequisites({ parent, parentNative: {}, parentApp: {}, parentBackground: {}, parentInstallation: {}, ancestry: {}, ancestryInstallation: {} }, identity, source)).toThrow();
  });
  it("admits a complete synthetic parent/A4 prerequisite envelope without claiming runtime acceptance", () => {
    const { input, identity, source } = prerequisites();
    expect(validateEarnedRacialPrerequisites(input, identity, source).parent.accepted).toBe(true);
  });
  it.each(PARENT_ACCEPTANCE_CHECKS)("refuses missing full-parent check %s", key => {
    const { input, identity, source } = prerequisites(); delete input.parent.acceptanceChecks[key];
    expect(() => validateEarnedRacialPrerequisites(input, identity, source)).toThrow();
  });
  it.each(["extra-check", "sql-only-parent", "parent-source", "app-source", "native-database", "missing-negative", "duplicate-negative", "negative-sqlstate", "delete-rows",
    "contention-name", "parent-probe", "same-session", "contention-digest", "fixture-drift", "catalog-drift", "background-failed", "background-source", "background-scope",
    "background-duplicate-fixture", "background-missing-case", "background-write-count", "background-rollback", "background-cleanup", "parent-cleanup", "wrapper-leak",
    "a4-snapshot-count", "a4-source", "a4-cleanup", "stage-source", "stage-database"])("refuses prerequisite %s", fault => {
    const { input, identity, source } = prerequisites();
    if (fault === "extra-check") input.parent.acceptanceChecks.unreviewed = true;
    if (fault === "sql-only-parent") input.parent.authenticationAccepted = false;
    if (fault === "parent-source") input.parent.source.head = "c".repeat(40);
    if (fault === "app-source") input.parentApp.source.diffSha256 = "c".repeat(64);
    if (fault === "native-database") input.parentNative.databaseId = "c".repeat(64);
    if (fault === "missing-negative") input.parentNative.negatives.cases.pop();
    if (fault === "duplicate-negative") input.parentNative.negatives.cases[0] = { ...input.parentNative.negatives.cases[1] };
    if (fault === "negative-sqlstate") input.parentNative.negatives.cases[0].sqlstate = "00000";
    if (fault === "delete-rows") input.parentNative.negatives.cases.find(item => item.role === "authenticated" && item.case === "delete")!.affectedRows = 1;
    if (fault === "contention-name") input.parentNative.contention.cases[0].name = "unreviewed";
    if (fault === "parent-probe") input.parentNative.contention.cases[0].parentProbeSucceeded = false;
    if (fault === "same-session") input.parentNative.contention.cases[0].edge.waiterPid = 101;
    if (fault === "contention-digest") input.parentNative.contention.cases[0].afterDigest = "b".repeat(32);
    if (fault === "fixture-drift") input.parentNative.fixtureAfter.marker = "changed";
    if (fault === "catalog-drift") input.parentNative.catalogAfter.marker = "changed";
    if (fault === "background-failed") input.parentBackground.passed = false;
    if (fault === "background-source") input.parentBackground.source.head = "c".repeat(40);
    if (fault === "background-scope") input.parentBackground.vector.fixtureScope = "unscoped";
    if (fault === "background-duplicate-fixture") input.parentBackground.vector.privateFixtures[1].id = input.parentBackground.vector.privateFixtures[0].id;
    if (fault === "background-missing-case") input.parentBackground.vector.cases.pop();
    if (fault === "background-write-count") input.parentBackground.vector.cases[2].physicalWrites = 1;
    if (fault === "background-rollback") input.parentBackground.after.catalog.fingerprint = "b".repeat(32);
    if (fault === "background-cleanup") input.parentBackground.cleanup.allCapturedBackendsGone = false;
    if (fault === "parent-cleanup") input.parent.cleanup.allClientsExited = false;
    if (fault === "wrapper-leak") input.parent.wrapper.remainingIdentities.push({ pid: 1 });
    if (fault === "a4-snapshot-count") input.ancestry.acceptedNativeSnapshots = 10;
    if (fault === "a4-source") input.ancestry.head = "c".repeat(40);
    if (fault === "a4-cleanup") input.ancestry.cleanup.remainingBackends = 1;
    if (fault === "stage-source") input.ancestryInstallation.sourceSha256 = "c".repeat(64);
    if (fault === "stage-database") input.parentInstallation.databaseId = "c".repeat(64);
    expect(() => validateEarnedRacialPrerequisites(input, identity, source)).toThrow();
  });
});
