-- Read-only F3 pre/post profile, derived from the finite parent closure reader.
-- Counts/digests only for character/catalog rows; no Auth payload or credentials.
-- Parent and ancestry installation plus full A4 acceptance are prerequisites.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
WITH retained AS (
 SELECT 'public.characters' AS relation,count(*) AS count,md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) AS fingerprint FROM public.characters r
 UNION ALL SELECT 'public.character_content_refs',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_content_refs r
 UNION ALL SELECT 'public.character_feature_grants',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_feature_grants r
 UNION ALL SELECT 'public.character_spell_grants',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_spell_grants r
 UNION ALL SELECT 'public.character_spells',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_spells r
 UNION ALL SELECT 'public.character_inventory',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_inventory r
 UNION ALL SELECT 'public.character_starting_grants',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM public.character_starting_grants r
 UNION ALL SELECT 'private.character_class_origin_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_class_origin_v1 r
 UNION ALL SELECT 'private.character_class_commands_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_class_commands_v1 r
 UNION ALL SELECT 'private.character_builder_receipts_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_builder_receipts_v1 r
 UNION ALL SELECT 'private.character_projection_order_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_projection_order_v1 r
 UNION ALL SELECT 'private.character_builder_hp_draws_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_builder_hp_draws_v1 r
 UNION ALL SELECT 'private.character_builder_class_acquisitions_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_builder_class_acquisitions_v1 r
 UNION ALL SELECT 'private.character_class_occurrences_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_class_occurrences_v1 r
 UNION ALL SELECT 'private.character_builder_progression_history_v1',count(*),md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')::text) FROM private.character_builder_progression_history_v1 r
)
SELECT jsonb_build_object(
 'kind','earned-racial-installation-profile-v1','runtimeRole',current_user,
 'rows',(SELECT jsonb_object_agg(relation,jsonb_build_object('count',count,'fingerprint',fingerprint)) FROM retained),
 'firstClassProofs',(SELECT jsonb_build_object('count',count(*),'fingerprint',md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.acceptance_id),'[]')::text)) FROM private.class_first_acquisition_proofs_v1 p),
 'catalog',(SELECT jsonb_build_object('count',count(*),'fingerprint',md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY id),'[]')::text)) FROM public.content_definitions d),
 'snapshots',(SELECT jsonb_build_object('count',count(*),'fingerprint',md5(COALESCE(jsonb_agg(to_jsonb(v) ORDER BY id),'[]')::text)) FROM public.content_versions v),
 'chainRoots',(SELECT jsonb_object_agg(d.content_type||'/'||d.slug,jsonb_build_object('id',d.id,'version',d.version,'name',d.name,'data',d.data,'effects',d.effects))
   FROM public.content_definitions d WHERE (d.content_type,d.slug) IN (('subclass','fiend'),('subclass','draconic'),('subrace','hill-dwarf'),('race','tiefling'))),
 'functions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,
   'bodyMd5',md5(replace(p.prosrc,E'\r\n',E'\n')),'profile',to_jsonb(p)-'prosrc',
   'owner',pg_get_userbyid(p.proowner),'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'returnType',p.prorettype::regtype::text,
   'executeAcl',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]') FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a),
   'execute',jsonb_build_object(
     'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
     'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'))) ORDER BY p.oid),'[]')
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')),
 'wires',(SELECT COALESCE(jsonb_agg(jsonb_build_object('oid',t.oid,'relation',t.tgrelid::regclass::text,
   'callback',t.tgfoid::regprocedure::text,'profile',to_jsonb(t)) ORDER BY t.oid),'[]')
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'relationPrivileges',(SELECT COALESCE(jsonb_agg(jsonb_build_object('oid',c.oid,'relation',c.oid::regclass::text,
   'owner',c.relowner,'acl',c.relacl,'rowSecurity',c.relrowsecurity,'forceRowSecurity',c.relforcerowsecurity) ORDER BY c.oid),'[]')
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S','f')),
 'policies',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]') FROM pg_policy p
   JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',nspname,'owner',nspowner,'acl',nspacl) ORDER BY oid)
   FROM pg_namespace WHERE nspname IN ('public','private')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'superuser',rolsuper,'inherit',rolinherit,
   'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls,
   'connectionLimit',rolconnlimit,'validUntil',rolvaliduntil,'config',rolconfig) ORDER BY oid) FROM pg_roles),
 'memberships',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY to_jsonb(m)::text),'[]') FROM pg_auth_members m),
 'closure',jsonb_build_object('caps',(SELECT count(*) FROM private.character_builder_capabilities_v1),
   'seals',(SELECT count(*) FROM private.character_parent_admissions_v1),'parentInstalled',to_regprocedure('private.enrolled_character_parent_v1(uuid)') IS NOT NULL,
   'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),
   'readyCount',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
   'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
   'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
   'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')));
ROLLBACK;
