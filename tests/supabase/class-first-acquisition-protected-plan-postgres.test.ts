// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Reduced synthetic schema/history in one privileged PostgreSQL-WASM connection.
// Original history/descriptor/allocator/row-checker/guards run unchanged. Historical
// fixture commit/reload is real; bootstrap issuer/Auth/provider/native roles and
// concurrent waits are NOT established. No original denial is replaced.
type Row = Record<string, unknown>;
type Plan = Row & { acceptance_id: string; transaction_id: string; target_character_id: string;
  verified_actor_id: string; operation_id: string; verified_context: Row;
  canonical_intent: Row; bootstrap_history: Row; allocation_envelope: Row };
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target=id(1), system=id(2), creationOperation=id(4), owner=id(9), session=id(10), content=id(110), bootstrap=id(900);
const source = (file: string) => readFileSync(file,"utf8").replaceAll("\r\n","\n");
const producer=source("supabase/staged/class-origin-producer.sql");
const authority=source("supabase/staged/hit-die-authority-and-writers.sql");
const first=source("supabase/staged/class-origin-first-acquisition-prerequisites.sql");
const feature=source("supabase/migrations/20260720185127_feature_grant_integrity.sql");
const stage=source("supabase/staged/class-first-acquisition-protected-plan.sql");
let dump: Blob, db: PGlite, original: unknown;
async function fixtureStep<T>(phase:string,action:()=>Promise<T>):Promise<T> {
  try {return await action();} catch(error) {
    const selected=error as {code?:string;message?:string;detail?:string};
    // Fixture SQL only; never provider payload/token/environment. Fixed labels
    // expose the failing setup stage instead of 28 indistinguishable traces.
    throw new Error(`B1 fixture ${phase}: ${selected.code??'unknown'} ${selected.message??'failed'}; ${selected.detail??'no detail'}`);
  }
}
function definition(sql: string,name: string) {
  let start=sql.indexOf(`CREATE FUNCTION ${name}(`);
  if(start<0) start=sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  const open=sql.indexOf("AS $$",start), end=sql.indexOf("$$;",open+5);
  if(start<0||open<0||end<0) throw Error(`Missing unchanged function ${name}`);
  return sql.slice(start,end+3);
}
function table(sql: string,name: string) {
  let start=sql.indexOf(`CREATE TABLE ${name} (`);
  if(start<0) start=sql.indexOf(`CREATE TABLE ${name}(`);
  const end=sql.indexOf(";",start);
  if(start<0||end<0) throw Error(`Missing original table ${name}`);
  return sql.slice(start,end+1);
}
const context=() => ({ context_version:1,actor_id:owner,session_id:session,
  jwt_expires_at:new Date(Math.floor(Date.now()/1000)*1000+3600000).toISOString().replace(".000Z",".000000Z") });
const intent=() => ({contract_version:1,character_id:target,operation_id:id(800),command:"add_class",
  expected_action_revision:"0",expected_class_revision:"0",fields:{content_id:content,content_version:1,subclass:null}});
