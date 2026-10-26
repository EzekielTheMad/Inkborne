-- Read-only final A4 profile. Keep character assertions in the story readback;
-- this binds the accepted installed parent fence and catalog for A6 publication.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
SELECT jsonb_build_object(
 'catalog',jsonb_build_object('definitions',(SELECT count(*) FROM public.content_definitions),
   'versions',(SELECT count(*) FROM public.content_versions),
   'chainRoots',(SELECT jsonb_object_agg(d.content_type||'/'||d.slug,jsonb_build_object(
     'id',d.id,'version',d.version,'name',d.name,'data',d.data,'effects',d.effects))
     FROM public.content_definitions d WHERE (d.content_type,d.slug) IN
     (('subclass','fiend'),('subclass','draconic'),('subrace','hill-dwarf'),('race','tiefling')))),
 'snapshotsFingerprint',(SELECT md5(COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]')::text) FROM public.content_versions v),
 'functions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,
   'bodyMd5',md5(replace(p.prosrc,E'\r\n',E'\n')),'profile',to_jsonb(p)-'prosrc',
   'owner',pg_get_userbyid(p.proowner),'execute',jsonb_build_object(
     'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
     'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
     'service_role',has_function_privilege('service_role',p.oid,'EXECUTE'))) ORDER BY p.oid),'[]')
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private')),
 'wires',(SELECT COALESCE(jsonb_agg(jsonb_build_object('oid',t.oid,'relation',t.tgrelid::regclass::text,
   'callback',t.tgfoid::regprocedure::text,'profile',to_jsonb(t)) ORDER BY t.oid),'[]')
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'superuser',rolsuper,'inherit',rolinherit,
   'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls,
   'connectionLimit',rolconnlimit,'validUntil',rolvaliduntil,'config',rolconfig) ORDER BY oid) FROM pg_roles),
 'memberships',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY to_jsonb(m)::text),'[]') FROM pg_auth_members m),
 'closure',jsonb_build_object('caps',(SELECT count(*) FROM private.character_builder_capabilities_v1),
   'seals',(SELECT count(*) FROM private.character_parent_admissions_v1),
   'parentInstalled',to_regprocedure('private.enrolled_character_parent_v1(uuid)') IS NOT NULL,
   'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),
   'readyCount',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
   'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
   'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
   'servicePrivateUsage',has_schema_privilege('service_role','private','USAGE')));
ROLLBACK;
