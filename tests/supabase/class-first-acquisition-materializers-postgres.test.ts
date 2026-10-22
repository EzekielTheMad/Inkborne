// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// B2 ONLY: reduced synthetic schema/history in one privileged PostgreSQL-WASM connection.
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
const b2Stage=source("supabase/staged/class-first-acquisition-materializers.sql");
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
  return (await connection.query<Row>(`SELECT p.oid::regprocedure::text AS signature,p.prosrc,p.prosecdef,
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

    fixturePhase="install-original-thirteen-and-native-trigger-bindings";
    await base.exec("SET SESSION AUTHORIZATION postgres");
    await base.exec(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      ALTER TABLE public.character_content_refs ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE public.character_content_refs ALTER COLUMN created_at SET DEFAULT now();
      ALTER TABLE public.character_spells ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE public.character_spells ALTER COLUMN created_at SET DEFAULT now();
      ALTER TABLE public.character_spells ALTER COLUMN is_known SET DEFAULT false;
      ALTER TABLE public.character_spells ALTER COLUMN is_prepared SET DEFAULT false;
      ALTER TABLE public.character_spells ALTER COLUMN always_prepared SET DEFAULT false;
      ALTER TABLE public.character_spells ALTER COLUMN in_spellbook SET DEFAULT false;
      ALTER TABLE public.character_spells ALTER COLUMN source SET DEFAULT 'manual';`);
    // auth.uid mapping above is solely the original LEGACY API fixture; native
    // B1/B2 never uses its GUC as actor authority. These are real original bodies.
    const originals: [string,string][]=[
      ["20260720185127_feature_grant_integrity.sql","private.materialize_feature_grants_for_ref"],
      ["20260720173545_content_version_policy_performance.sql","private.materialize_feature_grants_trigger"],
      ["20260720185149_feature_spell_grants.sql","private.materialize_spell_grants_for_ref"],
      ["20260720185149_feature_spell_grants.sql","private.materialize_spell_grants_trigger"],
      ["20260720185305_character_content_boundary_guards.sql","private.is_character_feature_grant_active"],
      ["20260720185305_character_content_boundary_guards.sql","private.enforce_character_feature_grant"],
      ["20260720185149_feature_spell_grants.sql","private.is_character_spell_grant_active"],
      ["20260720185149_feature_spell_grants.sql","private.enforce_character_spell_grant"],
      ["20260720185149_feature_spell_grants.sql","private.active_character_spell_grant_representatives"],
      ["20260720185305_character_content_boundary_guards.sql","public.sync_character_feature_refs"],
      ["20260720185149_feature_spell_grants.sql","public.sync_character_spell_grants"],
      ["20260721221108_feat_selection_and_campaign_revocation.sql","private.prune_inactive_feature_refs_after_choices"]
    ];
    for(const [file,name] of originals) {
      await base.exec(definition(source("supabase/migrations/"+file),name));
      const args=name.endsWith("_trigger")||name.includes("enforce_")||name.includes("after_choices")?"":"uuid";
      await base.exec(`REVOKE ALL ON FUNCTION ${name}(${args}) FROM PUBLIC,anon,authenticated,service_role`);
      if(name.startsWith("public.sync_")) await base.exec(`GRANT EXECUTE ON FUNCTION ${name}(uuid) TO authenticated,service_role`);
    }
    await base.exec(`CREATE TRIGGER materialize_feature_grants AFTER INSERT OR UPDATE OF content_id,content_version
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.materialize_feature_grants_trigger();
      CREATE TRIGGER materialize_spell_grants AFTER INSERT OR UPDATE OF character_id,content_id,content_version
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.materialize_spell_grants_trigger();
      CREATE TRIGGER enforce_character_feature_grant BEFORE INSERT OR UPDATE OF character_id,content_id,content_version,context,choice_source,feature_grant_id
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.enforce_character_feature_grant();
      CREATE TRIGGER enforce_character_spell_grant BEFORE INSERT OR UPDATE OF character_id,content_id,content_version,name,class_slug,source,is_prepared,always_prepared,spell_grant_id
      ON public.character_spells FOR EACH ROW EXECUTE FUNCTION private.enforce_character_spell_grant();
      CREATE TRIGGER prune_inactive_feature_refs_after_choices AFTER UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.prune_inactive_feature_refs_after_choices();`);
    await base.exec("SET SESSION AUTHORIZATION supabase_admin");
    await base.exec(definition(authority,"private.hit_die_order_revision_rebind_v1"));
    await base.exec(`ALTER FUNCTION private.hit_die_order_revision_rebind_v1() OWNER TO inkborne_hit_die_authority_owner;
      REVOKE ALL ON FUNCTION private.hit_die_order_revision_rebind_v1() FROM PUBLIC,anon,authenticated,service_role;
      GRANT SELECT,UPDATE(producer_revision) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;
      CREATE POLICY hit_die_order_owner_read ON private.character_projection_order_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
      CREATE POLICY hit_die_order_owner_rebind ON private.character_projection_order_v1 FOR UPDATE TO inkborne_hit_die_authority_owner USING(true) WITH CHECK(true);
      CREATE TRIGGER hit_die_order_revision_rebind AFTER UPDATE ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.hit_die_order_revision_rebind_v1();`);
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
  await fixtureStep("install-B2-source",()=>db.exec(b2Stage));
  await fixtureStep("reset-installer-role",()=>db.exec("RESET ROLE"));
  await fixtureStep("confirm-installer",async()=>{
    expect((await db.query("SELECT current_user AS current,session_user AS session,rolsuper FROM pg_roles WHERE rolname=current_user")).rows)
      .toEqual([{current:"supabase_admin",session:"supabase_admin",rolsuper:true}]);
  });
  await fixtureStep("demote-runtime-postgres",()=>db.exec("ALTER ROLE postgres NOSUPERUSER NOBYPASSRLS"));
  await fixtureStep("select-runtime-postgres",()=>db.exec("SET ROLE postgres"));
  await fixtureStep("begin-runtime-transaction",()=>db.exec("BEGIN"));
  await seedDependencies(db);
});
afterEach(async()=>{await db.exec("ROLLBACK"); await db.close();});