async function insert(connection: PGlite, relation: string,value: unknown) {
  await connection.query(`INSERT INTO ${relation} SELECT * FROM jsonb_populate_record(NULL::${relation},$1::jsonb)`,[value]);
}
async function prepare(ctx: unknown=context(),request: unknown=intent()) {
  return (await db.query<{plan:Plan}>("SELECT to_jsonb(private.prepare_first_class_protected_plan_v1($1::jsonb,$2::jsonb)) AS plan",[ctx,request])).rows[0].plan;
}
function journal(plan: Plan): Row {
  const e=plan.allocation_envelope;
  return {acceptance_id:plan.acceptance_id,transaction_id:plan.transaction_id,
    verified_actor_id:plan.verified_actor_id,target_character_id:target,acceptance_kind:"class_transition",
    before_parent:e.before_parent,before_origin:e.before_origin,preinsert_proof:null,
    expected_graph:e.expected_graph,planned_transitions:e.planned_transitions,receipt:e.receipt,
    revision_transition_consumed:false,finalized:false};
}
async function originalMetadata(connection: PGlite) {
  return (await connection.query(`SELECT p.oid::regprocedure::text AS signature,p.prosrc,p.prosecdef,
    p.provolatile,p.proconfig,pg_get_userbyid(p.proowner) AS owner,
    CASE WHEN pg_get_userbyid(p.proowner) IN ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner')
      THEN p.proacl::text ELSE NULL END AS unchanged_isolated_owner_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'
      AND p.proname NOT IN ('guard_first_class_plan_insert_v1','refuse_first_class_plan_mutation_v1',
        'prepare_first_class_protected_plan_v1','bind_first_class_plan_journal_v1','lock_first_class_plan_sources_v1')
    ORDER BY p.oid::regprocedure::text`)).rows;
}
async function originalRows() {
  await db.exec("SET LOCAL ROLE supabase_admin");
  const result: Row={};
  for(const relation of ["auth.users","auth.sessions","public.profiles","public.characters",
    "private.character_class_origin_v1","private.character_projection_order_v1",
    "private.character_creation_commands_v1","private.class_writer_acceptance_v1",
    "private.class_writer_row_transitions_v1","private.class_first_allocation_calculations_v1"]) {
    result[relation]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM ${relation} r`)).rows;
  }
  await db.exec("SET LOCAL ROLE postgres"); return result;
}
async function admin(action:()=>Promise<unknown>) {
  await db.exec("SET LOCAL ROLE supabase_admin");
  try{return await action();} finally{await db.exec("SET LOCAL ROLE postgres");}
}
async function classJournal(value:Row) {
  await db.exec("SET LOCAL ROLE inkborne_class_origin_owner");
  await insert(db,"private.class_writer_acceptance_v1",value);
  await db.exec("SET LOCAL ROLE postgres");
}
async function refusal(action:()=>Promise<unknown>,code="42501",message?:string) {
  const before=await originalRows();
  await db.exec("SAVEPOINT refuse");
  await expect(action()).rejects.toMatchObject({code,...(message?{message}:{})});
  await db.exec("ROLLBACK TO SAVEPOINT refuse; RELEASE SAVEPOINT refuse");
  expect(await originalRows()).toEqual(before);
}
async function seedHistory(connection: PGlite) {
  const row=async(relation:string,key:string) => (await connection.query<{row:Row}>(
    `SELECT to_jsonb(r)||jsonb_build_object('${key}',r.${key}::text) AS row FROM ${relation} r`)).rows[0].row;
  const parent=await row("public.characters","action_revision"), origin=await row("private.character_class_origin_v1","command_revision");
  const order=await row("private.character_projection_order_v1","producer_revision");
  const xid=(await connection.query<{xid:string}>("SELECT pg_current_xact_id()::text AS xid")).rows[0].xid;
  const instant=(await connection.query<{instant:string}>(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS instant`)).rows[0].instant;
  const receipt={receipt_version:1,receipt_kind:"bootstrap_new",operation_id:creationOperation,
    verified_actor_id:owner,target_character_id:target,accepted_at:instant,
    canonical_intent:{contract_version:1,operation_id:creationOperation,command:"create_character",
      fields:{name:parent.name,system_id:system,campaign_id:null}},initial_action_revision:"0",
    initial_class_revision:"0",initial_producer_revision:"0",copy_lineage:null};
  const creation={verified_actor_id:owner,operation_id:creationOperation,target_character_id:target,receipt};
  const transitions=[{relation_key:"origin",row_key:[target],before_row:null,after_row:origin},
    {relation_key:"creation_receipt",row_key:[owner,creationOperation],before_row:null,after_row:creation}];
  const graph={parent,origin,order,occurrences:[],refs:[],inventory:[],spells:[],feature_grants:[],spell_grants:[],versions:[]};
  await insert(connection,"private.character_creation_commands_v1",creation);
  await insert(connection,"private.class_writer_acceptance_v1",{acceptance_id:bootstrap,transaction_id:xid,
    verified_actor_id:owner,target_character_id:target,acceptance_kind:"bootstrap_new",before_parent:null,before_origin:null,
    preinsert_proof:{acceptance_id:bootstrap,target_character_id:target,transaction_id:xid,captured_at:instant},
    expected_graph:graph,planned_transitions:transitions,receipt,revision_transition_consumed:false,finalized:true});
  for(const transition of transitions) await insert(connection,"private.class_writer_row_transitions_v1",
    {acceptance_id:bootstrap,...transition,consumed:true});
}

