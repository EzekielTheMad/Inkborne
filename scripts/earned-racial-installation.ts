import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { z } from "zod";
import { PARENT_ACCEPTANCE_CHECKS, validateParentBackgroundVector } from "./parent-admission-acceptance";

export const EARNED_RACIAL_STAGE = {
  file: "supabase/staged/character-builder-earned-racial-spells.sql",
  sha256: "80a425c3a008190abc78e2efdf4857641bf19d6dd18891ee50c6e630c34178fb",
  crlfSha256: "e5602e382f14852a05422d922887983a9c0fe7f7d9a8cd37cf8aad076ca5fc2a",
  normalizer: "private.prepare_builder_class_feature_choices_v1(uuid,jsonb,jsonb,text,jsonb)",
  before: "ac38f1a56f22097481aa51ea3472d592", after: "ecd93787a191f3074ae6b458b763e932",
  helpers: {
    "private.builder_earned_racial_source_v1(uuid,jsonb,jsonb,uuid)": "13b480ff386a5c565e205370ce08fbe0",
    "private.prepare_builder_earned_racial_spells_v1(uuid,jsonb,jsonb,jsonb)": "40ad377512a1f97821e3763109ce64b4",
  },
} as const;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const md5 = z.string().regex(/^[a-f0-9]{32}$/), sha = z.string().regex(/^[a-f0-9]{64}$/);
export const installationSourceSchema = z.object({ head: z.string().regex(/^[a-f0-9]{40}$/), diffSha256: sha }).strict();
const identitySchema = z.object({ engineId: z.string().min(5).max(100), databaseId: sha });
export const EARNED_RACIAL_RETAINED_TABLES = ["public.characters", "public.character_content_refs", "public.character_feature_grants",
  "public.character_spell_grants", "public.character_spells", "public.character_inventory", "public.character_starting_grants",
  "private.character_class_origin_v1", "private.character_class_commands_v1", "private.character_builder_receipts_v1",
  "private.character_projection_order_v1", "private.character_builder_hp_draws_v1", "private.character_builder_class_acquisitions_v1",
  "private.character_class_occurrences_v1", "private.character_builder_progression_history_v1"] as const;
const rowDigest = z.object({ count: z.number().int().nonnegative(), fingerprint: md5 }).strict();
const functionProfile = z.object({ oid: z.number().int().positive(), signature: z.string().min(1), bodyMd5: md5,
  profile: z.record(z.string(), z.json()), owner: z.string(), language: z.string(), returnType: z.string(),
  execute: z.object({ anon: z.boolean(), authenticated: z.boolean(), service_role: z.boolean() }).strict(),
  executeAcl: z.array(z.object({ grantor: z.number().int().nonnegative(), grantee: z.number().int().nonnegative(),
    privilege_type: z.string(), is_grantable: z.boolean() }).strict()),
}).strict();
const closureSchema = z.object({ caps: z.literal(0), seals: z.literal(0), parentInstalled: z.literal(true), readinessCount: z.literal(13),
  readyCount: z.literal(0), classGate: z.literal(false), hitDieGate: z.literal(false), servicePrivateUsage: z.literal(false) }).strict();
export const earnedRacialProfileSchema = z.object({ kind: z.literal("earned-racial-installation-profile-v1"), runtimeRole: z.literal("postgres"),
  rows: z.record(z.string(), rowDigest), firstClassProofs: rowDigest, catalog: rowDigest, snapshots: rowDigest,
  chainRoots: z.record(z.string(), z.json()), functions: z.array(functionProfile).min(1),
  wires: z.array(z.json()).min(1), schemas: z.array(z.json()).min(2), relationPrivileges: z.array(z.json()).min(1),
  policies: z.array(z.json()).min(1), roles: z.array(z.object({ oid: z.number().int().positive(), name: z.string(), superuser: z.boolean(),
    bypassRls: z.boolean() }).catchall(z.json())).min(1), memberships: z.array(z.json()), closure: closureSchema,
}).strict();
export type EarnedRacialProfile = z.infer<typeof earnedRacialProfileSchema>;
export type ParentFunctionProfile = { signature: string; bodyMd5: string; owner: string; definer: boolean; volatility: string };

/** Whitespace variants are admitted by their complete byte hashes, not by an
 * arbitrary normalization rule. Only these reviewed LF bytes are executable. */
