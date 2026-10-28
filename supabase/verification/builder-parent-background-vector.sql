-- Explicit disposable native fixture, NOT UI/JWT acceptance.
-- Requires an actual app-created, unawarded original Rogue1/Acolyte with
-- rogue-expertise-1=[skill-insight,thieves-tools]. Never writes Auth/proofs,
-- parent rows or protected refs directly. Two private background INSERTs use
-- the real snapshot trigger; every fixture and command rolls back together.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
CREATE TEMP TABLE parent_background_input ON COMMIT DROP AS
 SELECT :'character_id'::uuid AS target,:'actor_id'::uuid AS actor;
CREATE TEMP TABLE parent_background_result(value jsonb) ON COMMIT DROP;
DO $vector$
DECLARE target uuid; actor uuid; system uuid; session uuid; expiry bigint; context jsonb; request jsonb; result jsonb;
  root_a uuid:=gen_random_uuid(); root_b uuid:=gen_random_uuid(); run_tag text:=replace(gen_random_uuid()::text,'-','');
  old_row public.characters%ROWTYPE; next_row public.characters%ROWTYPE; initial_row public.characters%ROWTYPE;
  original jsonb; other_parents jsonb; updated bigint; revision bigint; item record; cases jsonb:='[]'; fixtures jsonb;
  prior_graph jsonb; next_graph jsonb; expected_writes integer; actual_writes bigint;
