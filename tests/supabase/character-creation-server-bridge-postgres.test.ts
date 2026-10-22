// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Offline ACL/nested-mode/refusal characterization. Reduced Auth schema and
// selected original DDL/functions; no positive Auth stand-in, native contention,
// provider/API execution, genuine bootstrap or installed production claim.
const stage = readFileSync("supabase/staged/character-creation-server-bridge.sql", "utf8").replaceAll("\r\n", "\n");
const producer = readFileSync("supabase/staged/class-origin-producer.sql", "utf8");
const bootstrap = readFileSync("supabase/staged/class-origin-fresh-bootstrap.sql", "utf8");
const gateway = "inkborne_character_command_gateway_owner";
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const operation = "10000000-0000-4000-8000-000000000003", system = "10000000-0000-4000-8000-000000000004";
const context = () => ({ context_version: 1, actor_id: actor, session_id: session,
  jwt_expires_at: new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000).toISOString().replace(".000Z", ".000000Z") });
const intent = () => ({ contract_version: 1, operation_id: operation, command: "create_character",
  fields: { name: "Fixture", system_id: system, campaign_id: null } });
const resolve = () => ({ contract_version: 1, operation_id: operation, command: "resolve_creation" });
let dump: Blob, db: PGlite;
function definition(source: string, name: string) {
  const start = source.indexOf(`CREATE FUNCTION ${name}(`), open = source.indexOf("AS $$", start), end = source.indexOf("$$;", open + 5);
  if (start < 0 || open < 0 || end < 0) throw Error(`Missing original ${name}`);
  return source.slice(start, end + 3);
}
function table(name: string) {
  const start = producer.indexOf(`CREATE TABLE ${name} (`), end = producer.indexOf(";", start);
  if (start < 0 || end < 0) throw Error(`Missing original ${name}`);
  return producer.slice(start, end + 1);
}
const call = (request: unknown = intent(), ctx: unknown = context()) => db.query<{ result: unknown }>(
  "SELECT public.character_creation_command_v1($1::jsonb,$2::jsonb) AS result", [ctx, request]);
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const relation of ["auth.users", "auth.sessions", "public.profiles", "public.characters",
    "private.character_class_origin_v1", "private.character_creation_commands_v1", "private.class_writer_acceptance_v1",
    "private.class_writer_row_transitions_v1"]) result[relation] = (await db.query(`SELECT
      coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM ${relation} r`)).rows;
  return result;
}
async function refused(request: unknown = intent(), ctx: unknown = context(), code = "P0001", message?: string) {
  const before = await snapshot();
  await db.exec("SAVEPOINT bridge_refusal; SET LOCAL ROLE service_role");
  await expect(call(request, ctx)).rejects.toMatchObject({ code, ...(message ? { message } : {}) });
  await db.exec("ROLLBACK TO SAVEPOINT bridge_refusal; RELEASE SAVEPOINT bridge_refusal");
  expect(await snapshot()).toEqual(before); // Fixture recovery, not native atomicity proof.
}
beforeAll(async () => {
  const base = new PGlite();
  try {
    await base.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE ROLE inkborne_class_origin_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEROLE NOCREATEDB NOREPLICATION;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      GRANT USAGE ON SCHEMA public,private TO inkborne_class_origin_owner;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),
        is_anonymous boolean NOT NULL DEFAULT false,deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,not_after timestamptz);
      CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL,system_id uuid NOT NULL,campaign_id uuid,
        name text NOT NULL,visibility text NOT NULL DEFAULT 'private',archived boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),level integer NOT NULL DEFAULT 1,base_stats jsonb NOT NULL DEFAULT '{}',
        choices jsonb NOT NULL DEFAULT '{}',state jsonb NOT NULL DEFAULT '{}',narrative jsonb NOT NULL DEFAULT '{}',
        narrative_rich jsonb NOT NULL DEFAULT '{}',primary_color text,action_revision bigint NOT NULL DEFAULT 0);`);
    await base.exec(readFileSync("supabase/migrations/00001_profiles.sql", "utf8"));
    for (const name of ["private.character_class_origin_v1", "private.character_creation_commands_v1",
      "private.class_writer_acceptance_v1", "private.class_writer_row_transitions_v1"]) await base.exec(table(name));
    await base.exec(readFileSync("supabase/staged/character-command-row-locks.sql", "utf8"));
    await base.exec(readFileSync("supabase/staged/character-command-actor-rows.sql", "utf8"));
    for (const name of ["require_class_origin_auth_v1", "class_origin_exact_keys_v1", "class_origin_uuid_v1"]) {
      await base.exec(definition(producer, `private.${name}`));
    }
    for (const name of ["create_empty_class_origin_character_v1", "resolve_empty_class_origin_creation_v1"]) {
      await base.exec(definition(bootstrap, `private.${name}`));
    }
    // Real nested SECURITY DEFINER owner; no private helper model or table
    // grants are needed before the unchanged real Auth denial executes.
    const signatures = ["require_class_origin_auth_v1(jsonb)", "class_origin_exact_keys_v1(jsonb,text[])",
      "class_origin_uuid_v1(jsonb)", "create_empty_class_origin_character_v1(jsonb,jsonb)",
      "resolve_empty_class_origin_creation_v1(jsonb,uuid)"];
    for (const signature of signatures) await base.exec(`ALTER FUNCTION private.${signature} OWNER TO inkborne_class_origin_owner;
      REVOKE ALL ON FUNCTION private.${signature} FROM PUBLIC,anon,authenticated,service_role`);
    dump = await base.dumpDataDir("gzip");
  } finally { await base.close(); }
}, 30_000);
beforeEach(async () => {
  db = new PGlite({ loadDataDir: dump }); await db.waitReady;
  await db.exec(stage);
  await db.exec("BEGIN");
  await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated')", [actor]);
  await db.query("INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)", [session, actor]);
});
afterEach(async () => { await db.exec("ROLLBACK"); await db.close(); });

describe("staged server creation gateway; offline refusals only", () => {
  it.each(["create", "resolve"])("reaches original %s Auth denial with valid actual actor/session/profile rows", async kind => {
    await refused(kind === "create" ? intent() : resolve(), context(), "P0001", "auth_unavailable");
  });
  it("fails missing session before the original producer", async () => {
    await db.exec("DELETE FROM auth.sessions");
    await refused(intent(), context(), "P0001", "character_command_rows_unavailable");
  });
  it("fails a banned user before the original producer", async () => {
    await db.exec("UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour'");
    await refused(resolve(), context(), "P0001", "character_command_rows_unavailable");
  });
  it("fails malformed caller context even for service_role", async () => {
    await refused(intent(), { ...context(), actor_id: operation }, "P0001", "character_command_rows_unavailable");
  });
  it.each([null, [], {}, { ...intent(), extra: true }, { ...intent(), command: "copy_character" },
    { ...intent(), operation_id: "not-a-uuid" }, { ...intent(), operation_id: "ABCDEF00-0000-4000-8000-000000000003" },
    { ...intent(), fields: { ...intent().fields, campaign_id: actor } },
    { ...intent(), fields: { ...intent().fields, name: " Fixture" } },
    { ...intent(), fields: { ...intent().fields, actor_id: actor } },
    { ...resolve(), fields: {} }, { ...resolve(), operation_id: null },
    { ...intent(), fields: { ...intent().fields, name: "x".repeat(33000) } },
  ])("refuses finite request drift without entering a producer: %j", async request => {
    await db.exec("SET LOCAL ROLE service_role");
    expect((await call(request)).rows).toEqual([{ result: { status: "invalid" } }]);
  });
  it.each(["anon", "authenticated"])("denies public RPC EXECUTE to %s", async role => {
    await db.exec(`SAVEPOINT api_denial; SET LOCAL ROLE ${role}`);
    await expect(call()).rejects.toMatchObject({ code: "42501" });
    await db.exec("ROLLBACK TO SAVEPOINT api_denial; RELEASE SAVEPOINT api_denial");
  });
  it.each(["anon", "authenticated", "service_role"])("gives %s no direct private shim access", async role => {
    expect((await db.query("SELECT has_schema_privilege($1,'private','USAGE') AS usage,has_function_privilege($1,'private.lock_character_command_actor_rows_gateway_v1(jsonb)','EXECUTE') AS execute", [role])).rows)
      .toEqual([{ usage: false, execute: false }]);
  });
  it("uses a table-free NOLOGIN/NOMEMBER/NOBYPASS gateway owner and exact three private capabilities", async () => {
    expect((await db.query(`SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication,
      EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) AS membership
      FROM pg_roles r WHERE rolname=$1`, [gateway])).rows).toEqual([{
      rolcanlogin: false, rolsuper: false, rolbypassrls: false, rolinherit: false,
      rolcreaterole: false, rolcreatedb: false, rolreplication: false, membership: false }]);
    expect((await db.query(`SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='private' AND has_function_privilege($1,p.oid,'EXECUTE') ORDER BY signature`, [gateway])).rows)
      .toEqual(["private.create_empty_class_origin_character_v1(jsonb,jsonb)",
        "private.lock_character_command_actor_rows_gateway_v1(jsonb)",
        "private.resolve_empty_class_origin_creation_v1(jsonb,uuid)"].map(signature => ({ signature })));
    expect((await db.query(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('auth','public','private') AND c.relkind='r'
        AND has_any_column_privilege($1,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')`, [gateway])).rows).toEqual([{ count: 0 }]);
    expect((await db.query("SELECT has_schema_privilege($1,'auth','USAGE') AS usage", [gateway])).rows).toEqual([{ usage: false }]);
  });
  it("pins both new definer boundaries, empty search paths and the sole API execute grant", async () => {
    expect((await db.query(`SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
      p.prosecdef,p.provolatile,p.proconfig FROM pg_proc p WHERE p.oid IN
      ('public.character_creation_command_v1(jsonb,jsonb)'::regprocedure,
       'private.lock_character_command_actor_rows_gateway_v1(jsonb)'::regprocedure) ORDER BY signature`)).rows)
      .toEqual([
        { signature: "character_creation_command_v1(jsonb,jsonb)", owner: gateway, prosecdef: true, provolatile: "v", proconfig: ['search_path=""'] },
        { signature: "private.lock_character_command_actor_rows_gateway_v1(jsonb)", owner: "postgres", prosecdef: true, provolatile: "v", proconfig: ['search_path=""'] },
      ]);
    expect((await db.query(`SELECT role_name,has_function_privilege(role_name,
      'public.character_creation_command_v1(jsonb,jsonb)','EXECUTE') AS execute
      FROM unnest(ARRAY['anon','authenticated','service_role']) AS roles(role_name) ORDER BY role_name`)).rows)
      .toEqual([{ role_name: "anon", execute: false }, { role_name: "authenticated", execute: false }, { role_name: "service_role", execute: true }]);
  });
  it("cannot call the closed invoker actor prefix directly even as gateway owner", async () => {
    await db.exec(`SAVEPOINT direct_prefix; SET LOCAL ROLE ${gateway}`);
    await expect(db.query("SELECT private.lock_character_command_actor_rows_v1($1)", [context()])).rejects.toMatchObject({ code: "42501" });
    await db.exec("ROLLBACK TO SAVEPOINT direct_prefix; RELEASE SAVEPOINT direct_prefix");
  });
  it("keeps nested existing definition bodies byte-identical and checked definer ownership", async () => {
    const before = (await db.query(`SELECT oid::regprocedure::text AS signature,prosrc,prosecdef,pg_get_userbyid(proowner) AS owner
      FROM pg_proc WHERE oid IN ('private.create_empty_class_origin_character_v1(jsonb,jsonb)'::regprocedure,
        'private.resolve_empty_class_origin_creation_v1(jsonb,uuid)'::regprocedure) ORDER BY signature`)).rows;
    await refused();
    expect((await db.query(`SELECT oid::regprocedure::text AS signature,prosrc,prosecdef,pg_get_userbyid(proowner) AS owner
      FROM pg_proc WHERE oid IN ('private.create_empty_class_origin_character_v1(jsonb,jsonb)'::regprocedure,
        'private.resolve_empty_class_origin_creation_v1(jsonb,uuid)'::regprocedure) ORDER BY signature`)).rows).toEqual(before);
    expect(before).toEqual(expect.arrayContaining([expect.objectContaining({ prosecdef: true, owner: "inkborne_class_origin_owner" })]));
  });
});

