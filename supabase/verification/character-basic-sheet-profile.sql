BEGIN READ ONLY;
WITH entries AS (
 SELECT p.oid,p.oid::regprocedure::text AS signature,p.proowner,p.prosecdef,p.proconfig,
   md5(replace(p.prosrc,E'\r\n',E'\n')) AS body_md5,
   has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
   has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous,
   has_function_privilege('service_role',p.oid,'EXECUTE') AS service
 FROM pg_proc p WHERE p.oid IN (
   to_regprocedure('public.character_manual_hp_command_v1(jsonb,jsonb)'),
   to_regprocedure('public.character_campaign_assignment_v1(jsonb,jsonb)'))
)
SELECT jsonb_build_object('kind','character-basic-sheet-profile-v1',
 'finiteEntries',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY signature),'[]') FROM entries e),
 'checks',jsonb_build_object(
   'twoFiniteAuthenticatedEntries',(SELECT count(*)=2 AND bool_and(authenticated AND NOT anonymous AND NOT service
     AND proowner='postgres'::regrole AND prosecdef AND proconfig=ARRAY['search_path=""']::text[]) FROM entries),
   'privateHelpersClosed',NOT has_function_privilege('authenticated','private.basic_sheet_children_v1(uuid)','EXECUTE')
     AND NOT has_function_privilege('service_role','private.finish_basic_sheet_v1(jsonb,uuid,text,jsonb,jsonb)','EXECUTE'),
   'oldProducerRolesClosed',NOT EXISTS(SELECT 1 FROM entries e CROSS JOIN unnest(ARRAY[
       'inkborne_class_origin_owner','inkborne_hit_die_authority_owner','inkborne_character_command_gateway_owner']) r(name)
     WHERE has_function_privilege(r.name,e.oid,'EXECUTE')),
   'genericCasUnchanged',(SELECT md5(replace(prosrc,E'\r\n',E'\n'))='30f211de2e633e567b0b042ac4d14ffb'
     FROM pg_proc WHERE oid='public.patch_character_state_if_current(uuid,jsonb,jsonb)'::regprocedure),
   'noPendingAdmissions',NOT EXISTS(SELECT 1 FROM private.character_parent_admissions_v1),
   'noBuilderCapabilities',NOT EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1),
   'readinessClosed',(SELECT count(*)=13 AND NOT bool_or(ready) FROM private.character_writer_readiness_v1),
   'classGateClosed',NOT EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
   'hitDieGateClosed',NOT EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled),
   'servicePrivateClosed',NOT has_schema_privilege('service_role','private','USAGE')));
ROLLBACK;
