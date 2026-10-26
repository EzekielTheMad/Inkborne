-- Native SQL role/RLS negatives on a genuine unawarded app-created fixture.
-- This does not claim JWT authentication; actual HTTP negatives are separate.
-- psql -v character_id=<UUID> -v actor_id=<UUID> -f this-file.sql
-- All attempted mutations and allowed metadata probes roll back. No origin,
-- capability, seal, journal, Auth row or catalog fixture is manufactured.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
CREATE TEMP TABLE parent_case_input_v1 ON COMMIT DROP AS SELECT :'character_id'::uuid AS target,:'actor_id'::uuid AS actor;
CREATE TEMP TABLE parent_case_results_v1(role_name text,case_name text,outcome text,sqlstate text) ON COMMIT DROP;
DO $cases$
DECLARE target uuid; actor uuid; parent public.characters%ROWTYPE; role_name text; item record;
  next_state jsonb; next_scores jsonb; feature_slug text; ability text; statement text; actual_code text; affected bigint;
  before_value jsonb; after_value jsonb; saved public.characters%ROWTYPE;
BEGIN
  IF CURRENT_USER<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN
    RAISE EXCEPTION 'parent_cases_native_role_unavailable'; END IF;
  SELECT i.target,i.actor INTO target,actor FROM pg_temp.parent_case_input_v1 i;
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=actor;
  IF NOT FOUND OR NOT private.enrolled_character_parent_v1(target) OR private.builder_original_occurrence_v1(target)->>'id' IS NULL
    OR parent.action_revision>=9223372036854775807 OR jsonb_typeof(parent.state) IS DISTINCT FROM 'object' OR jsonb_typeof(parent.base_stats) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM public.character_starting_grants WHERE character_id=target AND status<>'eligible')
    OR parent.choices#>'{starting_equipment,confirmed}'='true'::jsonb
    OR (SELECT count(*) FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot='background' AND v.slug_snapshot=parent.choices->>'background')<>1 THEN
    RAISE EXCEPTION 'parent_cases_genuine_unawarded_background_fixture_required'; END IF;
  SELECT g.feature_slug INTO feature_slug FROM public.character_feature_grants g JOIN public.content_versions v
    ON v.content_id=g.feature_content_id AND v.version=g.feature_version WHERE g.character_id=target
      AND v.data_snapshot->>'feature_type'='asi' AND private.is_character_feature_grant_active(g.id)
      AND (SELECT count(*) FROM public.character_feature_grants x WHERE x.character_id=target AND x.feature_slug=g.feature_slug)=1
    ORDER BY g.feature_slug LIMIT 1;
  SELECT e.key INTO ability FROM jsonb_each(private.character_ability_scores(target,NULL,feature_slug,NULL)) e
    WHERE e.key IN ('strength','dexterity','constitution','intelligence','wisdom','charisma') AND jsonb_typeof(e.value)='number'
      AND (e.value#>>'{}')::numeric<=18 AND parent.choices#>ARRAY['asi_choices',feature_slug] IS DISTINCT FROM
        jsonb_build_object('mode','asi','allocations',jsonb_build_array(jsonb_build_object('ability',e.key,'amount',2))) ORDER BY e.key LIMIT 1;
  IF feature_slug IS NULL OR ability IS NULL OR jsonb_typeof(parent.base_stats->'constitution') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'parent_cases_earned_asi_fixture_required'; END IF;
  next_state:=parent.state||jsonb_build_object('current_hp',CASE WHEN parent.state->>'current_hp'='1' THEN 0 ELSE 1 END);
  next_scores:=parent.base_stats||jsonb_build_object('constitution',CASE WHEN (parent.base_stats->>'constitution')::integer<30
    THEN (parent.base_stats->>'constitution')::integer+1 ELSE 29 END);
  SELECT jsonb_build_object('parent',to_jsonb(c),'graph',private.builder_progression_full_graph_v1(c.id),
    'order',(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=target),
    'awards',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.character_starting_grants a WHERE character_id=target),
    'receipts',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE character_id=target),
    'draws',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE character_id=target),
    'history',(SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE character_id=target),
    'first_proofs',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.acceptance_id),'[]') FROM private.class_first_acquisition_proofs_v1 p WHERE target_character_id=target))
    INTO before_value FROM public.characters c WHERE id=target;
  FOREACH role_name IN ARRAY ARRAY['authenticated','service_role'] LOOP
    FOR item IN SELECT * FROM (VALUES
      ('state',format('UPDATE public.characters SET state=%L::jsonb WHERE id=%L::uuid',next_state,target)),
      ('scores',format('UPDATE public.characters SET base_stats=%L::jsonb WHERE id=%L::uuid',next_scores,target)),
      ('choices',format('UPDATE public.characters SET choices=choices||''{"parent_verification_probe":true}''::jsonb WHERE id=%L::uuid',target)),
      ('level',format('UPDATE public.characters SET level=%s WHERE id=%L::uuid',CASE WHEN parent.level<20 THEN parent.level+1 ELSE parent.level-1 END,target)),
      ('system',format('UPDATE public.characters SET system_id=%L::uuid WHERE id=%L::uuid',gen_random_uuid(),target)),
      ('campaign',format('UPDATE public.characters SET campaign_id=%L::uuid WHERE id=%L::uuid',gen_random_uuid(),target)),
      ('archive',format('UPDATE public.characters SET archived=NOT archived WHERE id=%L::uuid',target)),
      ('owner',format('UPDATE public.characters SET user_id=%L::uuid WHERE id=%L::uuid',gen_random_uuid(),target)),
      ('identity',format('UPDATE public.characters SET id=%L::uuid WHERE id=%L::uuid',gen_random_uuid(),target)),
      ('revision',format('UPDATE public.characters SET action_revision=action_revision+1 WHERE id=%L::uuid',target)),
      ('delete',format('DELETE FROM public.characters WHERE id=%L::uuid',target)),
      ('state_patch',format('SELECT public.patch_character_state(%L::uuid,%L::jsonb)',target,next_state)),
      ('state_cas',format('SELECT * FROM public.patch_character_state_if_current(%L::uuid,%L::jsonb,%L::jsonb)',target,parent.state,next_state)),
      ('ability_rpc',format('SELECT * FROM public.save_character_abilities(%L::uuid,''manual'',%L::jsonb,%L,%L::jsonb)',target,next_scores,parent.choices->>'ability_method',parent.base_stats)),
      ('background_rpc',format('SELECT * FROM public.set_character_background(%L::uuid,NULL,NULL)',target)),
      ('asi_rpc',format('SELECT * FROM public.set_character_asi_choice(%L::uuid,%L,''asi'',%L::jsonb,NULL,NULL)',target,feature_slug,
        jsonb_build_array(jsonb_build_object('ability',ability,'amount',2))))
    ) vectors(name,sql) LOOP
      actual_code:=NULL; affected:=NULL;
      BEGIN
        EXECUTE format('SET LOCAL ROLE %I',role_name);
        PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role',role_name)::text,true);
        PERFORM set_config('request.jwt.claim.sub',actor::text,true);
        EXECUTE item.sql;
        GET DIAGNOSTICS affected=ROW_COUNT;
        -- The maintained catalog has no authenticated DELETE policy. Its
        -- statement guard still runs, but RLS hides every candidate row.
        IF role_name='authenticated' AND item.name='delete' AND affected=0 THEN
          actual_code:='00000';
        ELSE
          RAISE EXCEPTION 'parent_cases_unexpected_mutation_success' USING ERRCODE='ZP001';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE;
      END;
      EXECUTE 'SET LOCAL ROLE postgres';
      IF role_name='authenticated' AND item.name='delete' THEN
        IF actual_code IS DISTINCT FROM '00000' OR affected IS DISTINCT FROM 0 THEN
          RAISE EXCEPTION 'parent_cases_authenticated_delete_outcome_changed'; END IF;
        INSERT INTO pg_temp.parent_case_results_v1 VALUES(role_name,item.name,'rls_no_rows_unchanged',actual_code);
      ELSE
        IF actual_code IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'parent_cases_unexpected_sqlstate: % % %',role_name,item.name,actual_code; END IF;
        INSERT INTO pg_temp.parent_case_results_v1 VALUES(role_name,item.name,'refused_unchanged',actual_code);
      END IF;
    END LOOP;
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I',role_name);
      PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role',role_name)::text,true);
      PERFORM set_config('request.jwt.claim.sub',actor::text,true);
      UPDATE public.characters SET name=name||' metadata probe' WHERE id=target RETURNING * INTO saved;
      IF NOT FOUND OR saved.name IS DISTINCT FROM parent.name||' metadata probe' OR saved.action_revision<>parent.action_revision THEN
        RAISE EXCEPTION 'parent_cases_metadata_behavior_changed'; END IF;
      RAISE EXCEPTION 'parent_cases_metadata_observed_rollback' USING ERRCODE='ZP002';
    EXCEPTION WHEN SQLSTATE 'ZP002' THEN NULL;
    END;
    EXECUTE 'SET LOCAL ROLE postgres';
    INSERT INTO pg_temp.parent_case_results_v1 VALUES(role_name,'metadata','allowed_then_rolled_back','00000');
  END LOOP;
  SELECT jsonb_build_object('parent',to_jsonb(c),'graph',private.builder_progression_full_graph_v1(c.id),
    'order',(SELECT to_jsonb(o) FROM private.character_projection_order_v1 o WHERE character_id=target),
    'awards',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM public.character_starting_grants a WHERE character_id=target),
    'receipts',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_builder_receipts_v1 r WHERE character_id=target),
    'draws',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.occurrence_id,d.level),'[]') FROM private.character_builder_hp_draws_v1 d WHERE character_id=target),
    'history',(SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.operation_id),'[]') FROM private.character_builder_progression_history_v1 h WHERE character_id=target),
    'first_proofs',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.acceptance_id),'[]') FROM private.class_first_acquisition_proofs_v1 p WHERE target_character_id=target))
    INTO after_value FROM public.characters c WHERE id=target;
  IF before_value IS DISTINCT FROM after_value OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1) THEN RAISE EXCEPTION 'parent_cases_retained_state_changed'; END IF;
END $cases$;
SELECT jsonb_build_object('kind','builder-parent-admission-native-sql-negatives-v1','authenticationAccepted',false,
 'caseCount',count(*),'cases',jsonb_agg(jsonb_build_object('role',role_name,'case',case_name,'outcome',outcome,'sqlstate',sqlstate)
   ||CASE WHEN outcome='rls_no_rows_unchanged' THEN jsonb_build_object('affectedRows',0) ELSE '{}'::jsonb END ORDER BY role_name,case_name))
 FROM pg_temp.parent_case_results_v1;
ROLLBACK;
