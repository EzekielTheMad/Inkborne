// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Single-connection PostgreSQL-WASM characterization of the unchanged new SQL.
// Auth tables are deliberately reduced typed fixtures, sourced from Auth2.196.0
// commit0204331ca41a5b49f076b6fa3dc6c0d20b996590. No actual Auth provider,
// native multi-connection lock waits, configured-session validity or save issuer.
const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001";
const session = "10000000-0000-4000-8000-000000000002";
const target = "10000000-0000-4000-8000-000000000003";
const foreign = "10000000-0000-4000-8000-000000000004";
const missing = "10000000-0000-4000-8000-000000000005";
const authority = readFileSync("supabase/staged/hit-die-authority-and-writers.sql", "utf8");
const producer = readFileSync("supabase/staged/class-origin-producer.sql", "utf8");
const stage = readFileSync("supabase/staged/character-command-row-locks.sql", "utf8");
const expiry = () => new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000).toISOString().replace(".000Z", ".000000Z");
const context = () => ({ context_version: 1, actor_id: owner, session_id: session, jwt_expires_at: expiry() });

function originalFunction(sql: string, name: string) {
  const start = sql.indexOf(`CREATE FUNCTION ${name}(`);
  const delimiter = sql.indexOf("AS $$", start), end = sql.indexOf("$$;", delimiter + 5);
  if (start < 0 || delimiter < 0 || end < 0) throw new Error(`Missing original ${name}`);
  return sql.slice(start, end + 3);
}
function originalTable(sql: string, name: string) {
  const pattern = new RegExp(`CREATE TABLE ${name.replaceAll(".", "\\.")}\\s*\\(`, "i");
  const start = sql.search(pattern), end = sql.indexOf(";", start);
  if (start < 0 || end < 0) throw new Error(`Missing original ${name}`);
  return sql.slice(start, end + 1);
}
const query = (value: unknown = context(), character: string | null = target) =>
  db.query("SELECT private.lock_character_command_rows_v1($1::jsonb,$2::uuid)", [value, character]);

async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const relation of ["auth.users", "auth.sessions", "public.profiles", "public.characters", "private.character_writer_guard_v1"]) {
    result[relation] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM ${relation} r`)).rows;
  }
  return result;
}
async function refuses(value: unknown = context(), character: string | null = target) {
  const before = await snapshot();
  await db.exec("SAVEPOINT refusal");
  await expect(query(value, character)).rejects.toMatchObject({ code: "P0001", message: "character_command_rows_unavailable" });
  await db.exec("ROLLBACK TO SAVEPOINT refusal; RELEASE SAVEPOINT refusal");
  expect(await snapshot()).toEqual(before); // Fixture recovery, not phase/race proof.
}

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),
      is_anonymous boolean NOT NULL DEFAULT false,banned_until timestamptz,deleted_at timestamptz);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      not_after timestamptz,created_at timestamptz,updated_at timestamptz,refreshed_at timestamp without time zone);`);
  await db.exec(originalTable(readFileSync("supabase/migrations/00001_profiles.sql", "utf8"), "public.profiles"));
  await db.exec(`CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT 'Untouched',choices jsonb NOT NULL DEFAULT '{}',state jsonb NOT NULL DEFAULT '{}',action_revision bigint NOT NULL DEFAULT 0)`);
  await db.exec(originalTable(authority, "private.character_writer_guard_v1"));
  for (const [source, name] of [[authority, "private.require_verified_hit_die_auth_v1"], [producer, "private.require_class_origin_auth_v1"]]) {
    await db.exec(originalFunction(source, name));
  }
  await db.exec(stage);
}, 30_000);
beforeEach(async () => {
  await db.exec("BEGIN");
  await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated'),($2,'authenticated','authenticated')", [owner, foreign]);
  await db.query("INSERT INTO auth.sessions(id,user_id,created_at,refreshed_at) VALUES($1,$2,now(),now() AT TIME ZONE 'UTC')", [session, owner]);
  await db.query("INSERT INTO public.profiles(id) VALUES($1),($2)", [owner, foreign]);
  await db.query("INSERT INTO public.characters(id,user_id,state,choices) VALUES($1,$2,'{\"opaque\":[2,1]}','{\"unrelated\":true}')", [target, owner]);
  await db.exec("INSERT INTO private.character_writer_guard_v1(singleton) VALUES(true)");
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db.close(); });

