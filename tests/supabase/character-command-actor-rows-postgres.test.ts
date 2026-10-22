// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Reduced synthetic Auth schema, original signup/profile SQL and unchanged v1
// functions in one privileged PostgreSQL-WASM connection. No native waits,
// provider HTTP/JWT/configuration, runtime-role RLS or genuine bootstrap proof.
let dump: Blob, db: PGlite, originalDependencies: unknown;
const actor = "10000000-0000-4000-8000-000000000001";
const session = "10000000-0000-4000-8000-000000000002";
const foreign = "10000000-0000-4000-8000-000000000004";
const missing = "10000000-0000-4000-8000-000000000005";
const stage = readFileSync("supabase/staged/character-command-actor-rows.sql", "utf8").replaceAll("\r\n", "\n");
const rowStage = readFileSync("supabase/staged/character-command-row-locks.sql", "utf8").replaceAll("\r\n", "\n");
const context = () => ({ context_version: 1, actor_id: actor, session_id: session,
  jwt_expires_at: new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000).toISOString().replace(".000Z", ".000000Z") });

function originalFunction(source: string, name: string) {
  const start = source.indexOf(`CREATE FUNCTION ${name}(`);
  const open = source.indexOf("AS $$", start), close = source.indexOf("$$;", open + 5);
  if (start < 0 || open < 0 || close < 0) throw Error(`Missing original ${name}`);
  return source.slice(start, close + 3);
}
const dependencies = (connection: PGlite) => connection.query(`SELECT oid::regprocedure::text AS signature,
  pg_get_userbyid(proowner) AS owner,prosecdef,provolatile,proconfig,prosrc,proacl::text AS acl
  FROM pg_proc WHERE oid IN ('private.check_character_command_clock_v1(timestamptz)'::regprocedure,
    'private.lock_character_command_rows_v1(jsonb,uuid)'::regprocedure) ORDER BY oid::regprocedure::text`);
const query = (value: unknown = context()) => db.query<{ deadline: string }>(`SELECT
  to_char(private.lock_character_command_actor_rows_v1($1::jsonb) AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS deadline`, [value]);
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const relation of ["auth.users", "auth.sessions", "public.profiles"]) {
    result[relation] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') AS rows FROM ${relation} r`)).rows;
  }
  return result;
}
async function refuses(value: unknown = context()) {
  const before = await snapshot();
  await db.exec("SAVEPOINT actor_refusal");
  await expect(query(value)).rejects.toMatchObject({ code: "P0001", message: "character_command_rows_unavailable" });
  await db.exec("ROLLBACK TO SAVEPOINT actor_refusal; RELEASE SAVEPOINT actor_refusal");
  expect(await snapshot()).toEqual(before); // Fixture recovery, not native failure-phase proof.
}

