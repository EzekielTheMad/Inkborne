// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";

// Reduced-schema, one-connection SQL execution only. The exact native preflight
// must refuse PGlite's SUPERUSER postgres; no role/catalog predicate is replaced.
let dump: Blob, db: PGlite;
const pack = (name: string) => readFileSync(`scripts/character-command-verification/${name}.sql`, "utf8");
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const target = "10000000-0000-4000-8000-000000000003", system = "10000000-0000-4000-8000-000000000005";
beforeAll(async () => {
  const base = new PGlite();
  try {
    await base.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),is_anonymous boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,not_after timestamptz);`);
    await base.exec(readFileSync("supabase/migrations/00001_profiles.sql", "utf8"));
    await base.exec(readFileSync("supabase/migrations/00002_game_systems.sql", "utf8"));
    await base.exec(`CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      system_id uuid NOT NULL REFERENCES public.game_systems(id),campaign_id uuid,name text NOT NULL);`);
    dump = await base.dumpDataDir("gzip");
  } finally { await base.close(); }
}, 30_000);
beforeEach(async () => { db = new PGlite({ loadDataDir: dump }); await db.waitReady; });
afterEach(async () => { await db.close(); });
async function seed() { await db.exec(pack("guard-fixture")); await db.exec(pack("seed")); }
async function counts() {
  return (await db.query(`SELECT (SELECT count(*)::integer FROM auth.users) AS users,
    (SELECT count(*)::integer FROM auth.sessions) AS sessions,(SELECT count(*)::integer FROM public.profiles) AS profiles,
    (SELECT count(*)::integer FROM public.characters) AS characters,(SELECT count(*)::integer FROM public.game_systems) AS systems`)).rows[0];
}

describe("CP1 SQL package in PostgreSQL-WASM; no native/provider acceptance", () => {
  it("reports selected metadata and missing guard without returning fixture user values", async () => {
    const result = (await db.query<{ catalog: Record<string, unknown> }>(pack("catalog"))).rows[0].catalog;
    expect(result).toMatchObject({ catalog_version: 1, status: "complete", current_role: "postgres" });
    expect(result.relations).toContainEqual(expect.objectContaining({ schema: "private", table: "character_writer_guard_v1", present: false }));
    expect(result.columns).toContainEqual(expect.objectContaining({ schema: "auth", table: "sessions", column: "not_after", type: "timestamp with time zone" }));
    expect(result.roles).toContainEqual(expect.objectContaining({ role: "postgres", superuser: true }));
    expect(Array.isArray(result.memberships)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("raw_user_meta_data_snapshot");
  });
  it("refuses the actual PGlite superuser instead of pretending native postgres acceptance", async () => {
    await expect(db.exec(pack("preflight"))).rejects.toMatchObject({ code: "P0001", message: "command_fixture_native_postgres_role_drift" });
    expect(await counts()).toEqual({ users: 0, sessions: 0, profiles: 0, characters: 0, systems: 0 });
  });
  it("uses exactly the original guard DDL and singleton statement", async () => {
    const original = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
    const lines = original.split(/\r?\n/).filter(line => line.startsWith("CREATE TABLE private.character_writer_guard_v1(") || line.startsWith("INSERT INTO private.character_writer_guard_v1(singleton)"));
    expect(pack("guard-fixture").replaceAll("\r\n", "\n")).toBe(lines.join("\n") + "\n");
    await db.exec(pack("guard-fixture"));
    expect((await db.query("SELECT * FROM private.character_writer_guard_v1")).rows).toEqual([{ singleton: true, marker: 1 }]);
  });
  it("creates only synthetic roots and relies on the unchanged signup trigger for profiles", async () => {
    await seed();
    expect(await counts()).toEqual({ users: 2, sessions: 2, profiles: 2, characters: 2, systems: 1 });
    expect((await db.query("SELECT display_name FROM public.profiles WHERE id=$1", [actor])).rows[0]).toEqual({ display_name: "Inkborne Auth row fixture actor" });
    await db.exec(pack("fixture-cleanup"));
    expect(await counts()).toEqual({ users: 0, sessions: 0, profiles: 0, characters: 0, systems: 0 });
  });
  it("refuses missing original profile-trigger behavior and rolls the whole seed back", async () => {
    await db.exec("DROP TRIGGER on_auth_user_created ON auth.users"); await db.exec(pack("guard-fixture"));
    await expect(db.exec(pack("seed"))).rejects.toMatchObject({ message: "command_fixture_original_profile_trigger_failed" });
    await db.exec("ROLLBACK");
    expect(await counts()).toEqual({ users: 0, sessions: 0, profiles: 0, characters: 0, systems: 0 });
  });
  it("refuses a reserved ID used in the wrong owned relation before any seed insert", async () => {
    await db.exec(pack("guard-fixture"));
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [target]);
    await expect(db.exec(pack("seed"))).rejects.toMatchObject({ message: "command_fixture_reserved_identity_collision" });
    await db.exec("ROLLBACK"); expect((await counts()).users).toBe(1); expect((await counts()).systems).toBe(0);
  });
  it("never removes unrelated roots during fixture cleanup", async () => {
    await seed(); const unrelated = "20000000-0000-4000-8000-000000000001";
    await db.query("INSERT INTO auth.users(id) VALUES($1)", [unrelated]);
    await db.exec(pack("fixture-cleanup"));
    expect(await counts()).toEqual({ users: 1, sessions: 0, profiles: 1, characters: 0, systems: 0 });
  });
  it("refuses an unknown inbound reference before deleting any fixture rows", async () => {
    await seed();
    await db.exec("CREATE TABLE public.fixture_extra(parent uuid REFERENCES auth.users(id) ON DELETE CASCADE)");
    await db.query("INSERT INTO public.fixture_extra VALUES($1)", [actor]);
    await expect(db.exec(pack("fixture-cleanup"))).rejects.toMatchObject({ message: "command_fixture_cleanup_foreign_reference" });
    await db.exec("ROLLBACK"); expect((await counts()).users).toBe(2); expect((await counts()).characters).toBe(2);
  });
  it("refuses changed root identity rather than cleaning a different user's row", async () => {
    await seed(); await db.query("UPDATE public.characters SET name='Other identity' WHERE id=$1", [target]);
    await expect(db.exec(pack("fixture-cleanup"))).rejects.toMatchObject({ message: "command_fixture_cleanup_root_identity_drift" });
    await db.exec("ROLLBACK"); expect((await counts()).characters).toBe(2);
  });
  it("refuses a foreign extra session belonging to an owned actor", async () => {
    await seed();
    await db.query("INSERT INTO auth.sessions(id,user_id) VALUES('20000000-0000-4000-8000-000000000002',$1)", [actor]);
    await expect(db.exec(pack("fixture-cleanup"))).rejects.toMatchObject({ message: "command_fixture_cleanup_foreign_reference" });
    await db.exec("ROLLBACK"); expect((await counts()).sessions).toBe(3);
  });
  it("keeps catalog output free of synthetic profile/session contents", async () => {
    await seed(); const catalog = (await db.query<{ catalog: unknown }>(pack("catalog"))).rows[0].catalog;
    expect(JSON.stringify(catalog)).not.toContain("Inkborne Auth row fixture actor");
    expect(JSON.stringify(catalog)).not.toContain(session); expect(JSON.stringify(catalog)).not.toContain(system);
  });
});