describe("installation rejects changed authority/default privileges", () => {
  async function removeBridge() {
    await db.exec(`ROLLBACK; DROP FUNCTION public.character_creation_command_v1(jsonb,jsonb);
      DROP FUNCTION private.lock_character_command_actor_rows_gateway_v1(jsonb);
      DROP OWNED BY ${gateway}; DROP ROLE ${gateway};`);
  }
  async function installationRefuses() {
    await expect(db.exec(stage)).rejects.toMatchObject({ code: "42501" });
    await db.exec("ROLLBACK");
    expect((await db.query("SELECT to_regprocedure('public.character_creation_command_v1(jsonb,jsonb)') AS rpc,(SELECT count(*)::int FROM pg_roles WHERE rolname=$1) AS roles", [gateway])).rows)
      .toEqual([{ rpc: null, roles: 0 }]);
  }
  it("rejects an INVOKER create callee, rather than fixing missing table privileges", async () => {
    await removeBridge();
    await db.exec("ALTER FUNCTION private.create_empty_class_origin_character_v1(jsonb,jsonb) SECURITY INVOKER");
    await installationRefuses();
  });
  it("rejects broad private schema access already held by service_role", async () => {
    await removeBridge(); await db.exec("GRANT USAGE ON SCHEMA private TO service_role");
    await installationRefuses();
  });
  it("atomically rejects an unexpected inherited default EXECUTE grant", async () => {
    await removeBridge(); await db.exec("CREATE ROLE fixture_extra; ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO fixture_extra");
    await installationRefuses();
  });
});