export function validateEarnedRacialStage(raw: Buffer) {
  const rawSha256 = hash(raw), sql = raw.toString("utf8").replaceAll("\r\n", "\n");
  assert([EARNED_RACIAL_STAGE.sha256, EARNED_RACIAL_STAGE.crlfSha256].some(expected => expected === rawSha256));
  assert.equal(hash(sql), EARNED_RACIAL_STAGE.sha256, "reviewed earned-racial stage bytes changed");
  const begin = sql.indexOf("FOR item IN SELECT * FROM (VALUES"), end = sql.indexOf(") expected(signature,body_md5", begin);
  assert(begin >= 0 && end > begin);
  const parentProfiles: ParentFunctionProfile[] = [...sql.slice(begin, end).matchAll(/\('([^']+)','([a-f0-9]{32})','([^']+)',(true|false),'([vis])'\)/g)]
    .map(([, signature, bodyMd5, owner, definer, volatility]) => ({ signature, bodyMd5, owner, definer: definer === "true", volatility }));
  assert.equal(parentProfiles.length, 25); assert.equal(new Set(parentProfiles.map(item => item.signature)).size, 25);
  return { sql, sourceSha256: EARNED_RACIAL_STAGE.sha256, sourceRawSha256: rawSha256, parentProfiles };
}

const wrapper = z.object({ exitCode: z.literal(0), remainingIdentities: z.array(z.unknown()).length(0) }).passthrough();
const actualApp = z.object({ actualApp: z.literal(true), actualAuthCookies: z.literal(true), actualPostgrest: z.literal(true), uiWritesOnly: z.literal(true) }).passthrough();
const nativeCleanup = z.object({ allCapturedBackendsGone: z.literal(true), allClientsExited: z.literal(true) }).passthrough();

/** Inputs are already hash-linked public artifacts. No boolean supplied on a
 * SQL-only report can stand in for the separately recorded full parent/A4 run. */
