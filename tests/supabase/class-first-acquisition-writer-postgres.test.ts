// @vitest-environment node
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {afterEach,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {classOriginGraphSchema,classOriginReceiptSchema} from '@/lib/character/class-origin-command-schema';

// Selected synthetic baseline schema, real original baseline trigger/function
// bodies, COMPLETE staged D1-D5/bootstrap/row/bridge/admission/first-prerequisite/
// descriptor/allocation/calculation/B1/B2/B3 installation. No stage extraction or
// preflight replacement. Genuine row-bootstrap commit precedes first command.
// Auth rows are synthetic; this is not provider/JWT, native RLS/concurrency,
// complete83-migration, PostgREST, browser or production acceptance.
type Row=Record<string,unknown>;
type Result={status:string;receipt?:Row};
const read=(file:string)=>readFileSync(file,'utf8').replaceAll('\r\n','\n');
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),session=id(2),creationOperation=id(3),system=id(4),operation=id(5),other=id(6),content=id(100);
const stage=read('supabase/staged/class-first-acquisition-writer.sql');
let dump:Blob,preWriterDump:Blob,db:PGlite,target:string;
const context=()=>({context_version:1,actor_id:actor,session_id:session,
  jwt_expires_at:new Date(Math.floor(Date.now()/1000)*1000+3_600_000).toISOString().replace('.000Z','.000000Z')});
const intent=()=>({contract_version:1,command:'add_class',character_id:target,operation_id:operation,
  expected_action_revision:'0',expected_class_revision:'0',fields:{content_id:content,content_version:1,subclass:null}});
