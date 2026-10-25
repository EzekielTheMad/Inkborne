-- Read-only installed-profile evidence, after HP and parent companions.
-- The 32 signatures include all eleven instrumented writers and all seven
-- preserved original trigger callbacks (R09 appears once). A missing function
-- remains an explicit found=false entry; the caller must reject it.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'kind','builder-parent-admission-installed-catalog-v1',
 'runtimeRole',current_user,
 'postgresPosture',(SELECT jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls) FROM pg_roles WHERE rolname='postgres'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',wanted.signature,'found',p.oid IS NOT NULL,'owner',pg_get_userbyid(p.proowner),
   'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',p.proacl::text,
   'bodyMd5',md5(replace(p.prosrc,E'\r\n',E'\n')),'bodyBytes',octet_length(replace(p.prosrc,E'\r\n',E'\n'))) ORDER BY wanted.signature)
  FROM (VALUES
   ('private.enrolled_character_parent_v1(uuid)'),('private.lock_enrolled_parent_guard_v1()'),
   ('public.lock_character_parent_write_guard_v1()'),('private.character_parent_mechanics_v1(jsonb)'),
   ('private.first_class_parent_admission_v1(uuid)'),('private.seal_builder_parent_admission_v1(uuid,jsonb)'),
   ('private.observe_unchanged_builder_background_v1(uuid,uuid,integer)'),('private.enrolled_parent_statement_guard_v1()'),
   ('private.enrolled_parent_before_v1()'),('private.enrolled_parent_after_revision_v1()'),
   ('private.enrolled_parent_observed_v1()'),('private.finish_parent_admission_v1(uuid,text)'),
   ('private.require_parent_admission_finished_v1()'),('private.hit_die_character_revision_v1()'),
   ('private.builder_multiclass_max_hp_v1(uuid,jsonb,jsonb)'),
   ('private.apply_builder_catalog_command_v1(uuid,text,jsonb)'),
   ('private.apply_builder_progression_graph_v1(uuid,jsonb,jsonb,integer)'),
   ('private.apply_builder_details_v1(uuid,jsonb)'),
   ('public.character_builder_command_before_catalog_v1(jsonb,jsonb)'),
   ('public.commit_character_builder_equipment_v1(jsonb,jsonb)'),
   ('public.save_character_abilities(uuid,text,jsonb,text,jsonb)'),('public.patch_character_state_if_current(uuid,jsonb,jsonb)'),
   ('public.set_character_background(uuid,uuid,integer)'),('public.set_character_asi_choice(uuid,text,text,jsonb,uuid,integer)'),
   ('private.finish_builder_step_v1(jsonb,uuid)'),('private.observe_first_class_choices_revision_v1(jsonb,uuid)'),
   ('private.enforce_asi_choice_map_boundary()'),('private.enforce_background_choice_map_boundary()'),
   ('private.hit_die_order_revision_rebind_v1()'),('private.prune_inactive_asi_choices_before_choices()'),
   ('private.prune_inactive_feature_refs_after_choices()'),('private.validate_character_content_boundaries()')
  ) wanted(signature) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(wanted.signature)),
 'parentTriggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'mask',tgtype,'enabled',tgenabled,
   'callback',tgfoid::regprocedure::text,'deferred',tgdeferrable,'initiallyDeferred',tginitdeferred,
   'columns',tgattr::text,'arguments',tgnargs,'predicate',pg_get_expr(tgqual,tgrelid)) ORDER BY tgname)
  FROM pg_trigger WHERE tgrelid='public.characters'::regclass AND NOT tgisinternal),
 'deferredClosure',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'relation',tgrelid::regclass::text,
   'callback',tgfoid::regprocedure::text,'enabled',tgenabled,'deferred',tgdeferrable,'initiallyDeferred',tginitdeferred) ORDER BY tgname)
  FROM pg_trigger WHERE tgname IN ('parent_admission_finished','builder_parent_admission_finished')),
 'roles',(SELECT jsonb_object_agg(role,jsonb_build_object('privateUsage',has_schema_privilege(role,'private','USAGE'),
   'bridge',has_function_privilege(role,'public.lock_character_parent_write_guard_v1()','EXECUTE'),
   'originalInvokerUnion',has_function_privilege(role,'public.save_character_abilities(uuid,text,jsonb,text,jsonb)','EXECUTE')
     OR has_function_privilege(role,'public.patch_character_state_if_current(uuid,jsonb,jsonb)','EXECUTE'),
   'lookup',has_function_privilege(role,'private.enrolled_character_parent_v1(uuid)','EXECUTE'),
   'seal',has_function_privilege(role,'private.seal_builder_parent_admission_v1(uuid,jsonb)','EXECUTE'),
   'finish',has_function_privilege(role,'private.finish_parent_admission_v1(uuid,text)','EXECUTE')))
  FROM unnest(ARRAY['anon','authenticated','service_role']) role),
 'capsRemaining',(SELECT count(*) FROM private.character_builder_capabilities_v1),
 'sealsRemaining',(SELECT count(*) FROM private.character_parent_admissions_v1),
 'readinessCount',(SELECT count(*) FROM private.character_writer_readiness_v1),
 'readyCount',(SELECT count(*) FROM private.character_writer_readiness_v1 WHERE ready),
 'classGate',EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled),
 'hitDieGate',EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
);
ROLLBACK;