export function validateEarnedRacialPrerequisites(input: {
  parent: unknown; parentNative: unknown; parentApp: unknown; parentBackground: unknown; parentInstallation: unknown;
  ancestry: unknown; ancestryInstallation: unknown;
}, expectedIdentity: z.infer<typeof identitySchema>, expectedSource: z.infer<typeof installationSourceSchema>) {
  const identity = identitySchema.parse(expectedIdentity), source = installationSourceSchema.parse(expectedSource);
  const sameIdentity = (value: unknown) => assert.deepEqual(identitySchema.parse(value), identity, "prerequisite runtime changed");
  const parent = z.object({ kind: z.literal("builder-parent-admission-actual-acceptance-v1"), accepted: z.literal(true), actualApp: z.literal(true), authenticationAccepted: z.literal(true),
    nativeContentionPassed: z.literal(true), source: installationSourceSchema, acceptanceChecks: z.record(z.string(), z.boolean()),
    wrapper, after: z.object({ catalog: rowDigest, snapshots: rowDigest }).passthrough(), cleanup: nativeCleanup,
  }).passthrough().parse(input.parent);
  sameIdentity(parent); assert.deepEqual(parent.source, source, "parent source is not the frozen candidate");
  assert.deepEqual(Object.keys(parent.acceptanceChecks).sort(), [...PARENT_ACCEPTANCE_CHECKS].sort());
  for (const key of PARENT_ACCEPTANCE_CHECKS) assert.equal(parent.acceptanceChecks[key], true, `full parent acceptance missing: ${key}`);
  const app = actualApp.extend({ source: installationSourceSchema, actorId: z.uuid(), characterId: z.uuid(),
    roguePreparation: z.object({ characterId: z.uuid() }).passthrough() }).parse(input.parentApp);
  sameIdentity(app); assert.deepEqual(app.source, source);
  const native = z.object({ kind: z.literal("builder-parent-admission-native-actual-v1"), passed: z.literal(true), authenticationAccepted: z.literal(false),
    fixture: z.object({ actorId: z.literal(app.actorId), characterId: z.literal(app.characterId) }).strict(),
    fixtureBefore: z.record(z.string(), z.json()), fixtureAfter: z.record(z.string(), z.json()),
    catalogBefore: z.record(z.string(), z.json()), catalogAfter: z.record(z.string(), z.json()),
    negatives: z.object({ caseCount: z.literal(34), cases: z.array(z.unknown()).length(34) }).passthrough(),
    contention: z.object({ passed: z.literal(true), sessionsClosed: z.literal(true), cases: z.array(z.object({
      name: z.string(), status: z.literal("passed"), expectedSqlstate: z.string(), observedSqlstate: z.string(), affectedRows: z.number().optional(),
      parentProbeSucceeded: z.literal(true), beforeDigest: md5, afterDigest: md5,
      edge: z.object({ blockerPid: z.number().int().positive(), waiterPid: z.number().int().positive() }).passthrough(),
    }).passthrough()).length(8) }).passthrough(), cleanup: nativeCleanup,
  }).passthrough().parse(input.parentNative);
  sameIdentity(native);
  assert.deepEqual(native.fixtureAfter, native.fixtureBefore); assert.deepEqual(native.catalogAfter, native.catalogBefore);
  const caseSchema = z.object({ role: z.string(), case: z.string(), outcome: z.string(), sqlstate: z.string(), affectedRows: z.number().optional() }).strict();
  const negativeNames = ["state", "scores", "choices", "level", "system", "campaign", "archive", "owner", "identity", "revision", "delete", "state_patch", "state_cas", "ability_rpc", "background_rpc", "asi_rpc"];
  const expectedCases = ["authenticated", "service_role"].flatMap(role => [...negativeNames.map(name => role === "authenticated" && name === "delete"
    ? { role, case: name, outcome: "rls_no_rows_unchanged", sqlstate: "00000", affectedRows: 0 }
    : { role, case: name, outcome: "refused_unchanged", sqlstate: "42501" }), { role, case: "metadata", outcome: "allowed_then_rolled_back", sqlstate: "00000" }]);
  const sortCases = (items: Array<z.infer<typeof caseSchema>>) => [...items].sort((a, b) => `${a.role}/${a.case}`.localeCompare(`${b.role}/${b.case}`));
  assert.deepEqual(sortCases(native.negatives.cases.map(item => caseSchema.parse(item))), sortCases(expectedCases));
  assert.deepEqual(native.contention.cases.map(item => item.name), ["owner-update", "service-update", "owner-delete", "state-patch", "state-cas", "ability-rpc", "background-rpc", "asi-rpc"]);
  for (const item of native.contention.cases) {
    assert.equal(item.expectedSqlstate, item.name === "owner-delete" ? "00000" : "42501"); assert.equal(item.observedSqlstate, item.expectedSqlstate);
    if (item.name === "owner-delete") assert.equal(item.affectedRows, 0);
    assert.equal(item.beforeDigest, item.afterDigest); assert.notEqual(item.edge.blockerPid, item.edge.waiterPid);
  }
  const background = z.object({ kind: z.literal("parent-background-native-report-v1"), passed: z.literal(true), authenticationAccepted: z.literal(false),
    source: installationSourceSchema, vector: z.unknown(), vectorSourceSha256: sha,
    before: z.record(z.string(), z.json()), after: z.record(z.string(), z.json()), cleanup: nativeCleanup,
  }).passthrough().parse(input.parentBackground);
  sameIdentity(background); assert.deepEqual(background.source, source);
  assert.deepEqual(background.before, background.after); assert.deepEqual(background.after, parent.after);
  validateParentBackgroundVector(background.vector, app.roguePreparation.characterId, app.actorId);
  for (const [receipt, file, sourceSha256] of [
    [input.parentInstallation, "supabase/staged/character-builder-parent-admission.sql", "43988b054442805577b8e97be14b82c365c4d5b580d32e6abcc9bfcbab331e19"],
    [input.ancestryInstallation, "supabase/staged/character-builder-ancestry-hp-bonus.sql", "edadfd7b882358dfaf96a3910795cca5eff8bea26118157b92119c30e225118c"],
  ] as const) {
    const saved = z.object({ installed: z.literal(true), file: z.literal(file), sourceSha256: z.literal(sourceSha256) }).passthrough().parse(receipt);
    sameIdentity(saved);
  }
  const ancestry = z.object({ accepted: z.literal(true), actualApp: z.literal(true), caseId: z.literal("A4"),
    head: z.string().regex(/^[a-f0-9]{40}$/), diffSha256: sha,
    acceptedNativeSnapshots: z.literal(11), wrapper, cleanup: z.object({ remainingBackends: z.literal(0), allClientsExited: z.literal(true) }).passthrough(),
    catalog: z.object({ definitions: z.literal(1535), versions: z.number().int().positive(), chainRoots: z.record(z.string(), z.json()) }),
    nativeProfile: z.record(z.string(), z.json()),
  }).passthrough().parse(input.ancestry);
  sameIdentity(ancestry); assert.deepEqual({ head: ancestry.head, diffSha256: ancestry.diffSha256 }, source, "A4 source is not the frozen candidate");
  return { parent, ancestry };
}

function functionBySignature(profile: EarnedRacialProfile, signature: string) {
  const matches = profile.functions.filter(item => item.signature === signature); assert.equal(matches.length, 1, `exact installed function required: ${signature}`); return matches[0];
}
function validateProfile(input: unknown) {
  const value = earnedRacialProfileSchema.parse(input);
  assert.deepEqual(Object.keys(value.rows).sort(), [...EARNED_RACIAL_RETAINED_TABLES].sort());
  assert.equal(value.catalog.count, 1535); assert(value.snapshots.count >= 1538);
  assert.equal(new Set(value.functions.map(item => item.oid)).size, value.functions.length); assert.equal(new Set(value.functions.map(item => item.signature)).size, value.functions.length);
  const postgres = value.roles.filter(item => item.name === "postgres"), admin = value.roles.filter(item => item.name === "supabase_admin");
  assert.equal(postgres.length, 1); assert(!postgres[0].superuser && postgres[0].bypassRls); assert.equal(admin.length, 1); assert(admin[0].superuser);
  return value;
}

