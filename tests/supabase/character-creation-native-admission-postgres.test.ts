// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { classOriginGraphSchema, classOriginReceiptSchema } from "@/lib/character/class-origin-command-schema";

// Offline genuine ROW bootstrap, not genuine provider/JWT acceptance. Synthetic
// selected Auth rows; full original kernel/authority/producer, original signup/profile
// and system DDL, selected original bootstrap functions and original
// bootstrap capability tail. The original bootstrap INSTALLER preflight and
// unrelated joint/confirmation stages are not modeled here. Real immediate and
// deferred journal/row/finalizer guards run unchanged; none are replaced.
// SUPER postgres installs; actual execution enters service_role -> table-free
// gateway -> original nonSUPER/NOBYPASS class/authority owners -> postgres row
// shim. Native installer/provider/concurrency/production RLS remain separate.
const read = (file: string) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const producer = read("supabase/staged/class-origin-producer.sql");
const bootstrap = read("supabase/staged/class-origin-fresh-bootstrap.sql");
const kernel = read("supabase/staged/hit-die-transaction.sql");
const overlay = read("supabase/staged/character-creation-native-admission.sql");
const actor = "10000000-0000-4000-8000-000000000001", session = "10000000-0000-4000-8000-000000000002";
const operation = "10000000-0000-4000-8000-000000000003", system = "10000000-0000-4000-8000-000000000004";
const other = "10000000-0000-4000-8000-000000000005";
type Receipt = { operation_id: string; target_character_id: string; verified_actor_id: string; [key: string]: unknown };
type Result = { status: string; receipt?: Receipt };
let dump: Blob, db: PGlite;
function definition(sql: string, name: string) {
  const start = sql.indexOf(`CREATE FUNCTION private.${name}(`), open = sql.indexOf("AS $$", start), end = sql.indexOf("$$;", open + 5);
  if (start < 0 || open < 0 || end < 0) throw Error(`Missing original ${name}`);
  return sql.slice(start, end + 3);
}
const context = () => ({ context_version: 1, actor_id: actor, session_id: session,
  jwt_expires_at: new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000).toISOString().replace(".000Z", ".000000Z") });
const intent = () => ({ contract_version: 1, command: "create_character", operation_id: operation,
  fields: { name: "Actual fixture creation", system_id: system, campaign_id: null } });
