// Disposable test publication only. Never modifies snapshots, character rows,
// pins, proofs or permissions directly; uses the ordinary atomic SRD importer.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSystemId, IMPORT_STEPS, upsertContent } from "../import-srd";
import { validateSrdCatalog } from "../transformers/validate-catalog";
import { assertNativeIdentity, nativeJson, testRuntime } from "./native";

async function main() {
  assertNativeIdentity(); const runtime = testRuntime(), mode = process.argv[2];
  assert(["legacy", "corrected"].includes(mode));
  assert.equal(process.env.INKBORNE_SRD_CACHE_DIR, "/workspace/.test-catalog");
  const entries = validateSrdCatalog(IMPORT_STEPS.flatMap(step => JSON.parse(fs.readFileSync(`/workspace/.test-catalog/prepared/${step.name}.json`, "utf8"))));
  assert.equal(entries.length, 1535);
  const current = entries.filter(entry => entry.content_type === "subclass" && entry.slug === "fiend"); assert.equal(current.length, 1);
  // Exact entry from the reviewed October23 legacy archive (whole archive hash
  // 1a0d379f8f0a79c3331b43b79d16873e9c890777ae20fc6d4fe413d4a4fa0820).
  const bytes = fs.readFileSync("scripts/unraid/legacy-fiend.json", "utf8").replaceAll("\r\n", "\n");
  const legacySha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(legacySha256, "fb4687387f3098f9d310fab7e483ae6fca4cbb0ef2775701a31ccea1e3bc4d31");
  const legacy = JSON.parse(bytes);
  const strip = (entry: typeof current[0], key: string) => ({ ...entry, data: Object.fromEntries(Object.entries(entry.data).filter(([name]) => name !== key)) });
  assert.deepEqual(strip(legacy, "spellcastingExtra"), strip(current[0], "spellcastingExpanded"));
  assert.deepEqual(legacy.data.spellcastingExtra, current[0].data.spellcastingExpanded);
  const catalogSql = `BEGIN READ ONLY; SELECT jsonb_build_object(
    'definitions',(SELECT count(*) FROM public.content_definitions),'versions',(SELECT count(*) FROM public.content_versions),
    'active',(SELECT count(*) FROM public.content_definitions WHERE NOT is_retired),
    'batches',(SELECT count(*) FROM public.srd_import_batches),'staging',(SELECT count(*) FROM public.srd_import_staging),
    'fiend',(SELECT jsonb_build_object('id',id,'version',version,'data',data,'effects',effects) FROM public.content_definitions WHERE content_type='subclass' AND slug='fiend'),
    'fiendSnapshots',(SELECT jsonb_agg(jsonb_build_object('version',version,'fingerprint',md5(to_jsonb(v)::text)) ORDER BY version)
      FROM public.content_versions v WHERE content_type_snapshot='subclass' AND slug_snapshot='fiend'),
    'otherDefinitions',(SELECT md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY id),'[]')::text) FROM public.content_definitions d WHERE NOT(content_type='subclass' AND slug='fiend')),
    'otherSnapshots',(SELECT md5(COALESCE(jsonb_agg(to_jsonb(v) ORDER BY id),'[]')::text) FROM public.content_versions v WHERE NOT(content_type_snapshot='subclass' AND slug_snapshot='fiend'))); ROLLBACK;`;
  type Catalog = { definitions: number; versions: number; active: number; batches: number; staging: number;
    fiend: { id: string; version: number; data: Record<string, unknown>; effects: unknown[] };
    fiendSnapshots: Array<{ version: number; fingerprint: string }>; otherDefinitions: string; otherSnapshots: string };
  const profileSql = fs.readFileSync("supabase/verification/earned-racial-installation-profile.sql", "utf8");
  const before = await nativeJson(catalogSql) as Catalog, profileBefore = await nativeJson(profileSql) as Record<string, unknown>;
  const expectedOld = mode === "legacy" ? 1 : 2, expectedNew = expectedOld + 1;
  assert.equal(before.definitions, 1535); assert.equal(before.active, 1535); assert.equal(before.versions, 1534 + expectedOld);
  assert.equal(before.fiend.version, expectedOld); assert.equal(before.fiendSnapshots.length, expectedOld);
  assert.deepEqual(before.fiend.data, mode === "legacy" ? current[0].data : legacy.data);
  const api = JSON.parse(fs.readFileSync("/run/inkborne/api.json", "utf8"));
  const client = createClient("http://127.0.0.1:9999", api.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const systemId = await getSystemId(client);
  await upsertContent(client, systemId, validateSrdCatalog(entries.map(entry => entry === current[0] && mode === "legacy" ? legacy : entry)));
  assertNativeIdentity();
  const after = await nativeJson(catalogSql) as Catalog, profileAfter = await nativeJson(profileSql) as Record<string, unknown>;
  for (const key of ["definitions", "active", "otherDefinitions", "otherSnapshots"] as const) assert.deepEqual(after[key], before[key], key);
  assert.equal(after.versions, 1534 + expectedNew); assert.equal(after.fiend.version, expectedNew);
  assert.equal(after.fiend.id, before.fiend.id); assert.deepEqual(after.fiend.data, mode === "legacy" ? legacy.data : current[0].data);
  assert.equal(after.batches, 0); assert.equal(after.staging, 0);
  assert.deepEqual(after.fiendSnapshots.slice(0, -1), before.fiendSnapshots); assert.equal(after.fiendSnapshots.length, expectedNew);
  for (const key of Object.keys(profileBefore).filter(key => !["catalog", "snapshots", "chainRoots"].includes(key))) assert.deepEqual(profileAfter[key], profileBefore[key], key);
  fs.writeFileSync(`/output/fiend-publication-${mode}.json`, JSON.stringify({ passed: true, runtime, mode, legacySha256,
    onlyChangedIdentity: "subclass/fiend", before, after, profileBefore, profileAfter, immutableSnapshotsRetained: true,
    characterRowsAndSecurityUnchanged: true, scope: "Fresh current-v1 to legacy-v2 to corrected-v3 test publication via normal atomic importer." }, null, 2) + "\n", { flag: "wx" });
}
void main().catch(error => {
  fs.writeFileSync("/run/inkborne/fiend-fixture-error.log", String(error instanceof Error ? error.stack : error), { mode: 0o600 });
  console.error("Scratch Fiend publication refused; raw details kept private"); process.exitCode = 1;
});
