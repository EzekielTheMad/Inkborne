import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { systemSchemaDefinitionSchema } from "../../lib/schemas/system";
import { nativeJson, nativeSql, testRuntime } from "./native";

export async function bootstrap() {
  const runtime = testRuntime(), source = JSON.parse(fs.readFileSync("/run/inkborne/source.json", "utf8")) as {
    sourceHead: string; migrations: Array<{ file: string; sha256: string; role: "postgres" | "supabase_admin" }>;
    stages: Array<{ file: string; sha256: string; role: "postgres" | "supabase_admin" }>;
  };
  assert.equal(source.sourceHead, runtime.sourceHead); assert.equal(source.migrations.length, 83); assert.equal(source.stages.length, 34);
  const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const steps: Array<{ file: string; sha256: string; role: string }> = []; let phase = "official-bootstrap-preflight";
  const save = (extra = {}) => fs.writeFileSync("/output/bootstrap.json", JSON.stringify({ sourceHead: runtime.sourceHead, phase, steps, ...extra }, null, 2) + "\n");
  try {
    await nativeSql(fs.readFileSync("scripts/equipment-runtime/bootstrap-preflight.sql", "utf8"));
    for (const step of [...source.migrations, ...source.stages]) {
      phase = step.file; save();
      assert(/^supabase\/(migrations|staged)\/[a-zA-Z0-9_-]+\.sql$/.test(step.file));
      const sql = fs.readFileSync(step.file, "utf8").replaceAll("\r\n", "\n"); assert.equal(sha(sql), step.sha256);
      await nativeSql(sql, {}, step.role); steps.push(step);
      if (steps.length === 83) await nativeSql(fs.readFileSync("scripts/equipment-runtime/baseline-assertions.sql", "utf8"));
    }
    phase = "empty-current-profile"; save();
    const profileSql = fs.readFileSync("supabase/verification/earned-racial-installation-profile.sql", "utf8");
    const before = await nativeJson(profileSql) as { functions: unknown[]; wires: unknown[]; roles: unknown[]; schemas: unknown[];
      policies: unknown[]; relationPrivileges: unknown[]; memberships: unknown[]; closure: unknown; rows: Record<string, { count: number }> };
    assert.deepEqual(before.closure, { caps: 0, seals: 0, parentInstalled: true, readinessCount: 13, readyCount: 0,
      classGate: false, hitDieGate: false, servicePrivateUsage: false });
    assert(Object.values(before.rows).every(row => row.count === 0), "new stack must start without character fixtures");
    const seed = fs.readFileSync("supabase/seed.sql", "utf8").split(/\r?\n-- D&D 5e 2024 SRD/)[0];
    assert(seed.includes("'dnd-5e-2014'")); await nativeSql(seed, {}, "supabase_admin");
    const system = await nativeJson("SELECT jsonb_build_object('id',id,'status',status,'schema',schema_definition) FROM public.game_systems WHERE slug='dnd-5e-2014'", {}, "supabase_admin") as { id: string; status: string; schema: unknown };
    assert.equal(system.status, "published"); systemSchemaDefinitionSchema.parse(system.schema);
    phase = "cached-real-srd-import"; save();
    const cache = process.env.INKBORNE_SRD_CACHE_DIR!;
    const manifestBytes = fs.readFileSync(cache + "/source-manifest.json");
    assert.equal(sha(manifestBytes), "60e35087457442e13b2ca8404b129baa934684a02937720a22770894c207e40e");
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as { sources: Array<{ file: string; sha256: string }> };
    assert.equal(manifest.sources.length, 1572);
    for (const item of manifest.sources) {
      assert(/^responses\/[a-z0-9/-]+\.json$/.test(item.file) && !item.file.includes(".."));
      assert.equal(sha(fs.readFileSync(cache + "/" + item.file)), item.sha256);
    }
    const server = JSON.parse(fs.readFileSync("/run/inkborne/server-env.json", "utf8")) as Record<string, string>;
    const imported = spawnSync("npm", ["run", "import:srd"], { encoding: "utf8", env: { ...process.env, ...server }, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    fs.writeFileSync("/run/inkborne/import.log", imported.stdout + imported.stderr, { mode: 0o600 });
    assert.equal(imported.status, 0, "cached SRD import failed; raw output kept private");
    const catalog = await nativeJson(`SELECT jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),
      'versions',(SELECT count(*) FROM public.content_versions),'active',(SELECT count(*) FROM public.content_definitions WHERE NOT is_retired),
      'batches',(SELECT count(*) FROM public.srd_import_batches),'staging',(SELECT count(*) FROM public.srd_import_staging))`) as Record<string, number>;
    assert.deepEqual(catalog, { definitions: 1535, versions: 1535, active: 1535, batches: 0, staging: 0 });
    const after = await nativeJson(profileSql) as typeof before;
    for (const key of ["functions", "wires", "roles", "schemas", "policies", "relationPrivileges", "memberships", "closure"] as const) assert.deepEqual(after[key], before[key], `import changed ${key}`);
    assert(Object.values(after.rows).every(row => row.count === 0));
    phase = "disposable-auth-accounts"; save();
    const api = JSON.parse(fs.readFileSync("/run/inkborne/api.json", "utf8")) as { anonKey: string; serviceRoleKey: string };
    const client = createClient("http://127.0.0.1:9999", api.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const account = async (label: string) => {
      const email = `${label}-${runtime.runId.slice(0, 8)}@inkborne.invalid`, password = randomBytes(24).toString("hex");
      const result = await client.auth.admin.createUser({ email, password, email_confirm: true });
      assert(!result.error && result.data.user?.id, "disposable local Auth provisioning failed; values withheld"); return { id: result.data.user.id, email, password };
    };
    const owner = await account("owner"), other = await account("other");
    fs.writeFileSync("/run/inkborne/test-config.json", JSON.stringify({ appOrigin: "http://127.0.0.1:3001", supabaseOrigin: "http://127.0.0.1:9999", owner, other, ...api }) + "\n", { mode: 0o600, flag: "wx" });
    phase = "ready"; save({ passed: true, catalog, cachedResponses: 1572, freshVersionOneCatalog: true,
      currentProfile: after, historicalUpgradeAcceptance: false });
    console.log(JSON.stringify({ phase, definitions: 1535, snapshots: 1535, accounts: 2 }));
  } catch { save({ passed: false }); throw Error(`scratch bootstrap refused at ${phase}; preserve bootstrap report`); }
}