const resolve = () => ({ contract_version: 1, command: "resolve_creation", operation_id: operation });
async function call(request: unknown = intent(), ctx: unknown = context()): Promise<Result> {
  await db.exec("SET LOCAL ROLE service_role");
  const result = (await db.query<{ result: Result }>("SELECT public.character_creation_command_v1($1::jsonb,$2::jsonb) AS result", [ctx, request])).rows[0].result;
  await db.exec("RESET ROLE"); return result;
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const relation of ["public.characters", "private.character_class_origin_v1", "private.character_creation_commands_v1",
    "private.character_projection_order_v1", "private.class_writer_acceptance_v1", "private.class_writer_row_transitions_v1",
    "public.character_content_refs", "public.character_inventory", "public.character_spells", "public.character_feature_grants", "public.character_spell_grants",
    "private.character_action_receipts", "public.character_rolls"]) {
    result[relation] = (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM ${relation} r`)).rows;
  }
  return result;
}
async function refusal(request: unknown, ctx: unknown, code: string, message?: string) {
  const before = await snapshot(); await db.exec("SAVEPOINT creation_refusal");
  await expect(call(request, ctx)).rejects.toMatchObject({ code, ...(message ? { message } : {}) });
  await db.exec("ROLLBACK TO SAVEPOINT creation_refusal; RELEASE SAVEPOINT creation_refusal");
  expect(await snapshot()).toEqual(before); // Savepoint fixture recovery only.
}
beforeAll(async () => {
  const base = new PGlite();
  let installPhase = "reduced native fixture";
  try {
    await base.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),is_anonymous boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,not_after timestamptz);
      CREATE TABLE public.characters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,system_id uuid NOT NULL,
        campaign_id uuid,name text NOT NULL,visibility text NOT NULL DEFAULT 'private',archived boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),level integer NOT NULL DEFAULT 1,base_stats jsonb NOT NULL DEFAULT '{}',
        choices jsonb NOT NULL DEFAULT '{}',state jsonb NOT NULL DEFAULT '{}',narrative jsonb NOT NULL DEFAULT '{}',
        narrative_rich jsonb NOT NULL DEFAULT '{}',primary_color text);
      CREATE TABLE public.character_rolls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters,
        user_id uuid,kind text,label text,expression text,result jsonb,total integer,rolled_at timestamptz DEFAULT now());
      CREATE TABLE public.campaigns(id uuid PRIMARY KEY,system_id uuid); CREATE TABLE public.campaign_members(id uuid PRIMARY KEY,campaign_id uuid,user_id uuid);
      CREATE TABLE public.content_shares(id uuid PRIMARY KEY,content_id uuid,campaign_id uuid);
      CREATE TABLE public.content_definitions(id uuid PRIMARY KEY);
      CREATE TABLE public.content_versions(content_id uuid,version integer,system_id_snapshot uuid,content_type_snapshot text,
        slug_snapshot text,name_snapshot text,scope_snapshot text,source_snapshot text,owner_id_snapshot uuid,
        data_snapshot jsonb,effects_snapshot jsonb,created_at timestamptz,unparsed_snapshot jsonb,PRIMARY KEY(content_id,version));
      CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters,content_id uuid,content_version integer,
        context jsonb,choice_source text,created_at timestamptz,feature_grant_id uuid);
      CREATE TABLE public.character_inventory(id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters,content_id uuid,content_version integer);
      CREATE TABLE public.character_spells(id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters,content_id uuid,content_version integer);
      CREATE TABLE public.character_feature_grants(id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters,feature_content_id uuid,feature_version integer);
      CREATE TABLE public.character_spell_grants(id uuid PRIMARY KEY,character_id uuid REFERENCES public.characters,spell_content_id uuid,spell_version integer);`);
    await base.exec(read("supabase/migrations/00001_profiles.sql"));
    await base.exec(read("supabase/migrations/00002_game_systems.sql"));
    for (const relation of ["characters", "campaigns", "campaign_members", "content_shares", "content_definitions", "content_versions",
      "character_content_refs", "character_inventory", "character_spells", "character_feature_grants", "character_spell_grants", "character_rolls"]) {
      await base.exec(`ALTER TABLE public.${relation} ENABLE ROW LEVEL SECURITY`);
    }
    // Complete original kernel supplies all three public compatibility wrappers
    // that the authority stage revokes, its real receipt/gate/roll guards, and
    // the native action_revision ALTER. No positive stand-in is installed.
    installPhase = "complete original kernel";
    await base.exec(kernel);
    installPhase = "complete original authority";
    await base.exec(read("supabase/staged/hit-die-authority-and-writers.sql"));
    installPhase = "complete original class producer";
    await base.exec(producer);
    const originals = [
      ["class_origin_empty_parent_allowed_v1", "public.characters", "inkborne_class_origin_owner"],
      ["class_origin_empty_order_allowed_v1", "private.character_projection_order_v1", "inkborne_class_origin_owner"],
      ["class_origin_empty_order_inputs_v1", "uuid", "inkborne_class_origin_owner"],
      ["class_bootstrap_verified_prefix_v1", "jsonb", "inkborne_hit_die_authority_owner"],
      ["lock_class_bootstrap_system_v1", "jsonb,uuid", "inkborne_hit_die_authority_owner"],
      ["initialize_empty_class_order_v1", "uuid", "inkborne_hit_die_authority_owner"],
      ["create_empty_class_origin_character_v1", "jsonb,jsonb", "inkborne_class_origin_owner"],
      ["resolve_empty_class_origin_creation_v1", "jsonb,uuid", "inkborne_class_origin_owner"],
    ];
    await base.exec("BEGIN");
    for (const [name, args, owner] of originals) {
      installPhase = `original bootstrap ${name}`;
      await base.exec(`${definition(bootstrap, name)} ALTER FUNCTION private.${name}(${args}) OWNER TO ${owner}`);
    }
    // Original capability closure, not a simplified RLS substitute. Its final
    // COMMIT completes this fixture install; original preflight is not claimed.
    installPhase = "original bootstrap capability tail";
    await base.exec(bootstrap.slice(bootstrap.indexOf("-- 4. Narrow capability closure")));
    installPhase = "row checks";
    await base.exec(read("supabase/staged/character-command-row-locks.sql"));
    installPhase = "actor prefix";
    await base.exec(read("supabase/staged/character-command-actor-rows.sql"));
    installPhase = "creation gateway";
    await base.exec(read("supabase/staged/character-creation-server-bridge.sql"));
    dump = await base.dumpDataDir("gzip");
  } catch (error) {
    const diagnostic = error as { code?: string; position?: number; message?: string };
    throw new Error(`${installPhase}: ${diagnostic.code ?? "unknown"} at ${diagnostic.position ?? "unknown"}: ${diagnostic.message ?? "installation failed"}`);
  } finally { await base.close(); }
}, 30_000);
beforeEach(async () => {
  db = new PGlite({ loadDataDir: dump }); await db.waitReady; await db.exec(overlay);
  await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated'),($2,'authenticated','authenticated')", [actor, other]);
  await db.query("INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)", [session, actor]);
  await db.query("INSERT INTO public.game_systems(id,slug,name,status) VALUES($1,'dnd-5e-2014','Fixture rules','published')", [system]);
  await db.exec("BEGIN");
});
afterEach(async () => { await db.exec("ROLLBACK"); await db.close(); });