export function validateEarnedRacialPreimage(input: unknown, acceptedA4Profile: unknown, parentProfiles: readonly ParentFunctionProfile[], acceptedParentProfile: unknown) {
  const before = validateProfile(input);
  // A4's profile omits these security surfaces. Both readers use identical
  // native fields and OID ordering, so compare their accepted parent bytes
  // directly rather than adopting a newly observed baseline after A4.
  const parentSecurity = earnedRacialProfileSchema.pick({ schemas: true, policies: true, relationPrivileges: true }).parse(acceptedParentProfile);
  for (const key of ["schemas", "policies", "relationPrivileges"] as const)
    assert.deepEqual(before[key], parentSecurity[key], `fresh ${key} differs from accepted parent`);
  const a4 = { catalog: { definitions: before.catalog.count, versions: before.snapshots.count, chainRoots: before.chainRoots },
    snapshotsFingerprint: before.snapshots.fingerprint,
    functions: before.functions.map(({ oid, signature, bodyMd5, profile, owner, execute }) => ({ oid, signature, bodyMd5, profile, owner, execute })),
    wires: before.wires, roles: before.roles, memberships: before.memberships, closure: before.closure };
  assert.deepEqual(a4, acceptedA4Profile, "fresh database profile differs from complete accepted A4");
  assert.equal(parentProfiles.length, 25);
  for (const expected of parentProfiles) {
    const actual = functionBySignature(before, expected.signature); assert.equal(actual.bodyMd5, expected.bodyMd5);
    assert.equal(actual.owner, expected.owner); assert.equal(actual.profile.prosecdef, expected.definer); assert.equal(actual.profile.provolatile, expected.volatility);
  }
  for (const [signature, body] of [[EARNED_RACIAL_STAGE.normalizer, EARNED_RACIAL_STAGE.before],
    ["private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)", "f1e31016bdf00414996ac0853ae5efc2"],
    ["private.builder_ancestry_hit_point_bonus_v1(uuid,jsonb)", "19594d15276862e6d8e2a8ff3f8376f8"],
    ["private.builder_catalog_dependency_v1(uuid,jsonb,text,text)", "9e049a6c5039f785f8ec1c8ddec0431d"],
  ]) assert.equal(functionBySignature(before, signature).bodyMd5, body);
  assert(!before.functions.some(item => Object.hasOwn(EARNED_RACIAL_STAGE.helpers, item.signature)), "F3 helpers are already installed");
  return before;
}

export function validateEarnedRacialPostimage(before: EarnedRacialProfile, input: unknown) {
  const after = validateProfile(input);
  for (const key of ["rows", "firstClassProofs", "catalog", "snapshots", "chainRoots", "wires", "schemas", "policies", "relationPrivileges", "roles", "memberships", "closure"] as const)
    assert.deepEqual(after[key], before[key], `${key} changed during F3 installation`);
  for (const old of before.functions) {
    const saved = after.functions.filter(item => item.oid === old.oid); assert.equal(saved.length, 1, "existing function removed or replaced");
    assert.deepEqual(saved[0], old.signature === EARNED_RACIAL_STAGE.normalizer ? { ...old, bodyMd5: EARNED_RACIAL_STAGE.after } : old, "unreviewed function/profile/ACL change");
  }
  const created = after.functions.filter(item => !before.functions.some(old => old.oid === item.oid));
  assert.deepEqual(created.map(item => item.signature).sort(), Object.keys(EARNED_RACIAL_STAGE.helpers).sort());
  const owner = after.roles.find(item => item.name === "postgres")!.oid;
  for (const helper of created) {
    assert.equal(helper.owner, "postgres"); assert.equal(helper.language, "plpgsql"); assert.equal(helper.returnType, "jsonb");
    assert.equal(helper.bodyMd5, EARNED_RACIAL_STAGE.helpers[helper.signature as keyof typeof EARNED_RACIAL_STAGE.helpers]);
    assert.deepEqual(helper.execute, { anon: false, authenticated: false, service_role: false });
    assert.deepEqual(helper.executeAcl, [{ grantor: owner, grantee: owner, privilege_type: "EXECUTE", is_grantable: false }]);
    for (const [key, expected] of Object.entries({ proowner: owner, prosecdef: true, provolatile: "v", prokind: "f", proretset: false,
      proisstrict: false, proleakproof: false, proparallel: "u", proconfig: ['search_path=""'] })) assert.deepEqual(helper.profile[key], expected);
  }
  return after;
}