const resolve=()=>({contract_version:1,command:'resolve_class',character_id:target,operation_id:operation});
function definition(sql:string,name:string) {
  const found=[...sql.matchAll(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION ${name.replaceAll('.','\\.')}\\(`,'g'))];
  const start=found.at(-1)?.index??-1,open=sql.indexOf('AS $$',start),end=sql.indexOf('$$;',open+5);
  if(start<0||open<0||end<0)throw Error(`Missing original ${name}`);
  return sql.slice(start,end+3);
}
function table(sql:string,name:string) {
  const start=sql.indexOf(`CREATE TABLE ${name} (`),end=sql.indexOf(';',start);
  if(start<0||end<0)throw Error(`Missing original table ${name}`);
  return sql.slice(start,end+1);
}
async function step(connection:PGlite,label:string,sql:string) {
  try{await connection.exec(sql);}catch(error){const selected=error as {code?:string;message?:string;detail?:string};
    throw Error(`B3 fixture ${label}: ${selected.code??'unknown'} ${selected.message??'failed'}; ${selected.detail??'no detail'}`);}
}
async function call(request:unknown=intent(),ctx:unknown=context()):Promise<Result> {
  await db.exec('SET LOCAL ROLE service_role');
  const result=(await db.query<{result:Result}>('SELECT public.character_class_command_v1($1,$2) AS result',[ctx,request])).rows[0].result;
  await db.exec('RESET ROLE');return result;
}
async function snapshot() {
  const result:Row={};
  for(const relation of ['public.characters','private.character_class_origin_v1','private.character_class_occurrences_v1',
    'private.character_class_commands_v1','private.character_creation_commands_v1','private.character_projection_order_v1',
    'private.class_writer_acceptance_v1','private.class_writer_row_transitions_v1','private.class_first_acquisition_proofs_v1',
    'private.class_first_protected_plans_v1','public.character_content_refs','public.character_feature_grants',
    'public.character_spell_grants','public.character_spells','public.character_inventory'])
    result[relation]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM ${relation} r`)).rows;
  return result;
}
async function refusal(action:()=>Promise<unknown>,code:string,message?:string) {
  const before=await snapshot();await db.exec('SAVEPOINT b3_refusal');
  await expect(action()).rejects.toMatchObject({code,...(message?{message}:{})});
  await db.exec('ROLLBACK TO SAVEPOINT b3_refusal; RELEASE SAVEPOINT b3_refusal');
  expect(await snapshot()).toEqual(before);
}
async function realPendingProof() {
  await db.exec('SET LOCAL ROLE postgres');
  const plan=(await db.query<{plan:Row}>('SELECT to_jsonb(private.prepare_first_class_protected_plan_v1($1,$2)) AS plan',[context(),intent()])).rows[0].plan;
  const envelope=plan.allocation_envelope as Row;
  await db.exec('SET LOCAL ROLE inkborne_class_origin_owner');
  await db.query(`INSERT INTO private.class_writer_acceptance_v1 SELECT * FROM jsonb_populate_record(NULL::private.class_writer_acceptance_v1,$1)`,[
    {acceptance_id:plan.acceptance_id,transaction_id:plan.transaction_id,verified_actor_id:actor,target_character_id:target,
      acceptance_kind:'class_transition',before_parent:envelope.before_parent,before_origin:envelope.before_origin,preinsert_proof:null,
      expected_graph:envelope.expected_graph,planned_transitions:envelope.planned_transitions,receipt:envelope.receipt,
      revision_transition_consumed:false,finalized:false}]);
  for(const transition of envelope.planned_transitions as Row[])await db.query(`INSERT INTO private.class_writer_row_transitions_v1
    SELECT * FROM jsonb_populate_record(NULL::private.class_writer_row_transitions_v1,$1)`,[{acceptance_id:plan.acceptance_id,...transition,consumed:false}]);
  await db.query("SELECT private.apply_first_class_public_rows_v1($1,'controller')",[plan.acceptance_id]);
  const inputs=(await db.query<{inputs:Row}>('SELECT private.class_first_acquisition_inputs_v1($1) AS inputs',[plan.acceptance_id])).rows[0].inputs;
  await db.exec('SET LOCAL ROLE inkborne_hit_die_authority_owner');
  await db.query(`INSERT INTO private.class_first_acquisition_proofs_v1 SELECT * FROM jsonb_populate_record(NULL::private.class_first_acquisition_proofs_v1,$1)`,[
    {acceptance_id:plan.acceptance_id,transaction_id:plan.transaction_id,target_character_id:target,verified_actor_id:actor,
      operation_id:operation,mode:'first_add_class_choices',before_action_revision:0,after_action_revision:1,before_class_revision:0,after_class_revision:1,
      before_parent:inputs.before_parent,before_order:inputs.before_order,expected_after_graph:inputs.expected_after_graph,
      planned_rows:inputs.planned_rows,phase:'pending',observed_parent:null,observed_order:null}]);
  await db.exec('RESET ROLE');return {plan,inputs};
}
beforeAll(async()=>{
  const base=new PGlite();
  try {
    await step(base,'regular runtime role bootstrap',`CREATE ROLE supabase_admin SUPERUSER NOLOGIN;
      SET SESSION AUTHORIZATION supabase_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap_owner;
      CREATE ROLE postgres SUPERUSER LOGIN; SET SESSION AUTHORIZATION postgres;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,aud varchar(255),role varchar(255),is_anonymous boolean NOT NULL DEFAULT false,
        deleted_at timestamptz,banned_until timestamptz,raw_user_meta_data jsonb);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users,not_after timestamptz);`);
    await step(base,'original profiles',read('supabase/migrations/00001_profiles.sql'));
    await step(base,'original systems',read('supabase/migrations/00002_game_systems.sql'));
    await step(base,'selected baseline typed rows',`CREATE TABLE public.campaigns(id uuid PRIMARY KEY,system_id uuid);
      CREATE TABLE public.campaign_members(id uuid PRIMARY KEY,campaign_id uuid,user_id uuid);
      CREATE TABLE public.content_shares(id uuid PRIMARY KEY,content_id uuid,campaign_id uuid);
      CREATE TABLE public.content_definitions(id uuid PRIMARY KEY);
      CREATE TABLE public.characters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.profiles,
        system_id uuid NOT NULL REFERENCES public.game_systems,campaign_id uuid,name text NOT NULL,
        visibility text NOT NULL DEFAULT 'private',archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),
        level integer NOT NULL DEFAULT 1,base_stats jsonb NOT NULL DEFAULT '{}',choices jsonb NOT NULL DEFAULT '{}',
        state jsonb NOT NULL DEFAULT '{}',narrative jsonb NOT NULL DEFAULT '{}',narrative_rich jsonb NOT NULL DEFAULT '{}',primary_color text);
      CREATE TABLE public.content_versions(content_id uuid,version integer,system_id_snapshot uuid,content_type_snapshot text,
        slug_snapshot text,name_snapshot text,scope_snapshot text,source_snapshot text,owner_id_snapshot uuid,
        data_snapshot jsonb,effects_snapshot jsonb,created_at timestamptz,unparsed_snapshot jsonb,PRIMARY KEY(content_id,version));
      CREATE TABLE public.character_content_refs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid NOT NULL REFERENCES public.characters,
        content_id uuid NOT NULL,content_version integer NOT NULL,context jsonb NOT NULL,choice_source text,
        created_at timestamptz NOT NULL DEFAULT now(),feature_grant_id uuid UNIQUE,UNIQUE(id,character_id));
      CREATE TABLE public.character_inventory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters,
        content_id uuid,content_version integer);
      CREATE TABLE public.character_spells(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid NOT NULL REFERENCES public.characters,
        content_id uuid,name text NOT NULL,class_slug text NOT NULL,is_known boolean NOT NULL DEFAULT false,is_prepared boolean NOT NULL DEFAULT false,
        always_prepared boolean NOT NULL DEFAULT false,in_spellbook boolean NOT NULL DEFAULT false,source text NOT NULL DEFAULT 'manual',custom_data jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),content_version integer,spell_grant_id uuid UNIQUE,UNIQUE(character_id,content_id,class_slug));
      CREATE TABLE public.character_rolls(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),character_id uuid REFERENCES public.characters,user_id uuid,
        kind text,label text,expression text,result jsonb,total integer,rolled_at timestamptz DEFAULT now());`);
    await step(base,'original feature table',table(read('supabase/migrations/20260720173545_content_version_policy_performance.sql'),'public.character_feature_grants'));
    await step(base,'original spell-grant table',table(read('supabase/migrations/20260720185149_feature_spell_grants.sql'),'public.character_spell_grants'));
    const originals:[string,string,string][]=[
      ['20260720185127_feature_grant_integrity.sql','private.character_can_access_content_version','uuid,uuid,integer'],
      ['20260720185127_feature_grant_integrity.sql','private.materialize_feature_grants_for_ref','uuid'],
      ['20260720173545_content_version_policy_performance.sql','private.materialize_feature_grants_trigger',''],
      ['20260720185149_feature_spell_grants.sql','private.materialize_spell_grants_for_ref','uuid'],
      ['20260720185149_feature_spell_grants.sql','private.materialize_spell_grants_trigger',''],
      ['20260720185305_character_content_boundary_guards.sql','private.is_character_feature_grant_active','uuid'],
      ['20260720185305_character_content_boundary_guards.sql','private.enforce_character_feature_grant',''],
      ['20260720185149_feature_spell_grants.sql','private.is_character_spell_grant_active','uuid'],
      ['20260720185149_feature_spell_grants.sql','private.enforce_character_spell_grant',''],
      ['20260720185149_feature_spell_grants.sql','private.active_character_spell_grant_representatives','uuid'],
      ['20260720185305_character_content_boundary_guards.sql','public.sync_character_feature_refs','uuid'],
      ['20260720185149_feature_spell_grants.sql','public.sync_character_spell_grants','uuid'],
      ['20260721221108_feat_selection_and_campaign_revocation.sql','private.prune_inactive_feature_refs_after_choices',''],
      ['20260720185305_character_content_boundary_guards.sql','private.validate_character_content_boundaries',''],
      ['20260721221108_feat_selection_and_campaign_revocation.sql','private.prune_inactive_asi_choices_before_choices',''],
      ['20260721223507_harden_feat_choice_atomicity.sql','private.enforce_asi_choice_map_boundary',''],
      ['20260722221534_atomic_background_selection.sql','private.enforce_background_choice_map_boundary',''],
    ];
    for(const[file,name,args]of originals) {
      await step(base,`original baseline ${name}`,definition(read('supabase/migrations/'+file),name));
      await base.exec(`REVOKE ALL ON FUNCTION ${name}(${args}) FROM PUBLIC,anon,authenticated,service_role`);
      if(name.startsWith('public.sync_'))await base.exec(`GRANT EXECUTE ON FUNCTION ${name}(uuid) TO authenticated,service_role`);
    }
    await step(base,'actual original parent/ref/spell trigger wiring',`CREATE TRIGGER materialize_feature_grants AFTER INSERT OR UPDATE OF content_id,content_version
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.materialize_feature_grants_trigger();
      CREATE TRIGGER materialize_spell_grants AFTER INSERT OR UPDATE OF character_id,content_id,content_version
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.materialize_spell_grants_trigger();
      CREATE TRIGGER enforce_character_feature_grant BEFORE INSERT OR UPDATE OF character_id,content_id,content_version,context,choice_source,feature_grant_id
      ON public.character_content_refs FOR EACH ROW EXECUTE FUNCTION private.enforce_character_feature_grant();
      CREATE TRIGGER enforce_character_spell_grant BEFORE INSERT OR UPDATE OF character_id,content_id,content_version,name,class_slug,source,is_prepared,always_prepared,spell_grant_id
      ON public.character_spells FOR EACH ROW EXECUTE FUNCTION private.enforce_character_spell_grant();
      CREATE TRIGGER prune_inactive_feature_refs_after_choices AFTER UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.prune_inactive_feature_refs_after_choices();
      CREATE TRIGGER validate_character_content_boundaries AFTER UPDATE OF campaign_id,system_id ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.validate_character_content_boundaries();
      CREATE TRIGGER prune_inactive_asi_choices_before_choices BEFORE UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.prune_inactive_asi_choices_before_choices();
      CREATE TRIGGER enforce_asi_choice_map_boundary BEFORE UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.enforce_asi_choice_map_boundary();
      CREATE TRIGGER enforce_background_choice_map_boundary BEFORE INSERT OR UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.enforce_background_choice_map_boundary();`);
    for(const name of ['campaigns','campaign_members','content_shares','content_definitions','characters','content_versions',
      'character_content_refs','character_inventory','character_spells','character_feature_grants','character_spell_grants','character_rolls'])
      await base.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY`);
    await base.exec('SET SESSION AUTHORIZATION supabase_admin');
    // Model native SAdmin public-function defaults without changing any legacy
    // object to make a new endpoint pass its exact closure.
    await base.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres');
    for(const name of ['hit-die-transaction','hit-die-authority-and-writers','class-origin-producer','class-origin-joint-revision',
      'class-origin-confirmation-producer','class-origin-fresh-bootstrap'])
      await step(base,`COMPLETE ${name}`,read(`supabase/staged/${name}.sql`));
    await base.exec('SET SESSION AUTHORIZATION postgres');
    for(const name of ['character-command-row-locks','character-command-actor-rows'])
      await step(base,`COMPLETE direct-postgres ${name}`,read(`supabase/staged/${name}.sql`));
    await base.exec('SET SESSION AUTHORIZATION supabase_admin');
    for(const name of ['character-creation-server-bridge','character-creation-native-admission',
      'class-origin-first-acquisition-prerequisites','class-first-acquisition-dependencies','class-first-acquisition-allocation',
      'class-first-acquisition-calculations','class-first-acquisition-protected-plan','class-first-acquisition-materializers'])
      await step(base,`COMPLETE ${name}`,read(`supabase/staged/${name}.sql`));
    preWriterDump=await base.dumpDataDir('gzip');
    await step(base,'COMPLETE B3 candidate',stage);
    await base.exec('ALTER ROLE postgres NOSUPERUSER NOBYPASSRLS');
    dump=await base.dumpDataDir('gzip');
  }finally{await base.close();}
},30_000);

beforeEach(async()=>{
  db=new PGlite({loadDataDir:dump});await db.waitReady;
  await db.exec('SET SESSION AUTHORIZATION supabase_admin');
  await db.query("INSERT INTO auth.users(id,aud,role) VALUES($1,'authenticated','authenticated'),($2,'authenticated','authenticated')",[actor,other]);
  await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[session,actor]);
  await db.query(`INSERT INTO public.game_systems(id,slug,name,status)
    VALUES($1,'dnd-5e-2014','Fixture system','published')`,[system]);
  for(const[n,type,slug,data,date]of [
    [100,'class','fixture-class',{levels:[{level:1,features:['first']},{level:4,features:['later']}],spellcastingExtra:[{level:1,spells:['spark']},{level:4,spells:['nova']}]},'2026-01-01'],
    [101,'feature','first',{},'2025-12-01'],[102,'feature','later',{},'2025-12-01'],
    [103,'spell','spark',{},'2025-12-01'],[104,'spell','nova',{},'2025-12-01'],
  ] as const) await db.query(`INSERT INTO public.content_versions(content_id,version,system_id_snapshot,content_type_snapshot,slug_snapshot,
    name_snapshot,scope_snapshot,source_snapshot,owner_id_snapshot,data_snapshot,effects_snapshot,created_at)
    VALUES($1,1,$2,$3,$4,$4,'platform','srd',NULL,$5,'[]',$6)`,[id(n),system,type,slug,data,date]);
  await db.exec('BEGIN; SET LOCAL ROLE service_role');
  const creation=(await db.query<{result:Result}>('SELECT public.character_creation_command_v1($1,$2) AS result',
    [context(),{contract_version:1,command:'create_character',operation_id:creationOperation,
      fields:{name:'Genuine fixture draft',system_id:system,campaign_id:null}}])).rows[0].result;
  expect(creation.status).toBe('applied');target=String(creation.receipt!.target_character_id);
  await db.exec('COMMIT; RESET ROLE; BEGIN');
});
afterEach(async()=>{await db.exec('ROLLBACK');await db.close();});

describe('B3 genuine row creation→first class transaction; offline selected baseline only',()=>{
  it('commits actual service-role RPC choices/native rows/order/proofs and exactly matches the original raw final reader',async()=>{
    let result:Result;
    try{result=await call();}catch(error){
      const failure=error as {code?:string;message?:string;detail?:string;where?:string};
      throw Error(`Synthetic first-class save: ${failure.code} ${failure.message}; ${failure.detail}; ${failure.where}`);
    }
    expect(result.status).toBe('applied');
    expect(classOriginReceiptSchema.safeParse(result.receipt).success).toBe(true);
    const saved=(await db.query<{envelope:Row}>('SELECT allocation_envelope AS envelope FROM private.class_first_protected_plans_v1')).rows[0].envelope;
    await db.exec('SET LOCAL ROLE inkborne_class_origin_owner');
    const graph=(await db.query<{graph:Row}>(`SELECT private.class_origin_read_final_graph_v1($1,ARRAY(
      SELECT id FROM private.character_class_occurrences_v1 WHERE character_id=$1)) AS graph`,[target])).rows[0].graph;
    await db.exec('RESET ROLE');
    expect(graph).toEqual(saved.expected_graph);expect(classOriginGraphSchema.safeParse(graph).success).toBe(true);
    expect((await db.query('SELECT action_revision::text AS revision FROM public.characters')).rows).toEqual([{revision:'1'}]);
    expect((await db.query('SELECT phase FROM private.class_first_acquisition_proofs_v1')).rows).toEqual([{phase:'observed'}]);
    expect((await db.query('SELECT count(*)::integer AS count FROM private.class_writer_row_transitions_v1 WHERE NOT consumed')).rows).toEqual([{count:0}]);
    await db.exec('COMMIT; BEGIN');
    expect((await call(resolve())).receipt).toEqual(result.receipt);
  });
  it('returns the same historical receipt before empty/source planning on retry and explicit resolution',async()=>{
    const first=await call();await db.exec('COMMIT; BEGIN');
    // Subsequent native ordinary mechanical update and catalog change make a new
    // empty/history/descriptor plan impossible; recovery must still succeed.
    await db.query(`UPDATE public.characters SET state='{"hp":7}',name='Later name' WHERE id=$1`,[target]);
    await db.query("UPDATE public.content_versions SET data_snapshot='{}' WHERE content_id=$1",[content]);
    const before=await snapshot();expect(await call()).toEqual({status:'replayed',receipt:first.receipt});
    expect(await call(resolve())).toEqual({status:'recorded',receipt:first.receipt});expect(await snapshot()).toEqual(before);
  });
  it('recovers with a newly verified session while never using the historical session as current authority',async()=>{
    const first=await call();await db.exec('COMMIT; BEGIN');
    await db.query('DELETE FROM auth.sessions WHERE id=$1',[session]);await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[id(22),actor]);
    expect(await call(resolve(),{...context(),session_id:id(22)})).toEqual({status:'recorded',receipt:first.receipt});
    await refusal(()=>call(resolve()),'P0001');
  });
  it('returns absent without minting, and refuses a same-op changed intent after a successful commit',async()=>{
    const before=await snapshot();expect(await call(resolve())).toEqual({status:'absent'});expect(await snapshot()).toEqual(before);
    await call();await db.exec('COMMIT; BEGIN');
    await refusal(()=>call({...intent(),fields:{content_id:id(104),content_version:1,subclass:null}}),'23505','operation_intent_conflict');
  });
  it.each([null,{}, {...context(),actor_id:other},{...context(),session_id:id(99)},
    {...context(),jwt_expires_at:'2000-01-01T00:00:00.000000Z'}])('rejects unavailable actual actor/session rows %#',async ctx=>{
      await refusal(()=>call(intent(),ctx),'P0001');
    });
  it('hides missing/foreign targets behind the same ownership result',async()=>{
    await refusal(()=>call({...resolve(),character_id:id(99)}),'42501','current_owner_unavailable');
    await db.query('UPDATE public.characters SET user_id=$1 WHERE id=$2',[other,target]);
    await refusal(()=>call(resolve()),'42501','current_owner_unavailable');
  });
  it.each(['anon','authenticated','service_role','inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner'])(
    'preserves %s no-mint/table/private boundaries',async role=>{
      for(const capability of [
        ['function','private.prepare_first_class_protected_plan_v1(jsonb,jsonb)','EXECUTE'],
        ['table','private.class_first_protected_plans_v1','SELECT'],['table','private.class_first_protected_plans_v1','INSERT'],
      ])expect((await db.query<{allowed:boolean}>(`SELECT has_${capability[0]}_privilege($1,$2,$3) AS allowed`,[role,capability[1],capability[2]])).rows[0].allowed).toBe(false);
      if(role!=='service_role')expect((await db.query<{allowed:boolean}>("SELECT has_function_privilege($1,'public.character_class_command_v1(jsonb,jsonb)','EXECUTE') AS allowed",[role])).rows[0].allowed)
        .toBe(role==='inkborne_character_command_gateway_owner');
    });
  it('closes explicit public default postgres EXEC in the plain fixture and limits the coordinator',async()=>{
    // Native postgres may inherit service_role and therefore effectively EXEC
    // without a raw postgres ACL. This plain fixture has no such memberships.
    expect((await db.query(`SELECT has_function_privilege('postgres','public.character_class_command_v1(jsonb,jsonb)','EXECUTE') AS endpoint,
      has_schema_privilege('service_role','private','USAGE') AS private_usage,
      has_function_privilege('inkborne_class_origin_owner','private.coordinate_first_class_command_v1(jsonb,jsonb)','EXECUTE') AS class_coordinator`)).rows)
      .toEqual([{endpoint:false,private_usage:false,class_coordinator:false}]);
    expect((await db.query("SELECT has_table_privilege('postgres','private.class_writer_acceptance_v1','SELECT') AS journal")).rows).toEqual([{journal:false}]);
  });
  it('retains exact new private owner and intended caller EXEC after grouped closure',async()=>{
    const matrix:[string,string[]][]=[
      ['private.resolve_first_class_command_v1(jsonb,uuid,uuid,jsonb)',['inkborne_class_origin_owner','postgres']],
      ['private.finish_first_class_choices_revision_v1(jsonb,uuid)',['inkborne_hit_die_authority_owner','inkborne_class_origin_owner']],
    ];
    for(const[signature,allowed]of matrix)for(const role of ['postgres','inkborne_class_origin_owner','inkborne_hit_die_authority_owner',
      'inkborne_character_command_gateway_owner','anon','authenticated','service_role'])
      expect((await db.query<{allowed:boolean}>('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,signature])).rows[0].allowed)
        .toBe(allowed.includes(role));
  });
  it('refuses direct assigned phase without the actual native OLD/NEW callback',async()=>{
    await realPendingProof();
    await refusal(async()=>{await db.exec('SET LOCAL ROLE inkborne_hit_die_authority_owner');
      return db.exec("UPDATE private.class_first_acquisition_proofs_v1 SET phase='assigned'");},'42501','first_class_assignment_requires_native_callback');
  });
  it('permits exact trusted-owner native UPDATE provenance but rejects a forged observed tuple',async()=>{
    const {inputs}=await realPendingProof();
    // This trusted isolated owner has the same native UPDATE capability as the
    // reviewed writer. It is not API access or proof of writer function identity.
    await db.exec('SET LOCAL ROLE inkborne_hit_die_authority_owner');
    const expectedParent=(inputs.expected_after_graph as Row).parent as Row;
    await db.query('UPDATE public.characters SET choices=$1 WHERE id=$2',[expectedParent.choices,target]);
    await db.exec('RESET ROLE');
    expect((await db.query('SELECT phase FROM private.class_first_acquisition_proofs_v1')).rows).toEqual([{phase:'assigned'}]);
    await refusal(async()=>{await db.exec('SET LOCAL ROLE inkborne_hit_die_authority_owner');
      return db.exec("UPDATE private.class_first_acquisition_proofs_v1 SET phase='observed',observed_parent='{}',observed_order='{}'");},'23514');
  });
  it('refuses a self-consistent fake first proof with no sealed native journal',async()=>{
    const parent=(await db.query<{row:Row}>("SELECT to_jsonb(c)||jsonb_build_object('action_revision',action_revision::text) AS row FROM public.characters c WHERE id=$1",[target])).rows[0].row;
    const order=(await db.query<{row:Row}>("SELECT to_jsonb(o)||jsonb_build_object('producer_revision',producer_revision::text) AS row FROM private.character_projection_order_v1 o WHERE character_id=$1",[target])).rows[0].row;
    await refusal(async()=>{
      await db.exec('SET LOCAL ROLE inkborne_hit_die_authority_owner');
      return db.query(`INSERT INTO private.class_first_acquisition_proofs_v1 SELECT * FROM jsonb_populate_record(NULL::private.class_first_acquisition_proofs_v1,$1)`,[
        {acceptance_id:id(999),transaction_id:(await db.query<{xid:string}>('SELECT pg_current_xact_id()::text AS xid')).rows[0].xid,
          target_character_id:target,verified_actor_id:actor,operation_id:operation,mode:'first_add_class_choices',
          before_action_revision:0,after_action_revision:1,before_class_revision:0,after_class_revision:1,before_parent:parent,before_order:order,
          expected_after_graph:{parent:{...parent,action_revision:'1'},order:{...order,producer_revision:'1'}},
          planned_rows:[{relation_key:'origin',row_key:[target],before_row:{},after_row:{}}],phase:'pending',observed_parent:null,observed_order:null}]);
    },'42501','first_class_journal_unavailable');
  });
  it.each(['controller','choices','active','origin','occurrence','receipt','order','finalized'])(
    'rolls back every earlier row when a native %s phase refuses',async phase=>{
      const mapping:Record<string,[string,string,string]>={
        controller:['public.character_content_refs','INSERT',"NEW.feature_grant_id IS NULL"],
        choices:['public.characters','UPDATE',"NEW.choices IS DISTINCT FROM OLD.choices"],
        active:['public.character_spells','INSERT','true'],
        origin:['private.character_class_origin_v1','UPDATE','true'],
        occurrence:['private.character_class_occurrences_v1','INSERT','true'],
        receipt:['private.character_class_commands_v1','INSERT','true'],
        order:['private.character_projection_order_v1','UPDATE',"NEW.pins IS DISTINCT FROM OLD.pins"],
        finalized:['private.class_writer_acceptance_v1','UPDATE','NEW.finalized AND NOT OLD.finalized'],
      };
      const[relation,event,condition]=mapping[phase];
      await db.exec(`CREATE FUNCTION private.fixture_phase_refusal() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF ${condition} THEN RAISE EXCEPTION 'fixture_phase_refusal' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fixture_phase_refusal BEFORE ${event} ON ${relation} FOR EACH ROW EXECUTE FUNCTION private.fixture_phase_refusal();`);
      await refusal(()=>call(),'23514','fixture_phase_refusal');
    });
  it('refuses a later BEFORE trigger changing the native choices tuple and rolls back the whole command',async()=>{
    await db.exec(`CREATE FUNCTION private.fixture_change_first_choices() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.choices:=NEW.choices||'{"unexpected":true}'::jsonb; RETURN NEW; END $$;
      CREATE TRIGGER i_fixture_change_first_choices BEFORE UPDATE OF choices ON public.characters
      FOR EACH ROW EXECUTE FUNCTION private.fixture_change_first_choices();`);
    await refusal(()=>call(),'23514','first_class_asi_prune_native_tuple_mismatch');
  });
  it('keeps original general Auth and all global gates/readiness disabled after a genuine command',async()=>{
    await call();
    for(const [name,role]of [['private.require_class_origin_auth_v1','inkborne_class_origin_owner'],
      ['private.require_verified_hit_die_auth_v1','inkborne_hit_die_authority_owner']]){
      await db.exec(`SAVEPOINT auth_denial;SET LOCAL ROLE ${role}`);
      await expect(db.query(`SELECT ${name}($1)`,[context()])).rejects.toMatchObject({code:'P0001',message:'auth_unavailable'});
      await db.exec('ROLLBACK TO SAVEPOINT auth_denial;RELEASE SAVEPOINT auth_denial');
    }
    expect((await db.query('SELECT enabled FROM private.class_origin_gate_v1')).rows).toEqual([{enabled:false}]);
    expect((await db.query('SELECT count(*)::integer AS count FROM private.character_writer_readiness_v1 WHERE NOT ready')).rows).toEqual([{count:13}]);
  });
  it.each([
    "ALTER TABLE public.characters DISABLE TRIGGER prune_inactive_asi_choices_before_choices",
    "ALTER POLICY class_first_proof_class_read ON private.class_first_acquisition_proofs_v1 USING(false)",
    "GRANT SELECT(verified_actor_id) ON private.class_first_protected_plans_v1 TO inkborne_class_origin_owner",
    "GRANT UPDATE(observed_parent) ON private.class_first_acquisition_proofs_v1 TO inkborne_class_origin_owner",
    "ALTER TABLE private.class_first_acquisition_proofs_v1 ADD CONSTRAINT fixture_extra_check CHECK(true)",
    "CREATE FUNCTION private.fixture_extra_proof_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE TRIGGER fixture_extra BEFORE UPDATE ON private.class_first_acquisition_proofs_v1 FOR EACH ROW EXECUTE FUNCTION private.fixture_extra_proof_trigger()",
    "CREATE ROLE fixture_extra; ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO fixture_extra",
  ])('rejects proof/plan/schema/default-ACL drift and rolls back all installation effects %#',async mutation=>{
    const isolated=new PGlite({loadDataDir:preWriterDump});
    try{
      await isolated.waitReady;await isolated.exec('SET SESSION AUTHORIZATION supabase_admin');await isolated.exec(mutation);
      const before=(await isolated.query("SELECT prosrc FROM pg_proc WHERE oid='private.hit_die_character_revision_v1()'::regprocedure")).rows;
      await expect(isolated.exec(stage)).rejects.toMatchObject({code:'42501'});await isolated.exec('ROLLBACK');
      expect((await isolated.query("SELECT to_regprocedure('public.character_class_command_v1(jsonb,jsonb)') AS endpoint,to_regclass('pg_temp.inkborne_first_proof_shape_v1') AS scratch")).rows)
        .toEqual([{endpoint:null,scratch:null}]);
      expect((await isolated.query("SELECT prosrc FROM pg_proc WHERE oid='private.hit_die_character_revision_v1()'::regprocedure")).rows).toEqual(before);
    }finally{await isolated.close();}
  });
});
