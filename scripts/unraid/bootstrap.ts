import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { systemSchemaDefinitionSchema } from "../../lib/schemas/system";
import { nativeJson, nativeSql, testRuntime } from "./native";

export async function bootstrap() {
  const runtime = testRuntime(), source = JSON.parse(fs.readFileSync("/run/inkborne/source.json", "utf8")) as {
    sourceHead: string; migrations: Array<{ file: string; sha256: string; role: "postgres" | "supabase_admin" }>;
    stages: Array<{ file: string; sha256: string; role: "postgres" | "supabase_admin" }>;
    basicSheetStage?: { file: string; sha256: string; role: "supabase_admin" };
  };
  assert.equal(source.sourceHead, runtime.sourceHead); assert.equal(source.migrations.length, 83); assert.equal(source.stages.length, 34);
  const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const steps: Array<{ file: string; sha256: string; role: string }> = []; let phase = "official-bootstrap-preflight";
  let importProcess: Record<string, unknown> | undefined;
  const save = (extra = {}) => fs.writeFileSync("/output/bootstrap.json", JSON.stringify({ sourceHead: runtime.sourceHead, phase, steps, importProcess, ...extra }, null, 2) + "\n");
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
    // The loopback API gateway shares this event loop. A synchronous child wait
    // would prevent the importer's own HTTP requests from ever being served.
    const importStartedUtc = new Date().toISOString();
    const imported = spawn("npm", ["run", "import:srd"], { env: { ...process.env, ...server },
      stdio: ["ignore", "pipe", "pipe"], detached: true });
    fs.writeFileSync("/run/inkborne/import.log", "", { mode: 0o600 });
    importProcess = { pid: imported.pid, parentPid: process.pid, cwd: process.cwd(), args: ["npm", "run", "import:srd"], startedUtc: importStartedUtc }; save();
    let importBytes = 0, importLimit: "timeout" | "output-limit" | undefined;
    const terminateImport = (reason: "timeout" | "output-limit") => {
      importLimit ??= reason;
      if (imported.pid) try { process.kill(-imported.pid, "SIGKILL"); } catch {}
    };
    const recordImport = (bytes: Buffer) => {
      importBytes += bytes.length;
      if (importBytes > 4 * 1024 * 1024) { terminateImport("output-limit"); return; }
      fs.appendFileSync("/run/inkborne/import.log", bytes);
    };
    imported.stdout.on("data", recordImport); imported.stderr.on("data", recordImport);
    const importTimeout = setTimeout(() => terminateImport("timeout"), 180000);
    const importExitCode = await new Promise<number | null>((resolve, reject) => { imported.once("error", reject); imported.once("close", resolve); })
      .finally(() => clearTimeout(importTimeout));
    importProcess = { ...importProcess, finishedUtc: new Date().toISOString(), exitCode: importExitCode, limit: importLimit ?? null }; save();
    assert.equal(importLimit, undefined, "cached SRD import exceeded its bound");
    assert.equal(importExitCode, 0, "cached SRD import failed; raw output kept private");
    const catalog = await nativeJson(`SELECT jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),
      'versions',(SELECT count(*) FROM public.content_versions),'active',(SELECT count(*) FROM public.content_definitions WHERE NOT is_retired),
      'batches',(SELECT count(*) FROM public.srd_import_batches),'staging',(SELECT count(*) FROM public.srd_import_staging))`) as Record<string, number>;
    assert.deepEqual(catalog, { definitions: 1535, versions: 1535, active: 1535, batches: 0, staging: 0 });
    const after = await nativeJson(profileSql) as typeof before;
    for (const key of ["functions", "wires", "roles", "schemas", "policies", "relationPrivileges", "memberships", "closure"] as const) assert.deepEqual(after[key], before[key], `import changed ${key}`);
    assert(Object.values(after.rows).every(row => row.count === 0));
    if (process.env.INKBORNE_TEST_MODE === "csj") {
      const stage = source.basicSheetStage;
      assert(stage && stage.file === "supabase/staged/character-basic-sheet-commands.sql" && stage.role === "supabase_admin",
        "committed finite CSJ stage required");
      const sql = fs.readFileSync(stage.file, "utf8").replaceAll("\r\n", "\n");
      assert.equal(sha(sql), stage.sha256);
      phase = "finite-basic-sheet-installation"; save();
      await nativeSql(sql, {}, stage.role); steps.push(stage);
      const profile = await nativeJson(fs.readFileSync("supabase/verification/character-basic-sheet-profile.sql", "utf8")) as { checks: Record<string, boolean> };
      assert(Object.values(profile.checks).every(value => value === true), "finite CSJ installation closure failed");
      fs.writeFileSync("/output/basic-sheet-profile.json", JSON.stringify(profile, null, 2) + "\n");
      await nativeSql("NOTIFY pgrst, 'reload schema';");
      // Activate the app adapter only after this exact local overlay is installed.
      server.INKBORNE_BASIC_SHEET_COMMANDS = "true";
      fs.writeFileSync("/run/inkborne/server-env.json", JSON.stringify(server) + "\n", { mode: 0o600 });
    } else assert.equal(source.basicSheetStage, undefined);
    phase = "disposable-auth-accounts"; save();
    const api = JSON.parse(fs.readFileSync("/run/inkborne/api.json", "utf8")) as { anonKey: string; serviceRoleKey: string };
    const client = createClient("http://127.0.0.1:9999", api.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const account = async (label: string) => {
      const email = `${label}-${runtime.runId.slice(0, 8)}@inkborne.invalid`, password = randomBytes(24).toString("hex");
      const result = await client.auth.admin.createUser({ email, password, email_confirm: true, role: "authenticated" });
      assert(!result.error && result.data.user?.id && result.data.user.role === "authenticated", "disposable local Auth provisioning failed; values withheld"); return { id: result.data.user.id, email, password };
    };
    const owner = await account("owner"), other = await account("other");
    let csjFixture: { runId: string; systemId: string; campaignId: string;
      accounts: { owner: typeof owner; dm: typeof owner; member: typeof owner; outsider: typeof owner } } | undefined;
    if (process.env.INKBORNE_TEST_MODE === "csj") {
      phase = "bounded-csj-campaign-fixture"; save();
      const empty = await nativeJson("BEGIN READ ONLY; SELECT jsonb_build_object('campaigns',(SELECT count(*) FROM public.campaigns),'characters',(SELECT count(*) FROM public.characters),'accounts',(SELECT count(*) FROM auth.users)); ROLLBACK;");
      assert.deepEqual(empty, { campaigns: 0, characters: 0, accounts: 2 });
      const dm = await account("dm"), member = await account("member");
      assert.equal(new Set([owner.id, other.id, dm.id, member.id]).size, 4);
      // Only the approved disposable campaign/membership fixture is privileged.
      // Both characters must still be created and completed through the real UI.
      const campaign = await client.from("campaigns").insert({ system_id: system.id, owner_id: dm.id,
        name: `CSJ ${runtime.runId.slice(0, 8)}`, description: "Disposable CSJ-v1 fixture" }).select("id").single();
      assert(!campaign.error && typeof campaign.data?.id === "string", "scratch campaign fixture failed; details withheld");
      const campaignId = campaign.data.id;
      const members = await client.from("campaign_members").insert([
        { campaign_id: campaignId, user_id: owner.id, role: "player" },
        { campaign_id: campaignId, user_id: member.id, role: "player" },
      ]);
      assert(!members.error, "scratch membership fixture failed; details withheld");
      const roster = await client.from("campaign_members").select("user_id,role").eq("campaign_id", campaignId);
      assert(!roster.error && Array.isArray(roster.data), "scratch roster read failed; details withheld");
      assert.deepEqual(roster.data.sort((a, b) => a.user_id.localeCompare(b.user_id)),
        [{ user_id: dm.id, role: "dm" }, { user_id: owner.id, role: "player" }, { user_id: member.id, role: "player" }]
          .sort((a, b) => a.user_id.localeCompare(b.user_id)));
      const counts = await nativeJson("BEGIN READ ONLY; SELECT jsonb_build_object('accounts',(SELECT count(*) FROM auth.users),'campaigns',(SELECT count(*) FROM public.campaigns),'characters',(SELECT count(*) FROM public.characters),'journal',(SELECT count(*) FROM public.character_timeline_events)); ROLLBACK;");
      assert.deepEqual(counts, { accounts: 4, campaigns: 1, characters: 0, journal: 0 });
      csjFixture = { runId: runtime.runId, systemId: system.id, campaignId, accounts: { owner, dm, member, outsider: other } };
    }
    fs.writeFileSync("/run/inkborne/test-config.json", JSON.stringify({ appOrigin: "http://127.0.0.1:3001", supabaseOrigin: "http://127.0.0.1:9999", owner, other, ...api, ...csjFixture }) + "\n", { mode: 0o600, flag: "wx" });
    phase = "authenticated-catalog-read"; save();
    const ownerClient = createClient("http://127.0.0.1:9999", api.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await ownerClient.auth.signInWithPassword({ email: owner.email, password: owner.password });
    assert(!login.error && login.data.user?.id === owner.id, "scratch owner login failed");
    const visibleSystems = await ownerClient.from("game_systems").select("id,name,slug").eq("status", "published").order("name");
    if (visibleSystems.error) fs.writeFileSync("/run/inkborne/readiness.log", JSON.stringify({ status: visibleSystems.status, error: visibleSystems.error }) + "\n", { mode: 0o600 });
    assert(!visibleSystems.error && visibleSystems.data?.length === 1 && visibleSystems.data[0].slug === "dnd-5e-2014", "authenticated catalog read failed; details kept private");
    phase = "ready"; save({ passed: true, catalog, cachedResponses: 1572, freshVersionOneCatalog: true, importProcess,
      currentProfile: after, historicalUpgradeAcceptance: false, authenticatedCatalogRead: true,
      ...(csjFixture ? { currentProfileBoundary: "base-builder-before-finite-CSJ-overlay", basicSheetProfile: "basic-sheet-profile.json" } : {}) });
    console.log(JSON.stringify({ phase, definitions: 1535, snapshots: 1535, accounts: csjFixture ? 4 : 2,
      ...(csjFixture ? { fixtureCampaigns: 1, fixtureCharacters: 0 } : {}) }));
  } catch { save({ passed: false }); throw Error(`scratch bootstrap refused at ${phase}; preserve bootstrap report`); }
}
