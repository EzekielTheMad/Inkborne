import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { validateParentBackgroundVector } from "../parent-admission-acceptance";
import { assertNativeIdentity, nativeJson, testRuntime } from "./native";

// The genuine UI fixture is separate from this rollback-only SQL-role check.
// Reuse the historical vector and validator without changing their acceptance gate.
export async function verifyNativeBackground(characterId: string, actorId: string) {
  assertNativeIdentity();
  const runtime = testRuntime(), variables = { character_id: characterId, actor_id: actorId };
  const read = (name: string) => fs.readFileSync(`supabase/verification/${name}.sql`, "utf8");
  const observe = async () => ({
    native: await nativeJson(read("builder-parent-admission-readback"), variables),
    detail: await nativeJson(read("builder-parent-positive-detail"), variables),
    family: await nativeJson(read("builder-class-choices-readback"), variables),
    profile: await nativeJson(read("earned-racial-installation-profile")),
  });
  const before = await observe(), sql = read("builder-parent-background-vector");
  const vector = validateParentBackgroundVector(await nativeJson(sql, variables, "supabase_admin"), characterId, actorId);
  assertNativeIdentity();
  const after = await observe();
  assert.deepEqual(after, before, "background transaction changed fixture, catalog, profiles or other character rows");
  const ids = vector.privateFixtures.map(item => `'${item.id}'::uuid`).join(",");
  assert.deepEqual(await nativeJson(`BEGIN READ ONLY; SELECT jsonb_build_object(
    'definitions',(SELECT count(*) FROM public.content_definitions WHERE id IN(${ids})),
    'snapshots',(SELECT count(*) FROM public.content_versions WHERE content_id IN(${ids}))); ROLLBACK;`), { definitions: 0, snapshots: 0 });
  const sessions = await nativeJson(`BEGIN READ ONLY; SELECT count(*) FROM pg_stat_activity
    WHERE pid<>pg_backend_pid() AND application_name='ib-${runtime.runId.slice(0, 8)}-once'; ROLLBACK;`, {}, "supabase_admin");
  assert.equal(sessions, 0, "native one-shot client remained connected");
  const result = { kind: "unraid-parent-background-v1", passed: true, authenticationAccepted: false,
    runId: runtime.runId, sourceHead: runtime.sourceHead, engineId: runtime.engineId, databaseId: runtime.databaseId,
    characterId, actorId, vectorSourceSha256: createHash("sha256").update(sql).digest("hex"), vector,
    before, after, privateRootsAbsent: true, allNativeClientsExited: true,
    scope: "Fresh-state genuine Rogue fixture and rollback-only 1/0/2-write vector; historical full-parent/A4/F3 acceptance remains separate." };
  fs.writeFileSync("/output/native-background.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  return result;
}