describe("closed character-command database row checks", () => {
  it("checks the owned rows without changing any table or returning Auth data", async () => {
    const before = await snapshot();
    const result = await query();
    expect(result.rows).toEqual([{ lock_character_command_rows_v1: "" }]);
    expect(await snapshot()).toEqual(before);
  });

  it("allows an expired finite ban and an unexpired explicit session deadline", async () => {
    await db.exec("UPDATE auth.users SET banned_until=clock_timestamp()-interval '1 second'; UPDATE auth.sessions SET not_after=clock_timestamp()+interval '1 hour'");
    await expect(query()).resolves.toBeDefined();
  });

  it("can check the same rows twice in one transaction without advancing revision", async () => {
    const before = await snapshot();
    await query(); await query();
    expect(await snapshot()).toEqual(before);
  });

  it("retains UTC context correspondence under another session timezone and DateStyle", async () => {
    await db.exec("SET LOCAL TimeZone='Pacific/Honolulu'; SET LOCAL DateStyle='SQL, DMY'");
    await expect(query()).resolves.toBeDefined();
  });

  it("does not admit an existing nil target merely because the UUID type permits it", async () => {
    const nil = "00000000-0000-0000-0000-000000000000";
    await db.query("INSERT INTO public.characters(id,user_id) VALUES($1,$2)", [nil, owner]);
    await refuses(context(), nil);
  });

  it.each([null, [], {}, { ...context(), actor_id: foreign }, { ...context(), session_id: missing },
    { ...context(), context_version: "1" }, { ...context(), extra: true },
    { ...context(), actor_id: "10000000-0000-0000-0000-000000000001" },
    { ...context(), actor_id: "00000000-0000-0000-0000-000000000000" },
    { ...context(), session_id: "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF" },
    { ...context(), jwt_expires_at: "9999-02-30T00:00:00.000000Z" },
    { ...context(), jwt_expires_at: "0000-01-01T00:00:00.000000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:60.000000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.123456Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.000Z" },
    { ...context(), jwt_expires_at: "9999-12-31T23:59:59.000000+00:00" },
    { ...context(), jwt_expires_at: "infinity" }, { ...context(), jwt_expires_at: 123 },
    { ...context(), jwt_expires_at: "2000-01-01T00:00:00.000000Z" },
    { ...context(), extra: "x".repeat(2048) },
  ])("refuses unsupported context or row correspondence %#", async value => { await refuses(value); });

  it.each([null, missing, "00000000-0000-0000-0000-000000000000"])("does not disclose missing/unsupported target %s", async id => {
    await refuses(context(), id);
  });

  it.each([
    "UPDATE auth.users SET aud='another-audience' WHERE id=$1",
    "UPDATE auth.users SET aud=NULL WHERE id=$1",
    "UPDATE auth.users SET role='service_role' WHERE id=$1",
    "UPDATE auth.users SET role=NULL WHERE id=$1",
    "UPDATE auth.users SET is_anonymous=true WHERE id=$1",
    "UPDATE auth.users SET deleted_at=clock_timestamp() WHERE id=$1",
    "UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour' WHERE id=$1",
    "UPDATE auth.users SET banned_until='infinity' WHERE id=$1",
    "UPDATE auth.users SET banned_until='-infinity' WHERE id=$1",
    "UPDATE auth.users SET banned_until='0001-01-01 BC' WHERE id=$1",
    "UPDATE auth.users SET banned_until='10000-01-01' WHERE id=$1",
  ])("refuses unavailable user status %#", async sql => { await db.query(sql, [owner]); await refuses(); });

  it.each([
    "UPDATE auth.sessions SET user_id=$2 WHERE id=$1",
    "UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id=$1",
    "UPDATE auth.sessions SET not_after=transaction_timestamp() WHERE id=$1",
    "UPDATE auth.sessions SET not_after='infinity' WHERE id=$1",
    "UPDATE auth.sessions SET not_after='-infinity' WHERE id=$1",
    "UPDATE auth.sessions SET not_after='10000-01-01' WHERE id=$1",
    "DELETE FROM auth.sessions WHERE id=$1",
  ])("refuses unavailable or mismatched session %#", async sql => {
    // Each SQL command receives exactly its own placeholders.
    await db.query(sql, sql.includes("$2") ? [session, foreign] : [session]); await refuses();
  });

  it.each(["DELETE FROM auth.users WHERE id=$1", "DELETE FROM public.profiles WHERE id=$1"])("requires the current user and profile %#", async sql => {
    await db.query(sql, [owner]); await refuses();
  });
  it("requires the existing mechanical writer guard", async () => { await db.exec("DELETE FROM private.character_writer_guard_v1"); await refuses(); });
  it("checks current ownership even when the same target used to belong to the actor", async () => {
    await db.query("UPDATE public.characters SET user_id=$1 WHERE id=$2", [foreign, target]); await refuses();
  });
  it("does not treat a prior successful row check as later ownership authority", async () => {
    await query();
    await db.query("UPDATE public.characters SET user_id=$1 WHERE id=$2", [foreign, target]);
    await refuses();
  });
  it("does not treat a prior row check as later session authority", async () => {
    await query(); await db.query("DELETE FROM auth.sessions WHERE id=$1", [session]); await refuses();
  });

  it("still refuses both original production Auth seams after successful row checks", async () => {
    await query();
    for (const name of ["private.require_verified_hit_die_auth_v1", "private.require_class_origin_auth_v1"]) {
      await db.exec("SAVEPOINT auth_refusal");
      await expect(db.query(`SELECT ${name}($1)`, [context()])).rejects.toMatchObject({ code: "P0001", message: "auth_unavailable" });
      await db.exec("ROLLBACK TO SAVEPOINT auth_refusal; RELEASE SAVEPOINT auth_refusal");
    }
  });

  it.each([null, "infinity", "-infinity", "0001-01-01 BC", "10000-01-01", "2000-01-01"])(
    "refuses unsupported or expired native clock deadline %s", async deadline => {
      await db.exec("SAVEPOINT clock_refusal");
      await expect(db.query("SELECT private.check_character_command_clock_v1($1::timestamptz)", [deadline]))
        .rejects.toMatchObject({ code: "P0001", message: "character_command_rows_unavailable" });
      await db.exec("ROLLBACK TO SAVEPOINT clock_refusal; RELEASE SAVEPOINT clock_refusal");
    },
  );
  it("refuses the native instant supplied at evaluation rather than transaction-start expiry", async () => {
    await db.exec("SAVEPOINT clock_refusal");
    await expect(db.query("SELECT private.check_character_command_clock_v1(clock_timestamp())"))
      .rejects.toMatchObject({ code: "P0001", message: "character_command_rows_unavailable" });
    await db.exec("ROLLBACK TO SAVEPOINT clock_refusal; RELEASE SAVEPOINT clock_refusal");
  });
  it("returns a fresh native microsecond clock only below a supported future deadline", async () => {
    const result = await db.query<{ supported: boolean; fresh: boolean }>(`SELECT
      private.check_character_command_clock_v1('9999-12-31T23:59:59Z') < '9999-12-31T23:59:59Z'::timestamptz AS supported,
      private.check_character_command_clock_v1(clock_timestamp()+interval '1 hour') >= transaction_timestamp() AS fresh`);
    expect(result.rows[0]).toEqual({ supported: true, fresh: true });
  });

  it("has no API execution grant, definer elevation or mutable search path", async () => {
    const details = (await db.query<{ owner: string; definer: boolean; volatility: string; settings: string[] }>(`SELECT pg_get_userbyid(proowner) AS owner,
      prosecdef AS definer,provolatile AS volatility,proconfig AS settings FROM pg_proc WHERE oid='private.lock_character_command_rows_v1(jsonb,uuid)'::regprocedure`)).rows[0];
    expect(details).toEqual({ owner: "postgres", definer: false, volatility: "v", settings: ['search_path=""'] });
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.lock_character_command_rows_v1(jsonb,uuid)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
      await db.exec(`SAVEPOINT api_refusal; SET LOCAL ROLE ${role}`);
      await expect(query()).rejects.toMatchObject({ code: "42501" });
      await db.exec("ROLLBACK TO SAVEPOINT api_refusal; RELEASE SAVEPOINT api_refusal");
      expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege($1,'private.check_character_command_clock_v1(timestamptz)','EXECUTE') AS allowed", [role])).rows[0].allowed).toBe(false);
    }
  });
});