beforeAll(async()=>{
  const base=new PGlite();
  let fixturePhase="split-bootstrap-and-runtime-postgres-before-owned-DDL";
  try {
    // PostgreSQL forbids demoting bootstrap-superuser OID10. Model Supabase's
    // distinct bootstrap/runtime roles before any app-owned DDL: the runtime
    // role is still exactly named postgres, with a regular OID and real flags.
    await base.exec("CREATE ROLE supabase_admin SUPERUSER NOLOGIN");
    await base.exec("SET SESSION AUTHORIZATION supabase_admin");
    await base.exec("ALTER ROLE postgres RENAME TO fixture_bootstrap_owner");
    await base.exec("CREATE ROLE postgres SUPERUSER LOGIN");
    await base.exec("SET SESSION AUTHORIZATION postgres");
    fixturePhase="create-baseline-under-regular-postgres";
    await base.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE ROLE inkborne_class_origin_owner NOLOGIN NOBYPASSRLS NOINHERIT;
      CREATE ROLE inkborne_hit_die_authority_owner NOLOGIN NOBYPASSRLS NOINHERIT;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      GRANT USAGE ON SCHEMA public,private TO inkborne_class_origin_owner,inkborne_hit_die_authority_owner;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),is_anonymous boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users,not_after timestamptz);
      CREATE TABLE public.game_systems(id uuid PRIMARY KEY,slug text,status text);
      CREATE TABLE public.characters(id uuid PRIMARY KEY,user_id uuid NOT NULL,system_id uuid NOT NULL,campaign_id uuid,
        name text NOT NULL,visibility text NOT NULL DEFAULT 'private',archived boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),level integer NOT NULL DEFAULT 1,base_stats jsonb NOT NULL DEFAULT '{}',
        choices jsonb NOT NULL DEFAULT '{}',state jsonb NOT NULL DEFAULT '{}',narrative jsonb NOT NULL DEFAULT '{}',
        narrative_rich jsonb NOT NULL DEFAULT '{}',primary_color text,action_revision bigint NOT NULL DEFAULT 0);
      CREATE TABLE public.content_versions(content_id uuid,version integer,system_id_snapshot uuid,content_type_snapshot text,
        slug_snapshot text,name_snapshot text,scope_snapshot text,source_snapshot text,owner_id_snapshot uuid,
        data_snapshot jsonb,effects_snapshot jsonb,created_at timestamptz,PRIMARY KEY(content_id,version));
      CREATE TABLE public.content_shares(content_id uuid,campaign_id uuid);
      CREATE TABLE public.campaign_members(campaign_id uuid,user_id uuid);
      CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY,character_id uuid NOT NULL REFERENCES public.characters,
        content_id uuid NOT NULL,content_version integer NOT NULL,context jsonb NOT NULL,choice_source text,created_at timestamptz NOT NULL,
        feature_grant_id uuid UNIQUE,UNIQUE(id,character_id));
      CREATE TABLE public.character_inventory(id uuid PRIMARY KEY,character_id uuid,content_id uuid,content_version integer);
      CREATE TABLE public.character_spells(id uuid PRIMARY KEY,character_id uuid NOT NULL REFERENCES public.characters,
        content_id uuid,name text NOT NULL,class_slug text NOT NULL,is_known boolean NOT NULL,is_prepared boolean NOT NULL,
        always_prepared boolean NOT NULL,in_spellbook boolean NOT NULL,source text NOT NULL,custom_data jsonb,
        created_at timestamptz NOT NULL,content_version integer,spell_grant_id uuid UNIQUE,UNIQUE(character_id,content_id,class_slug));`);
    await base.exec(source("supabase/migrations/00001_profiles.sql"));
    await base.exec(table(source("supabase/migrations/20260720173545_content_version_policy_performance.sql"),"public.character_feature_grants"));
    await base.exec(table(source("supabase/migrations/20260720185149_feature_spell_grants.sql"),"public.character_spell_grants"));
    await base.exec(definition(feature,"private.character_can_access_content_version"));
    await base.exec("REVOKE ALL ON FUNCTION private.character_can_access_content_version(uuid,uuid,integer) FROM PUBLIC,anon,authenticated");
    fixturePhase="switch-to-original-private-installer";
    await base.exec("SET SESSION AUTHORIZATION supabase_admin");
    for(const name of ["private.character_class_origin_v1","private.character_class_occurrences_v1",
      "private.character_class_commands_v1","private.character_creation_commands_v1","private.class_writer_acceptance_v1",
      "private.class_writer_row_transitions_v1","private.class_origin_gate_v1"]) await base.exec(table(producer,name));
    for(const name of ["private.character_writer_guard_v1","private.character_projection_order_v1","private.character_writer_readiness_v1"]) await base.exec(table(authority,name));
    await base.exec(definition(authority,"private.lock_character_writer_guard_v1"));
    for(const name of ["private.class_origin_exact_keys_v1","private.class_origin_row_scope_v1","private.class_origin_row_key_v1",
      "private.class_origin_decimal_v1","private.class_origin_uuid_v1","private.class_origin_instant_v1"]) {
      await base.exec(definition(producer,name));
      await base.exec(`ALTER FUNCTION ${name}(${name.endsWith("exact_keys_v1")?"jsonb,text[]":name.endsWith("row_scope_v1")?"text,jsonb,uuid,uuid":name.endsWith("row_key_v1")?"text,jsonb":name.endsWith("decimal_v1")?"text":"jsonb"}) OWNER TO inkborne_class_origin_owner`);
    }
    for(const [text,name,ownerRole] of [[producer,"private.require_class_origin_auth_v1","inkborne_class_origin_owner"],
      [authority,"private.require_verified_hit_die_auth_v1","inkborne_hit_die_authority_owner"]]) {
      await base.exec(definition(text,name)); await base.exec(`ALTER FUNCTION ${name}(jsonb) OWNER TO ${ownerRole}`);
    }
    await base.exec(source("supabase/staged/character-command-row-locks.sql"));
    fixturePhase="install-original-actor-prefix";
    await base.exec("SET SESSION AUTHORIZATION postgres");
    await base.exec(source("supabase/staged/character-command-actor-rows.sql"));
    await base.exec("SET SESSION AUTHORIZATION supabase_admin");
    for(const file of ["class-first-acquisition-dependencies","class-first-acquisition-allocation","class-first-acquisition-calculations"]) await base.exec(source(`supabase/staged/${file}.sql`));
    fixturePhase="commit-synthetic-bootstrap-history";
    // Explicit historical transaction, committed BEFORE original guards are
    // installed. This is injected correspondence, never genuine bootstrap proof.
    await base.exec("BEGIN");
    await base.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated')",[owner]);
    await base.query("INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)",[session,owner]);
    await base.query("INSERT INTO public.game_systems VALUES($1,'dnd-5e-2014','published')",[system]);
    await base.query("INSERT INTO public.characters(id,user_id,system_id,name) VALUES($1,$2,$3,'Committed fixture')",[target,owner,system]);
    await base.query("INSERT INTO private.character_class_origin_v1 VALUES($1,1,$2,'draft',NULL,'new_character',$3,NULL,NULL,0)",[target,system,creationOperation]);
    await base.query("INSERT INTO private.character_projection_order_v1 VALUES($1,1,0,'{}','{}','{}','{}','{}')",[target]);
    await base.exec("INSERT INTO private.class_origin_gate_v1(singleton) VALUES(true); INSERT INTO private.character_writer_guard_v1(singleton) VALUES(true)");
    await base.exec(`INSERT INTO private.character_writer_readiness_v1(family) SELECT unnest(ARRAY[
      'auth','order','state','character_choices','refs','feature_grants','spell_grants','inventory','spells',
      'shared_rules_access','version_identity','copy_award','lifecycle'])`);
    await base.query(`INSERT INTO public.content_versions VALUES($1,1,$2,'class','fixture-class','Fixture Class','platform','srd',NULL,
      '{"levels":[],"spellcastingExtra":[]}','[]','2026-01-01')`,[content,system]);
    await seedHistory(base); await base.exec("COMMIT");
    fixturePhase="install-original-journal-guards-and-class-capabilities";
    await base.exec(definition(first,"private.class_origin_acceptance_guard_v1"));
    await base.exec(definition(producer,"private.class_origin_deferred_finalizer_v1"));
    await base.exec(`ALTER FUNCTION private.class_origin_acceptance_guard_v1() OWNER TO inkborne_class_origin_owner;
      ALTER FUNCTION private.class_origin_deferred_finalizer_v1() OWNER TO inkborne_class_origin_owner;
      ALTER FUNCTION private.lock_character_writer_guard_v1() OWNER TO inkborne_hit_die_authority_owner;
      GRANT SELECT ON public.characters,public.character_content_refs,public.character_inventory,public.character_spells,
        public.character_feature_grants,public.character_spell_grants,public.content_versions,
        private.character_class_origin_v1,private.character_class_occurrences_v1,private.character_class_commands_v1,
        private.character_creation_commands_v1,private.character_projection_order_v1,private.class_writer_acceptance_v1,
        private.class_writer_row_transitions_v1,private.character_writer_guard_v1 TO inkborne_class_origin_owner;
      GRANT INSERT ON private.class_writer_acceptance_v1 TO inkborne_class_origin_owner;
      GRANT UPDATE(id) ON public.characters TO inkborne_class_origin_owner;
      GRANT UPDATE ON private.character_class_origin_v1 TO inkborne_class_origin_owner;
      GRANT UPDATE(marker) ON private.character_writer_guard_v1 TO inkborne_class_origin_owner;
      GRANT SELECT,UPDATE(marker) ON private.character_writer_guard_v1 TO inkborne_hit_die_authority_owner;
      GRANT EXECUTE ON FUNCTION private.lock_character_writer_guard_v1() TO inkborne_class_origin_owner;
      CREATE TRIGGER class_origin_acceptance_guard BEFORE INSERT OR UPDATE OR DELETE ON private.class_writer_acceptance_v1
        FOR EACH ROW EXECUTE FUNCTION private.class_origin_acceptance_guard_v1();
      CREATE CONSTRAINT TRIGGER class_origin_acceptance_closure AFTER INSERT OR UPDATE ON private.class_writer_acceptance_v1
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_origin_deferred_finalizer_v1();
      CREATE CONSTRAINT TRIGGER class_origin_transition_closure AFTER INSERT OR UPDATE ON private.class_writer_row_transitions_v1
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_origin_deferred_finalizer_v1();`);
    for(const name of ["character_class_origin_v1","character_class_occurrences_v1","character_class_commands_v1",
      "character_creation_commands_v1","character_projection_order_v1","class_writer_acceptance_v1",
      "class_writer_row_transitions_v1","character_writer_guard_v1"]) {
      await base.exec(`ALTER TABLE private.${name} ENABLE ROW LEVEL SECURITY;
        CREATE POLICY fixture_original_class_read ON private.${name} FOR SELECT TO inkborne_class_origin_owner USING(true)`);
    }
    for(const name of ["characters","content_versions","character_content_refs","character_inventory",
      "character_spells","character_feature_grants","character_spell_grants"]) {
      await base.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
        CREATE POLICY fixture_original_class_read ON public.${name} FOR SELECT TO inkborne_class_origin_owner USING(true)`);
    }
    await base.exec(`CREATE POLICY fixture_original_class_origin_lock ON private.character_class_origin_v1 FOR UPDATE
        TO inkborne_class_origin_owner USING(true) WITH CHECK(true);
      CREATE POLICY fixture_original_class_guard_lock ON private.character_writer_guard_v1 FOR UPDATE
        TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
      CREATE POLICY fixture_original_class_guard_no_update ON private.character_writer_guard_v1 AS RESTRICTIVE FOR UPDATE
        TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
      CREATE POLICY fixture_original_class_journal_insert ON private.class_writer_acceptance_v1 FOR INSERT
        TO inkborne_class_origin_owner WITH CHECK(true);
      CREATE POLICY fixture_original_class_parent_lock ON public.characters FOR UPDATE
        TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
      CREATE POLICY fixture_original_class_parent_no_update ON public.characters AS RESTRICTIVE FOR UPDATE
        TO inkborne_class_origin_owner USING(true) WITH CHECK(false)`);
    // Match original stage ACL closure, not just the extracted CREATE bodies.
    // The genuine class EXEC on the authority guard helper remains in place.
    const isolatedFunctions=(await base.query<{signature:string}>(`SELECT p.oid::regprocedure::text AS signature
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='private' AND r.rolname IN ('inkborne_class_origin_owner','inkborne_hit_die_authority_owner')`)).rows;
    for(const fn of isolatedFunctions) await base.exec(`REVOKE ALL ON FUNCTION ${fn.signature} FROM PUBLIC,anon,authenticated,service_role`);
    original=await originalMetadata(base); dump=await base.dumpDataDir("gzip");
  } catch(error) {
    const selected=error as {code?:string;message?:string;detail?:string};
    throw new Error(`B1 fixture ${fixturePhase}: ${selected.code??'unknown'} ${selected.message??'failed'}; ${selected.detail??'no detail'}`);
  } finally { await base.close(); }
},30000);
beforeEach(async()=>{
  db=new PGlite({loadDataDir:dump}); await db.waitReady;
  await fixtureStep("restore-super-installer",()=>db.exec("SET SESSION AUTHORIZATION supabase_admin"));
  await fixtureStep("install-B1-source",()=>db.exec(stage));
  await fixtureStep("reset-installer-role",()=>db.exec("RESET ROLE"));
  await fixtureStep("confirm-installer",async()=>{
    expect((await db.query("SELECT current_user AS current,session_user AS session,rolsuper FROM pg_roles WHERE rolname=current_user")).rows)
      .toEqual([{current:"supabase_admin",session:"supabase_admin",rolsuper:true}]);
  });
  await fixtureStep("demote-runtime-postgres",()=>db.exec("ALTER ROLE postgres NOSUPERUSER NOBYPASSRLS"));
  await fixtureStep("select-runtime-postgres",()=>db.exec("SET ROLE postgres"));
  await fixtureStep("begin-runtime-transaction",()=>db.exec("BEGIN"));
});
afterEach(async()=>{await db.exec("ROLLBACK"); await db.close();});