BEGIN
  IF current_user<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    OR current_setting('track_counts')<>'on' THEN RAISE EXCEPTION 'native_fixture_role_or_counter_unavailable'; END IF;
  SELECT i.target,i.actor INTO target,actor FROM pg_temp.parent_background_input i;
  SELECT * INTO initial_row FROM public.characters c WHERE c.id=target AND c.user_id=actor;
  IF NOT FOUND OR initial_row.level IS DISTINCT FROM 1 OR initial_row.choices->>'background' IS DISTINCT FROM 'acolyte'
    OR initial_row.choices#>>'{classes,0,slug}' IS DISTINCT FROM 'rogue' OR jsonb_array_length(initial_row.choices->'classes') IS DISTINCT FROM 1
    OR initial_row.choices#>'{resolved_choices,rogue-expertise-1}' IS DISTINCT FROM '["skill-insight","thieves-tools"]'::jsonb
    OR NOT private.enrolled_character_parent_v1(target)
    OR EXISTS(SELECT 1 FROM public.character_inventory WHERE character_id=target)
    OR EXISTS(SELECT 1 FROM public.character_starting_grants WHERE character_id=target AND status<>'eligible')
    OR NOT EXISTS(SELECT 1 FROM private.class_first_acquisition_proofs_v1 WHERE target_character_id=target AND phase='observed' AND verified_actor_id=actor)
    OR NOT EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.slug_snapshot='acolyte' AND v.content_type_snapshot='background' AND v.source_snapshot='srd') THEN
    RAISE EXCEPTION 'genuine_unawarded_rogue_required'; END IF;
  original:=private.builder_original_occurrence_v1(target); system:=initial_row.system_id;
  IF original->>'id' IS DISTINCT FROM initial_row.choices#>>'{classes,0,occurrence_id}' THEN RAISE EXCEPTION 'original_provenance_unavailable'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') INTO other_parents FROM public.characters c WHERE c.id<>target;
  -- Existing real Auth session/profile rows are read only. These local SQL
  -- claims exercise SQL role admission; they are deliberately not JWT proof.
  SELECT s.id INTO session FROM auth.sessions s WHERE s.user_id=actor
    AND (s.not_after IS NULL OR s.not_after>clock_timestamp()+interval '5 minutes') ORDER BY s.created_at DESC LIMIT 1;
  IF session IS NULL THEN RAISE EXCEPTION 'existing_live_session_required'; END IF;
  expiry:=floor(extract(epoch FROM clock_timestamp()))::bigint+240;
  context:=jsonb_build_object('context_version',1,'actor_id',actor,'session_id',session,
    'jwt_expires_at',to_char(to_timestamp(expiry) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',session,'exp',expiry)::text,true);
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  INSERT INTO public.content_definitions(id,system_id,content_type,slug,name,data,effects,source,scope,owner_id,version,is_retired)
  VALUES(root_a,system,'background','parent-native-'||run_tag||'-a','Native fixture A',
      '{"skills":["insight","religion"],"feature":{"name":"Native fixture","description":"Rollback-only fixture"}}','[]','homebrew','personal',actor,1,false),
    (root_b,system,'background','parent-native-'||run_tag||'-b','Native fixture B',
      '{"skills":["religion"],"feature":{"name":"Native fixture","description":"Rollback-only fixture"}}','[]','homebrew','personal',actor,1,false);
  SELECT jsonb_agg(jsonb_build_object('id',v.content_id,'version',v.version,'fingerprint',md5(to_jsonb(v)::text)) ORDER BY v.content_id) INTO fixtures
    FROM public.content_versions v WHERE v.content_id IN(root_a,root_b) AND v.version=1 AND v.owner_id_snapshot=actor
    AND v.source_snapshot='homebrew' AND v.scope_snapshot='personal' AND v.content_type_snapshot='background' AND v.system_id_snapshot=system;
  IF jsonb_array_length(fixtures) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'exact_private_native_snapshots_required'; END IF;
  FOR item IN SELECT * FROM (VALUES ('changed-one',root_a,1),('unchanged-zero',root_a,0),('changed-two',root_b,2)) v(label,content,writes) LOOP
    SELECT * INTO old_row FROM public.characters WHERE id=target;
    prior_graph:=private.builder_progression_full_graph_v1(target);
    updated:=pg_stat_get_xact_tuples_updated('public.characters'::regclass); revision:=old_row.action_revision; expected_writes:=item.writes;
    request:=jsonb_build_object('contract_version',1,'operation_id',gen_random_uuid(),'character_id',target,
      'command','select_background','fields',jsonb_build_object('content_id',item.content,'content_version',1));
    SET LOCAL ROLE authenticated;
    result:=public.character_builder_command_v1(context,request);
    RESET ROLE;
    SELECT * INTO next_row FROM public.characters WHERE id=target;
    next_graph:=private.builder_progression_full_graph_v1(target);
    actual_writes:=pg_stat_get_xact_tuples_updated('public.characters'::regclass)-updated;
    IF result->>'status' IS DISTINCT FROM 'applied' OR next_row.action_revision-revision IS DISTINCT FROM expected_writes::bigint
      OR actual_writes<>expected_writes
      OR private.builder_original_occurrence_v1(target) IS DISTINCT FROM original
      OR next_row.choices->'classes' IS DISTINCT FROM initial_row.choices->'classes'
      OR next_row.base_stats IS DISTINCT FROM initial_row.base_stats OR next_row.state IS DISTINCT FROM initial_row.state
      OR next_row.choices#>'{resolved_choices,rogue-expertise-1}' IS DISTINCT FROM
        (CASE WHEN item.label='changed-two' THEN '["thieves-tools"]'::jsonb ELSE '["skill-insight","thieves-tools"]'::jsonb END)
      OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
      OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1)
      OR (SELECT producer_revision FROM private.character_projection_order_v1 WHERE character_id=target)<>next_row.action_revision
      OR (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.characters c WHERE c.id<>target) IS DISTINCT FROM other_parents THEN
      RAISE EXCEPTION 'native_background_vector_refused'; END IF;
    IF item.label='unchanged-zero' AND (to_jsonb(next_row) IS DISTINCT FROM to_jsonb(old_row) OR next_graph IS DISTINCT FROM prior_graph) THEN
      RAISE EXCEPTION 'background_no_write_changed_parent_or_graph'; END IF;
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    cases:=cases||jsonb_build_array(jsonb_build_object('label',item.label,'physicalWrites',actual_writes,
      'beforeRevision',revision::text,'afterRevision',next_row.action_revision::text,
      'expertiseBefore',old_row.choices#>'{resolved_choices,rogue-expertise-1}',
      'expertiseAfter',next_row.choices#>'{resolved_choices,rogue-expertise-1}',
      'beforeGraphFingerprint',md5(prior_graph::text),'afterGraphFingerprint',md5(next_graph::text),
      'operationId',request->>'operation_id','deferredConstraintsForced',true));
  END LOOP;
  IF EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR has_schema_privilege('service_role','private','USAGE') THEN RAISE EXCEPTION 'closed_boundaries_required'; END IF;
  INSERT INTO pg_temp.parent_background_result VALUES(jsonb_build_object('kind','parent-background-native-vector-v1',
    'authenticationAccepted',false,'characterId',target,'actorId',actor,'fixtureScope','two private background inserts inside a rolled-back native transaction',
    'cases',cases,'privateFixtures',fixtures,'capsRemaining',0,'sealsRemaining',0));
END $vector$;
SELECT value FROM pg_temp.parent_background_result;
ROLLBACK;