describe("finite genuine row-bootstrap through staged service gateway", () => {
  it("allocates and saves a real parent/header/order/receipt/journal plus exactly two consumed proofs", async () => {
    const result = await call(); expect(result.status).toBe("applied");
    expect(classOriginReceiptSchema.safeParse(result.receipt).success).toBe(true);
    const target = result.receipt!.target_character_id;
    const saved = (await db.query<{ graph: unknown; expected: unknown }>(`SELECT private.class_origin_read_final_graph_v1($1,ARRAY[]::uuid[]) AS graph,
      expected_graph AS expected FROM private.class_writer_acceptance_v1 WHERE target_character_id=$1`, [target])).rows[0];
    expect(saved.graph).toEqual(saved.expected); expect(classOriginGraphSchema.safeParse(saved.graph).success).toBe(true);
    expect((await db.query(`SELECT finalized,revision_transition_consumed,acceptance_kind,
      before_parent,before_origin,preinsert_proof->>'target_character_id' AS absent_target
      FROM private.class_writer_acceptance_v1 WHERE target_character_id=$1`, [target])).rows)
      .toEqual([{ finalized: true, revision_transition_consumed: false, acceptance_kind: "bootstrap_new", before_parent: null, before_origin: null, absent_target: target }]);
    expect((await db.query(`SELECT relation_key,consumed,before_row FROM private.class_writer_row_transitions_v1 ORDER BY relation_key`)).rows)
      .toEqual([{ relation_key: "creation_receipt", consumed: true, before_row: null }, { relation_key: "origin", consumed: true, before_row: null }]);
    // Fire the actual original deferred constraint triggers, then commit actual
    // rows. This is offline closure/commit, not native/provider acceptance.
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE; COMMIT; BEGIN");
    expect((await db.query("SELECT count(*)::int AS parents FROM public.characters")).rows).toEqual([{ parents: 1 }]);
  });
  it("returns the exact original immutable receipt after an actual commit, without a second allocation", async () => {
    const first = await call(); await db.exec("COMMIT; BEGIN");
    const before = await snapshot();
    expect(await call()).toEqual({ status: "recorded", receipt: first.receipt });
    expect(await call(resolve())).toEqual({ status: "recorded", receipt: first.receipt });
    expect(await snapshot()).toEqual(before);
  });
  it("recovers before NEW system admission after source system becomes unavailable", async () => {
    const first = await call(); await db.exec("COMMIT; BEGIN");
    await db.exec("UPDATE public.game_systems SET status='draft'");
    expect(await call(resolve())).toEqual({ status: "recorded", receipt: first.receipt });
    expect(await call()).toEqual({ status: "recorded", receipt: first.receipt });
  });
  it("same operation with changed intent returns conflict and does not alter the saved graph", async () => {
    await call(); await db.exec("COMMIT; BEGIN"); const before = await snapshot();
    expect(await call({ ...intent(), fields: { ...intent().fields, name: "Changed" } })).toEqual({ status: "intent_conflict" });
    expect(await snapshot()).toEqual(before);
  });
  it("missing-operation recovery returns only absence, without allocating anything", async () => {
    const before = await snapshot(); expect(await call(resolve())).toEqual({ status: "absent" }); expect(await snapshot()).toEqual(before);
  });
  it("refuses NEW unpublished system through actual authority role locking policies", async () => {
    await db.exec("UPDATE public.game_systems SET status='draft'");
    await refusal(intent(), context(), "42501", "published_system_unavailable");
  });
  it("original immutable-key system lock privilege does not permit actual system mutation", async () => {
    await db.exec("SAVEPOINT system_mutation; SET LOCAL ROLE inkborne_hit_die_authority_owner");
    await expect(db.exec("UPDATE public.game_systems SET id=id")).rejects.toMatchObject({ code: "42501" });
    await db.exec("ROLLBACK TO SAVEPOINT system_mutation; RELEASE SAVEPOINT system_mutation");
  });
  it("exercises active RLS and nonSUPER/nonBYPASS identities for both original owners", async () => {
    for (const [role, relation] of [["inkborne_class_origin_owner", "public.characters"],
      ["inkborne_hit_die_authority_owner", "private.character_projection_order_v1"]]) {
      await db.exec(`SET LOCAL ROLE ${role}`);
      expect((await db.query(`SELECT current_user AS role,rolsuper,rolbypassrls,row_security_active($1::regclass) AS rls
        FROM pg_roles WHERE rolname=current_user`, [relation])).rows)
        .toEqual([{ role, rolsuper: false, rolbypassrls: false, rls: true }]);
      await db.exec("RESET ROLE");
    }
  });
  it.each(["missing_session", "banned", "anonymous", "missing_profile", "expired"])("refuses actual row/context condition %s with no writes", async reason => {
    const ctx = context();
    if (reason === "missing_session") await db.exec("DELETE FROM auth.sessions");
    if (reason === "banned") await db.exec("UPDATE auth.users SET banned_until=clock_timestamp()+interval '1 hour'");
    if (reason === "anonymous") await db.exec("UPDATE auth.users SET is_anonymous=true");
    if (reason === "missing_profile") await db.exec("DELETE FROM public.profiles");
    if (reason === "expired") ctx.jwt_expires_at="2000-01-01T00:00:00.000000Z";
    await refusal(intent(), ctx, "P0001", "character_command_rows_unavailable");
  });
  it("same-operation recovery still requires the current owner", async () => {
    const first = await call(); await db.exec("COMMIT; BEGIN");
    await db.query("UPDATE public.characters SET user_id=$1 WHERE id=$2", [other, first.receipt!.target_character_id]);
    await refusal(resolve(), context(), "42501", "current_owner_unavailable");
  });
  it.each(["parent", "order"])("rolls back all actual journal/proof/row writes after a forced %s insertion failure", async phase => {
    const relation = phase === "parent" ? "public.characters" : "private.character_projection_order_v1";
    await db.exec(`CREATE FUNCTION public.fixture_creation_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fixture_creation_failure' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER fixture_creation_failure AFTER INSERT ON ${relation} FOR EACH ROW EXECUTE FUNCTION public.fixture_creation_failure()`);
    await refusal(intent(), context(), "23514", "fixture_creation_failure");
  });
  it("does not enable either general Auth seam, global class gate or any of thirteen readiness families", async () => {
    await call();
    for (const helper of ["private.require_class_origin_auth_v1", "private.require_verified_hit_die_auth_v1"]) {
      await db.exec("SAVEPOINT general_auth");
      await expect(db.query(`SELECT ${helper}($1)`, [context()])).rejects.toMatchObject({ code: "P0001", message: "auth_unavailable" });
      await db.exec("ROLLBACK TO SAVEPOINT general_auth; RELEASE SAVEPOINT general_auth");
    }
    expect((await db.query("SELECT enabled FROM private.class_origin_gate_v1")).rows).toEqual([{ enabled: false }]);
    expect((await db.query("SELECT count(*)::int AS families,count(*) FILTER(WHERE ready)::int AS ready FROM private.character_writer_readiness_v1")).rows)
      .toEqual([{ families: 13, ready: 0 }]);
  });
  it.each(["anon", "authenticated", "service_role", "inkborne_character_command_gateway_owner"])("does not grant direct creation-context shim EXECUTE to %s", async role => {
    expect((await db.query("SELECT has_function_privilege($1,'private.require_character_creation_context_v1(jsonb)','EXECUTE') AS execute", [role])).rows)
      .toEqual([{ execute: false }]);
  });
  it("cannot INSERT a parent through class-owned RLS without a genuine pending native acceptance", async () => {
    await db.exec("SAVEPOINT forged_parent; SET LOCAL ROLE inkborne_class_origin_owner");
    await expect(db.query("INSERT INTO public.characters(id,user_id,system_id,name) VALUES($1,$2,$3,'forged')", [other, actor, system])).rejects.toMatchObject({ code: "42501" });
    await db.exec("ROLLBACK TO SAVEPOINT forged_parent; RELEASE SAVEPOINT forged_parent");
    expect((await db.query("SELECT count(*)::int AS parents FROM public.characters")).rows).toEqual([{ parents: 0 }]);
  });
  it("rejects reinstall instead of silently rebinding a previously activated body", async () => {
    await expect(db.exec(overlay)).rejects.toMatchObject({ code: "42501" }); await db.exec("ROLLBACK");
  });
});