describe("closed protected B1 plan; synthetic offline characterization only",()=>{
  it("rederives native identity after committed/reloaded history and preserves all originals",async()=>{
    const before=await originalRows(), plan=await prepare();
    expect((await db.query("SELECT current_user AS role,rolsuper,rolbypassrls,oid<>10 AS regular_oid FROM pg_roles WHERE rolname=current_user")).rows)
      .toEqual([{role:"postgres",rolsuper:false,rolbypassrls:false,regular_oid:true}]);
    expect((await db.query("SELECT has_table_privilege('postgres','private.character_class_origin_v1','SELECT') AS allowed")).rows)
      .toEqual([{allowed:false}]);
    expect(plan).toMatchObject({plan_kind:"first_class_native_plan_v1",verified_actor_id:owner,session_id:session,
      target_character_id:target,operation_id:id(800),bootstrap_acceptance_id:bootstrap,canonical_intent:intent()});
    expect(plan.transaction_id).not.toBe((plan.bootstrap_history.bootstrap_journal as Row).transaction_id);
    expect(plan.acceptance_id).toBe(plan.allocation_envelope.acceptance_id);
    expect(plan.allocation_envelope.before_parent).toEqual(plan.bootstrap_history.before_parent);
    expect(await originalRows()).toEqual(before); expect(await originalMetadata(db)).toEqual(original);
  });
  it("never adopts an existing unverified calculation and rerolls every allocated identity",async()=>{
    await db.exec("SET LOCAL ROLE supabase_admin");
    const calculation=(await db.query<{row:Row}>("SELECT private.prepare_first_class_calculation_v1($1::jsonb) AS row",[intent()])).rows[0].row;
    await db.exec("SET LOCAL ROLE postgres");
    expect(await originalMetadata(db)).toEqual(original);
    const before=await originalRows(),plan=await prepare(),old=calculation.allocation_envelope as Row;
    expect(plan.acceptance_id).not.toBe(old.acceptance_id);
    expect((plan.allocation_envelope.expected_graph as Row).refs).not.toEqual((old.expected_graph as Row).refs);
    expect(await originalRows()).toEqual(before);
  });
  it("is stable only for the same context/intent/current history in the same transaction",async()=>{
    const ctx=context(),plan=await prepare(ctx); expect(await prepare(ctx)).toEqual(plan);
    await refusal(()=>prepare(ctx,{...intent(),operation_id:id(801)}),"23514");
    await refusal(()=>prepare({...ctx,jwt_expires_at:"9999-12-31T23:59:59.000000Z"}),"23514");
  });
  it.each([null,{}, {...context(),actor_id:id(99)}, {...context(),session_id:id(99)},
    {...context(),jwt_expires_at:"2000-01-01T00:00:00.000000Z"}])("requires current exact owned Auth rows %#",async ctx=>{
    await refusal(()=>prepare(ctx),"P0001");
  });
  it("refuses a changed system and missing original consumed proof",async()=>{
    await db.exec("UPDATE public.game_systems SET status='draft'");
    await refusal(()=>prepare(),"23514");
    await db.exec("UPDATE public.game_systems SET status='published'");
    await admin(()=>db.exec("DELETE FROM private.class_writer_row_transitions_v1 WHERE relation_key='origin'"));
    await refusal(()=>prepare(),"23514");
  });
  it("accepts only the complete immutable envelope as a pending journal, without executing B2/B3",async()=>{
    const plan=await prepare(); await classJournal(journal(plan)); await db.exec("SET LOCAL ROLE postgres");
    await db.exec("SET LOCAL ROLE supabase_admin");
    expect((await db.query<{count:number}>("SELECT count(*)::integer AS count FROM private.class_writer_acceptance_v1 WHERE NOT finalized")).rows[0].count).toBe(1);
    await db.exec("SET LOCAL ROLE postgres");
    expect((await db.query<{revision:string}>("SELECT action_revision::text AS revision FROM public.characters")).rows[0].revision).toBe("0");
    await refusal(()=>db.query("INSERT INTO private.class_first_protected_plans_v1(verified_context,canonical_intent) VALUES($1,$2)",
      [context(),{...intent(),operation_id:id(801)}]),"23514");
  });
  it.each(["receipt","expected_graph","planned_transitions","before_origin","verified_actor_id","transaction_id"])(
    "refuses tampered journal %s",async field=>{
      const plan=await prepare(),value=journal(plan);
      if(field==="verified_actor_id") value[field]=id(99);
      else if(field==="transaction_id") value[field]="1";
      else if(field==="planned_transitions") value[field]=[];
      else value[field]={...(value[field] as Row),tampered:true};
      const expected=field==="before_origin"?{code:"23514",message:"Actual before origin mismatch"}
        :field==="verified_actor_id"?{code:"23514",message:"Actual before parent mismatch"}
        :field==="transaction_id"?{code:"23514",message:"Invalid initial acceptance"}
        :{code:"42501",message:"first_class_plan_journal_mismatch"};
      await refusal(()=>classJournal(value),expected.code,expected.message);
    });
  it("retains original stale-journal transaction refusal",async()=>{
    const plan=await prepare(); await db.exec("COMMIT; BEGIN");
    await refusal(()=>classJournal(journal(plan)),"23514","Invalid initial acceptance");
  });
  it("rejects a prior-transaction sealed plan even when the new journal claims the current xid",async()=>{
    const plan=await prepare(); await db.exec("COMMIT; BEGIN");
    const xid=(await db.query<{xid:string}>("SELECT pg_current_xact_id()::text AS xid")).rows[0].xid;
    await refusal(()=>classJournal({...journal(plan),transaction_id:xid}),"42501","first_class_plan_journal_mismatch");
  });
  it.each(["anon","authenticated","service_role","inkborne_class_origin_owner","inkborne_hit_die_authority_owner"])(
    "denies isolated %s direct minting/table access and forged journal",async role=>{
      await db.exec("SET LOCAL ROLE inkborne_class_origin_owner");
      const derived=(await db.query<{value:Row}>("SELECT private.lock_first_class_plan_sources_v1($1::jsonb,$2::jsonb,true) AS value",[context(),intent()])).rows[0].value;
      const e=derived.envelope as Row;
      await db.exec("SET LOCAL ROLE postgres");
      const forged=journal({acceptance_id:e.acceptance_id as string,transaction_id:e.transaction_id as string,
        verified_actor_id:owner,target_character_id:target,operation_id:id(800),verified_context:context(),canonical_intent:intent(),bootstrap_history:{},allocation_envelope:e});
      expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege($1,'private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','EXECUTE') AS allowed",[role])).rows[0].allowed).toBe(false);
      for(const action of [()=>prepare(),()=>db.query("SELECT * FROM private.class_first_protected_plans_v1"),
        ()=>db.query("INSERT INTO private.class_first_protected_plans_v1(verified_context,canonical_intent) VALUES($1,$2)",[context(),intent()]),
        ()=>insert(db,"private.class_writer_acceptance_v1",forged)]) {
        await db.exec("SAVEPOINT isolated_role"); await db.exec(`SET LOCAL ROLE ${role}`);
        await expect(action()).rejects.toMatchObject({code:"42501"});
        await db.exec("ROLLBACK TO SAVEPOINT isolated_role; RELEASE SAVEPOINT isolated_role");
      }
    });
  it.each(["UPDATE private.class_first_protected_plans_v1 SET plan_kind=plan_kind",
    "DELETE FROM private.class_first_protected_plans_v1","TRUNCATE private.class_first_protected_plans_v1"])(
    "retains immutable plan evidence %s",async sql=>{await prepare(); await refusal(()=>db.exec(sql));});
  it("rejects supplied native fields even for the trusted installation owner",async()=>{
    await refusal(()=>db.query("INSERT INTO private.class_first_protected_plans_v1(verified_context,canonical_intent,acceptance_id) VALUES($1,$2,$3)",
      [context(),intent(),id(999)]));
  });
  it.each([
    "REVOKE EXECUTE ON FUNCTION private.read_first_class_bootstrap_history_v1(uuid) FROM inkborne_class_origin_owner",
    "REVOKE EXECUTE ON FUNCTION private.character_can_access_content_version(uuid,uuid,integer) FROM inkborne_class_origin_owner",
    "REVOKE EXECUTE ON FUNCTION private.lock_first_class_plan_sources_v1(jsonb,jsonb,boolean) FROM postgres",
    "REVOKE EXECUTE ON FUNCTION private.lock_character_writer_guard_v1() FROM inkborne_class_origin_owner",
  ])("requires genuine narrow cross-owner capability %#",async sql=>{
    await admin(()=>db.exec(sql)); await refusal(()=>prepare(),"42501");
  });
  it("keeps original Auth denials and readiness closed after plan creation",async()=>{
    await prepare();
    for(const name of ["private.require_class_origin_auth_v1","private.require_verified_hit_die_auth_v1"]) {
      await db.exec("SAVEPOINT original_auth");
      await db.exec(`SET LOCAL ROLE ${name.includes('class_origin')?'inkborne_class_origin_owner':'inkborne_hit_die_authority_owner'}`);
      await expect(db.query(`SELECT ${name}($1::jsonb)`,[context()])).rejects.toMatchObject({code:"P0001",message:"auth_unavailable"});
      await db.exec("ROLLBACK TO SAVEPOINT original_auth; RELEASE SAVEPOINT original_auth");
    }
    await db.exec("SET LOCAL ROLE supabase_admin");
    expect((await db.query<{enabled:boolean}>("SELECT enabled FROM private.class_origin_gate_v1")).rows).toEqual([{enabled:false}]);
    await db.exec("SET LOCAL ROLE postgres");
  });
  it("binds source metadata and refuses an unexpected default grant atomically",async()=>{
    for(const setup of ["ALTER FUNCTION private.check_character_command_clock_v1(timestamptz) SECURITY DEFINER",
      "CREATE POLICY fixture_hidden_graph ON public.character_content_refs AS RESTRICTIVE FOR SELECT TO inkborne_class_origin_owner USING(false)",
      "CREATE ROLE fixture_extra; ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO fixture_extra"]) {
      const isolated=new PGlite({loadDataDir:dump});
      try {
        await isolated.waitReady; await isolated.exec("SET SESSION AUTHORIZATION supabase_admin"); await isolated.exec(setup);
        await expect(isolated.exec(stage)).rejects.toMatchObject({code:"42501"}); await isolated.exec("ROLLBACK");
        expect((await isolated.query("SELECT to_regclass('private.class_first_protected_plans_v1') AS plan")).rows).toEqual([{plan:null}]);
      } finally {await isolated.close();}
    }
  });
});