type Envelope=Row & {native_rows: Record<string,Row[]>;expected_graph:Row};
async function seedDependencies(connection:PGlite) {
  await connection.query(`UPDATE public.content_versions SET data_snapshot=$1 WHERE content_id=$2`,[
    {levels:[{level:1,features:['first']},{level:4,features:['later']}],
      spellcastingExtra:[{level:1,spells:['spark']},{level:4,spells:['nova']}]},content]);
  for(const [n,type,slug] of [[111,'feature','first'],[112,'feature','later'],[113,'spell','spark'],[114,'spell','nova']] as const) {
    await connection.query(`INSERT INTO public.content_versions VALUES($1,1,$2,$3,$4,$4,'platform','srd',NULL,
      '{}','[]','2025-12-01')`,[id(n),system,type,slug]);
  }
}
async function pending() {
  const plan=await prepare(); await classJournal(journal(plan));
  // Inject only the exact three proposed unconsumed proof rows for isolated B2.
  // No class transition issuer/OLD-RETURNING provenance or accepted B3 is claimed.
  await admin(async()=>{
    for(const transition of (plan.allocation_envelope.planned_transitions as Row[]))
      await insert(db,'private.class_writer_row_transitions_v1',{acceptance_id:plan.acceptance_id,...transition,consumed:false});
  });
  return {...plan,envelope:plan.allocation_envelope as Envelope};
}
async function controller(plan:Awaited<ReturnType<typeof pending>>) {
  await insert(db,'public.character_content_refs',plan.envelope.native_rows.refs[0]);
}
async function manualChoices(plan:Awaited<ReturnType<typeof pending>>) {
  // Intentional B2 fixture: real native R09 order rebind and pruning run, but
  // caller is SUPER fixture admin. This is NOT an actual B3 choices writer.
  await admin(()=>db.query('UPDATE public.characters SET choices=$1,action_revision=1 WHERE id=$2',
    [(plan.envelope.expected_graph.parent as Row).choices,target]));
}
async function rows(connection:PGlite,relation:string,character=target) {
  return (await connection.query<{row:Row}>(`SELECT to_jsonb(r) AS row FROM ${relation} r WHERE character_id=$1 ORDER BY id`,[character])).rows.map(r=>r.row);
}
const sortRows=(value:Row[])=>[...value].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
async function allPublicRows() {
  const result:Row={};
  for(const relation of ['public.character_content_refs','public.character_feature_grants','public.character_spell_grants','public.character_spells'])
    result[relation]=await rows(db,relation);
  return result;
}
async function b2Refusal(action:()=>Promise<unknown>,code='23514',message?:string) {
  const before=await allPublicRows();
  await refusal(action,code,message);
  expect(await allPublicRows()).toEqual(before);
}
describe('B2 finite native-plan materialization; synthetic offline evidence only',()=>{
  it('inserts complete dormant+active native grant rows from controller AFTER triggers before choices',async()=>{
    const plan=await pending(); await controller(plan);
    expect(await rows(db,'public.character_feature_grants')).toEqual(sortRows(plan.envelope.native_rows.feature_grants));
    expect(await rows(db,'public.character_spell_grants')).toEqual(sortRows(plan.envelope.native_rows.spell_grants));
    expect(await rows(db,'public.character_content_refs')).toEqual([plan.envelope.native_rows.refs[0]]);
    expect(await rows(db,'public.character_spells')).toEqual([]);
    expect(plan.envelope.native_rows.feature_grants.map(row=>row.unlock_level)).toEqual([1,4]);
    expect(plan.envelope.native_rows.spell_grants.map(row=>row.unlock_level)).toEqual([1,4]);
    expect((await db.query('SELECT action_revision::text AS revision,choices FROM public.characters')).rows)
      .toEqual([{revision:'0',choices:{}}]);
  });
  it('uses actual choices/rebind before active projections and preserves recursive original trigger wrappers',async()=>{
    const plan=await pending(); await controller(plan); await manualChoices(plan);
    await db.query('SELECT private.consume_first_class_active_projections_v1($1)',[plan.acceptance_id]);
    for(const [family,relation] of [['refs','public.character_content_refs'],['feature_grants','public.character_feature_grants'],
      ['spell_grants','public.character_spell_grants'],['spells','public.character_spells']] as const)
      expect(await rows(db,relation)).toEqual(sortRows(plan.envelope.native_rows[family]));
    // Native enforcement/predicates evaluate actual rows, not stubbed results.
    const active=(await db.query<{id:string}>('SELECT id FROM private.active_character_spell_grant_representatives($1)',[target])).rows;
    expect(active.map(row=>row.id)).toEqual(plan.envelope.native_rows.spells.map(row=>row.spell_grant_id));
    const preserved=(original as Row[]).filter(row=>['private.materialize_feature_grants_trigger()',
      'private.materialize_spell_grants_trigger()','private.enforce_character_feature_grant()',
      'private.enforce_character_spell_grant()','private.is_character_feature_grant_active(uuid)',
      'private.is_character_spell_grant_active(uuid)','private.active_character_spell_grant_representatives(uuid)',
      'private.character_can_access_content_version(uuid,uuid,integer)'].includes(String(row.signature)));
    expect((await originalMetadata(db)).filter(row=>preserved.some(old=>old.signature===row.signature))).toEqual(preserved);
    await admin(async()=>{
      expect((await db.query('SELECT command_revision::text AS revision FROM private.character_class_origin_v1')).rows).toEqual([{revision:'0'}]);
      expect((await db.query('SELECT producer_revision::text AS revision,pins FROM private.character_projection_order_v1')).rows)
        .toEqual([{revision:'1',pins:[]}]);
      expect((await db.query('SELECT count(*)::integer AS count FROM private.class_writer_acceptance_v1 WHERE NOT finalized')).rows)
        .toEqual([{count:1}]);
      expect((await db.query('SELECT count(*)::integer AS count FROM private.class_writer_row_transitions_v1 WHERE NOT consumed')).rows)
        .toEqual([{count:3}]);
    });
  });
  it('refuses active projections before actual choices; never infers choices from a plan',async()=>{
    const plan=await pending(); await controller(plan);
    await b2Refusal(()=>db.query('SELECT private.consume_first_class_active_projections_v1($1)',[plan.acceptance_id]));
  });
  it.each(['feature','spell'])('refuses repeated nonempty %s grant consumption without upsert/delete',async family=>{
    const plan=await pending(); await controller(plan);
    await b2Refusal(()=>db.query(`SELECT private.materialize_${family}_grants_for_ref($1)`,[plan.envelope.native_rows.refs[0].id]),
      '23514','first_class_materialization_already_consumed');
  });
  it('refuses repeated active consumption and unknown acceptance',async()=>{
    const plan=await pending(); await controller(plan); await manualChoices(plan);
    await db.query('SELECT private.consume_first_class_active_projections_v1($1)',[plan.acceptance_id]);
    await b2Refusal(()=>db.query('SELECT private.consume_first_class_active_projections_v1($1)',[plan.acceptance_id]),
      '23514','first_class_materialization_already_consumed');
    await b2Refusal(()=>db.query('SELECT private.consume_first_class_active_projections_v1($1)',[id(999)]),'42501');
  });
  it('does not fall through to legacy materialization for an enrolled target without a native plan',async()=>{
    await b2Refusal(()=>insert(db,'public.character_content_refs',{id:id(701),character_id:target,
      content_id:content,content_version:1,context:{source:'class',level:1},choice_source:null,
      created_at:'2026-01-01T00:00:00+00:00',feature_grant_id:null}),'42501');
  });
  it('does not adopt a previous transaction plan even when its native rows remain available',async()=>{
    const plan=await prepare(); await db.exec('COMMIT; BEGIN');
    await b2Refusal(()=>insert(db,'public.character_content_refs',(plan.allocation_envelope as Envelope).native_rows.refs[0]),'42501');
  });
  it('requires the exact pending journal and all three unconsumed private proofs',async()=>{
    const plan=await prepare(); await classJournal(journal(plan));
    await b2Refusal(()=>insert(db,'public.character_content_refs',(plan.allocation_envelope as Envelope).native_rows.refs[0]),'42501');
  });
  it.each(['context','content_version','created_at','id'])('refuses a changed native controller %s before any grant insert',async field=>{
    const plan=await pending(),row={...plan.envelope.native_rows.refs[0]};
    if(field==='context')row[field]={source:'class',level:2};
    else if(field==='id')row[field]=id(777);
    else if(field==='content_version')row[field]=2;
    else row[field]='2000-01-01T00:00:00+00:00';
    await b2Refusal(()=>insert(db,'public.character_content_refs',row));
  });
  it('refuses a changed exact content-version row instead of resolving another snapshot',async()=>{
    const plan=await pending();
    await db.query("UPDATE public.content_versions SET effects_snapshot='[1]' WHERE content_id=$1",[id(111)]);
    await b2Refusal(()=>controller(plan),'23514','first_class_materialization_version_changed');
  });
  it('refuses an extra target-domain row before consuming the plan',async()=>{
    const plan=await pending();
    await db.query('INSERT INTO public.character_inventory(id,character_id) VALUES($1,$2)',[id(777),target]);
    await b2Refusal(()=>controller(plan));
  });
  it('refuses protected legacy sync APIs after ordinary original ownership checks',async()=>{
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner]);
    for(const family of ['feature_refs','spell_grants']) await b2Refusal(
      ()=>db.query(`SELECT * FROM public.sync_character_${family}($1)`,[target]),'42501','protected_character_requires_native_plan');
  });
  it.each(['anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner'])(
    'gives %s no plan-consuming or journal-reader entrypoint',async role=>{
      const signatures=['private.first_class_materialization_inputs_v1(uuid,text)',
        'private.consume_first_class_grants_for_ref_v1(uuid,text)','private.consume_first_class_active_projections_v1(uuid)'];
      if(role!=='inkborne_class_origin_owner')signatures.push('private.read_first_class_pending_journal_v1(uuid,uuid)');
      for(const signature of signatures)expect((await db.query<{allowed:boolean}>(
        'SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,signature])).rows[0].allowed).toBe(false);
      expect((await db.query<{allowed:boolean}>("SELECT has_table_privilege('postgres','private.class_writer_acceptance_v1','SELECT') AS allowed")).rows[0].allowed).toBe(false);
    });
  it('rolls back both physical phases exactly at a caller savepoint',async()=>{
    const plan=await pending(),before=await allPublicRows(); await db.exec('SAVEPOINT physical_phases');
    await controller(plan); await manualChoices(plan);
    await db.query('SELECT private.consume_first_class_active_projections_v1($1)',[plan.acceptance_id]);
    await db.exec('ROLLBACK TO SAVEPOINT physical_phases; RELEASE SAVEPOINT physical_phases');
    expect(await allPublicRows()).toEqual(before);
    expect((await db.query('SELECT action_revision::text AS revision,choices FROM public.characters')).rows).toEqual([{revision:'0',choices:{}}]);
  });
  it('keeps both original Auth denials, all readiness flags, and the class gate closed',async()=>{
    const plan=await pending(); await controller(plan);
    for(const name of ['private.require_class_origin_auth_v1','private.require_verified_hit_die_auth_v1']) {
      await db.exec('SAVEPOINT auth_denial'); await db.exec(`SET LOCAL ROLE ${name.includes('class_origin')?'inkborne_class_origin_owner':'inkborne_hit_die_authority_owner'}`);
      await expect(db.query(`SELECT ${name}($1::jsonb)`,[context()])).rejects.toMatchObject({code:'P0001',message:'auth_unavailable'});
      await db.exec('ROLLBACK TO SAVEPOINT auth_denial; RELEASE SAVEPOINT auth_denial');
    }
    await admin(async()=>{
      expect((await db.query('SELECT enabled FROM private.class_origin_gate_v1')).rows).toEqual([{enabled:false}]);
      expect((await db.query('SELECT count(*)::integer AS count FROM private.character_writer_readiness_v1 WHERE NOT ready')).rows).toEqual([{count:13}]);
    });
  });
  it('preserves ordinary legacy controller/materializer/sync/prune results against unmodified original functions',async()=>{
    const baseline=new PGlite({loadDataDir:dump}); await baseline.waitReady;
    const legacy=id(700),legacyRef=id(701);
    async function exercise(connection:PGlite,seed:boolean) {
      if(seed)await seedDependencies(connection);
      await connection.query(`INSERT INTO public.characters(id,user_id,system_id,name,choices) VALUES($1,$2,$3,'Legacy',
        '{"classes":[{"slug":"fixture-class","level":1}]}')`,[legacy,owner,system]);
      await insert(connection,'public.character_content_refs',{id:legacyRef,character_id:legacy,content_id:content,
        content_version:1,context:{source:'class',level:1},choice_source:null,created_at:'2026-01-01T00:00:00+00:00',feature_grant_id:null});
      await connection.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
      await connection.query('SELECT * FROM public.sync_character_feature_refs($1)',[legacy]);
      await connection.query('SELECT * FROM public.sync_character_spell_grants($1)',[legacy]);
      const positive:Row={};
      for(const relation of ['public.character_content_refs','public.character_feature_grants','public.character_spell_grants','public.character_spells']) {
        positive[relation]=(await rows(connection,relation,legacy)).map(value=>{
          const normalized={...value};
          for(const key of ['id','created_at','controller_ref_id','feature_grant_id','spell_grant_id','choice_source'])delete normalized[key];
          return normalized;
        }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      }
      await connection.query(`UPDATE public.characters SET choices='{}' WHERE id=$1`,[legacy]);
      await connection.query('SELECT * FROM public.sync_character_spell_grants($1)',[legacy]);
      return {positive,afterPruneRefs:(await rows(connection,'public.character_content_refs',legacy)).length,
        afterPruneSpells:(await rows(connection,'public.character_spells',legacy)).length};
    }
    try{expect(await exercise(db,false)).toEqual(await exercise(baseline,true));}
    finally{await baseline.close();}
  });
  it.each([
    'ALTER FUNCTION private.materialize_feature_grants_for_ref(uuid) SECURITY INVOKER',
    'ALTER TABLE public.character_content_refs DISABLE TRIGGER materialize_spell_grants',
    'REVOKE EXECUTE ON FUNCTION public.sync_character_feature_refs(uuid) FROM service_role',
    'CREATE ROLE fixture_extra; ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO fixture_extra',
  ])('refuses drift or an unexpected default grant atomically %#',async setup=>{
    const isolated=new PGlite({loadDataDir:dump});
    try {
      await isolated.waitReady; await isolated.exec('SET SESSION AUTHORIZATION supabase_admin');
      await isolated.exec(stage); await isolated.exec(setup);
      const old=(await isolated.query("SELECT prosrc FROM pg_proc WHERE oid='private.materialize_feature_grants_for_ref(uuid)'::regprocedure")).rows;
      await expect(isolated.exec(b2Stage)).rejects.toMatchObject({code:'42501'}); await isolated.exec('ROLLBACK');
      expect((await isolated.query("SELECT to_regprocedure('private.consume_first_class_active_projections_v1(uuid)') AS helper")).rows)
        .toEqual([{helper:null}]);
      expect((await isolated.query("SELECT prosrc FROM pg_proc WHERE oid='private.materialize_feature_grants_for_ref(uuid)'::regprocedure")).rows).toEqual(old);
    }finally{await isolated.close();}
  });
});