beforeAll(async () => {
  const base = new PGlite();
  try {
    await base.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),
        is_anonymous boolean NOT NULL DEFAULT false,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        not_after timestamptz);`);
    await base.exec(readFileSync("supabase/migrations/00001_profiles.sql", "utf8"));
    // The accepted wrapper is installed unchanged but not used as a prefix.
    // Neither a character relation nor a writer guard exists in this fixture.
    await base.exec(rowStage);
    for (const [file, name] of [["hit-die-authority-and-writers", "private.require_verified_hit_die_auth_v1"],
      ["class-origin-producer", "private.require_class_origin_auth_v1"]]) {
      await base.exec(originalFunction(readFileSync(`supabase/staged/${file}.sql`, "utf8"), name));
    }
    originalDependencies = (await dependencies(base)).rows;
    dump = await base.dumpDataDir("gzip");
  } finally { await base.close(); }
}, 30_000);
beforeEach(async () => {
  db = new PGlite({ loadDataDir: dump }); await db.waitReady;
  await db.exec(stage);
  await db.exec("BEGIN");
  await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated'),($2,'authenticated','authenticated')", [actor, foreign]);
  await db.query("INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)", [session, actor]);
});
afterEach(async () => { await db.exec("ROLLBACK"); await db.close(); });

describe("closed actor row prefix; offline characterization only", () => {
  it("works before a character or mechanical guard exists and returns only the exact input deadline", async () => {
    expect((await db.query("SELECT to_regclass('public.characters') AS characters,to_regclass('private.character_writer_guard_v1') AS guard")).rows)
      .toEqual([{ characters: null, guard: null }]);
    const before = await snapshot(), value = context();
    expect((await query(value)).rows).toEqual([{ deadline: value.jwt_expires_at }]);
    expect(await snapshot()).toEqual(before);
  });
  it("leaves the accepted clock and owned-target wrapper byte-identical", async () => {
    expect((await dependencies(db)).rows).toEqual(originalDependencies);
    await query();
    expect((await dependencies(db)).rows).toEqual(originalDependencies);
  });
  it("uses the original signup-created profile and supports repeated prefix checks in one transaction", async () => {
    expect((await db.query("SELECT count(*)::integer AS profiles FROM public.profiles")).rows[0]).toEqual({ profiles: 2 });
    const value = context(), before = await snapshot();
    await query(value); await query(value);
    expect(await snapshot()).toEqual(before);
  });
  it("preserves canonical UTC correspondence under a different timezone and DateStyle", async () => {
    await db.exec("SET LOCAL TimeZone='Pacific/Honolulu'; SET LOCAL DateStyle='SQL, DMY'");
    const value = context(); expect((await query(value)).rows[0].deadline).toBe(value.jwt_expires_at);
  });
  it("allows an expired finite ban and a current finite session deadline", async () => {
    await db.exec("UPDATE auth.users SET banned_until=clock_timestamp()-interval '1 second'; UPDATE auth.sessions SET not_after=clock_timestamp()+interval '1 hour'");
    await expect(query()).resolves.toBeDefined();
  });

  it.each([null, [], {}, { ...context(), extra: true }, { ...context(), context_version: "1" },
    { ...context(), actor_id: foreign }, { ...context(), session_id: missing },
    { ...context(), actor_id: "00000000-0000-0000-0000-000000000000" },
    { ...context(), session_id: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
    { ...context(), actor_id: "10000000-0000-0000-0000-000000000001" },
    { ...context(), jwt_expires_at: "9999-02-30T00:00:00.000000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:60.000000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.000000+00:00" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.000001Z" },
    { ...context(), jwt_expires_at: "2000-01-01T00:00:00.000000Z" },
    { ...context(), jwt_expires_at: "infinity" }, { ...context(), actor_id: "x".repeat(2048) },
  ])("retains the existing finite context refusals %#", async value => { await refuses(value); });

  it("refuses a nil actor even with actual matching session/profile rows", async () => {
    const nil = "00000000-0000-0000-0000-000000000000", extraSession = "10000000-0000-4000-8000-000000000009";
    await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated')", [nil]);
    await db.query("INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)", [extraSession, nil]);
    await refuses({ ...context(), actor_id: nil, session_id: extraSession });
  });
  it.each([
    "UPDATE auth.users SET aud=NULL WHERE id=$1", "UPDATE auth.users SET role='service_role' WHERE id=$1",
    "UPDATE auth.users SET is_anonymous=true WHERE id=$1", "UPDATE auth.users SET deleted_at=clock_timestamp() WHERE id=$1",
    "UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1",
    "UPDATE auth.users SET banned_until='infinity' WHERE id=$1",
    "UPDATE auth.users SET banned_until='-infinity' WHERE id=$1",
    "UPDATE auth.users SET banned_until='10000-01-01' WHERE id=$1",
  ])("refuses unavailable current account status %#", async sql => { await db.query(sql, [actor]); await refuses(); });
  it.each([
    "UPDATE auth.sessions SET user_id=$2 WHERE id=$1", "DELETE FROM auth.sessions WHERE id=$1",
    "UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=$1",
    "UPDATE auth.sessions SET not_after=transaction_timestamp() WHERE id=$1",
    "UPDATE auth.sessions SET not_after='infinity' WHERE id=$1",
    "UPDATE auth.sessions SET not_after='-infinity' WHERE id=$1",
    "UPDATE auth.sessions SET not_after='0001-01-01 BC' WHERE id=$1",
  ])("refuses missing/mismatched/expired session rows %#", async sql => {
    await db.query(sql, sql.includes("$2") ? [session, foreign] : [session]); await refuses();
  });
  it.each(["DELETE FROM auth.users WHERE id=$1", "DELETE FROM public.profiles WHERE id=$1"])(
    "requires the current account and profile %#", async sql => { await db.query(sql, [actor]); await refuses(); },
  );
  it.each([
    "UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1",
    "DELETE FROM auth.sessions WHERE user_id=$1", "DELETE FROM public.profiles WHERE id=$1",
  ])("does not cache a previous successful prefix as later authority %#", async sql => {
    await query(); await db.query(sql, [actor]); await refuses();
  });

  it("keeps both original Auth bodies unavailable after a successful row prefix", async () => {
    await query();
    for (const name of ["private.require_verified_hit_die_auth_v1", "private.require_class_origin_auth_v1"]) {
      await db.exec("SAVEPOINT auth_refusal");
      await expect(db.query(`SELECT ${name}($1::jsonb)`, [context()])).rejects.toMatchObject({ code: "P0001", message: "auth_unavailable" });
      await db.exec("ROLLBACK TO SAVEPOINT auth_refusal; RELEASE SAVEPOINT auth_refusal");
    }
  });
  it("is an owner-only scalar invoker function with an empty search path", async () => {
    const details = (await db.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef AS definer,
      provolatile AS volatility,proretset AS returns_set,prorettype::regtype::text AS result,proconfig AS settings
      FROM pg_proc WHERE oid='private.lock_character_command_actor_rows_v1(jsonb)'::regprocedure`)).rows[0];
    expect(details).toEqual({ owner: "postgres", definer: false, volatility: "v", returns_set: false,
      result: "timestamp with time zone", settings: ['search_path=""'] });
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.lock_character_command_actor_rows_v1(jsonb)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
      await db.exec(`SAVEPOINT api_refusal; SET LOCAL ROLE ${role}`);
      await expect(query()).rejects.toMatchObject({ code: "42501" });
      await db.exec("ROLLBACK TO SAVEPOINT api_refusal; RELEASE SAVEPOINT api_refusal");
    }
  });

  it("refuses changed dependency security metadata without installing an alternative prefix", async () => {
    await db.exec("ROLLBACK; DROP FUNCTION private.lock_character_command_actor_rows_v1(jsonb); ALTER FUNCTION private.check_character_command_clock_v1(timestamptz) SECURITY DEFINER");
    await expect(db.exec(stage)).rejects.toMatchObject({ code: "42501", message: "character_command_actor_rows_prerequisite_unavailable" });
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT to_regprocedure('private.lock_character_command_actor_rows_v1(jsonb)') AS prefix")).rows[0]).toEqual({ prefix: null });
  });
  it("refuses selected Auth schema drift before creating the prefix", async () => {
    await db.exec("ROLLBACK; DROP FUNCTION private.lock_character_command_actor_rows_v1(jsonb); ALTER TABLE auth.sessions ALTER COLUMN user_id DROP NOT NULL");
    await expect(db.exec(stage)).rejects.toMatchObject({ code: "42501", message: "character_command_actor_rows_prerequisite_unavailable" });
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT to_regprocedure('private.lock_character_command_actor_rows_v1(jsonb)') AS prefix")).rows[0]).toEqual({ prefix: null });
  });
  it("rejects unexpected private default EXECUTE grants atomically", async () => {
    await db.exec(`ROLLBACK; DROP FUNCTION private.lock_character_command_actor_rows_v1(jsonb);
      CREATE ROLE fixture_actor_lock_extra;
      ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO fixture_actor_lock_extra`);
    await expect(db.exec(stage)).rejects.toMatchObject({ code: "42501", message: "character_command_actor_rows_unexpected_default_acl" });
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT to_regprocedure('private.lock_character_command_actor_rows_v1(jsonb)') AS prefix")).rows[0]).toEqual({ prefix: null });
  });
  it("does not replace a preexisting prefix or retain its caller ACLs", async () => {
    await db.exec("ROLLBACK");
    const before = (await db.query("SELECT pg_get_functiondef('private.lock_character_command_actor_rows_v1(jsonb)'::regprocedure) AS definition")).rows;
    await expect(db.exec(stage)).rejects.toMatchObject({ code: "42723" });
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT pg_get_functiondef('private.lock_character_command_actor_rows_v1(jsonb)'::regprocedure) AS definition")).rows).toEqual(before);
  });
});
