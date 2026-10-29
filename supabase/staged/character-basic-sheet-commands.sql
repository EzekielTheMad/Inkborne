-- CSJ local overlay after the complete current builder profile. Two finite
-- authenticated producers; ordinary CAS/direct UPDATE and all gates stay closed.
BEGIN;
DO $preflight$
DECLARE item record;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.to_regprocedure('public.character_manual_hp_command_v1(jsonb,jsonb)') IS NOT NULL
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'basic_sheet_installation_unavailable' USING ERRCODE='42501'; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('private.enrolled_parent_before_v1()','0f7b63f7cd814edbfff30587fe222723'),
    ('private.character_parent_mechanics_v1(jsonb)','970b0e0619cdc5ca2ef38fe5eb044420'),
    ('public.patch_character_state_if_current(uuid,jsonb,jsonb)','30f211de2e633e567b0b042ac4d14ffb')
  ) wanted(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(item.signature)
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))=item.body_md5
      AND proowner='postgres'::pg_catalog.regrole AND proconfig=ARRAY['search_path=""']::text[]) THEN
      RAISE EXCEPTION 'basic_sheet_dependency_changed' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (SELECT pg_catalog.pg_get_constraintdef(oid) FROM pg_catalog.pg_constraint
      WHERE conrelid='private.character_parent_admissions_v1'::pg_catalog.regclass
        AND conname='character_parent_admissions_v1_source_check') IS DISTINCT FROM
      'CHECK ((source = ANY (ARRAY[''builder''::text, ''first_class''::text])))' THEN
    RAISE EXCEPTION 'basic_sheet_source_constraint_changed' USING ERRCODE='42501'; END IF;
END $preflight$;
CREATE TEMP TABLE basic_sheet_functions_v1 ON COMMIT DROP AS
  SELECT p.oid,pg_catalog.to_jsonb(p) AS profile FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private');
CREATE TEMP TABLE basic_sheet_wires_v1 ON COMMIT DROP AS
  SELECT t.oid,pg_catalog.to_jsonb(t) AS wire FROM pg_catalog.pg_trigger t;

ALTER TABLE private.character_parent_admissions_v1 DROP CONSTRAINT character_parent_admissions_v1_source_check;
ALTER TABLE private.character_parent_admissions_v1 ADD CONSTRAINT character_parent_admissions_v1_source_check
  CHECK(source IN ('builder','first_class','hp_manual','campaign_assignment'));

-- The only new admission branch consumes an exact finite producer seal. It
-- cannot be armed by a caller GUC, generic RPC, context claim or builder cap.
DO $finite_before$
DECLARE original pg_catalog.pg_proc%ROWTYPE; definition text; needle text; insertion text; replacement text;
BEGIN
  SELECT * INTO original FROM pg_catalog.pg_proc WHERE oid='private.enrolled_parent_before_v1()'::pg_catalog.regprocedure;
  definition:=pg_catalog.pg_get_functiondef(original.oid);
  needle:='  IF cap_count=0 AND first_proof IS NULL AND before_value=after_value THEN RETURN NEW; END IF;';
  insertion:=$branch$  IF cap_count=0 AND first_proof IS NULL THEN
    SELECT * INTO seal FROM private.character_parent_admissions_v1
      WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=OLD.id AND sequence=1
        AND source IN ('hp_manual','campaign_assignment');
    IF FOUND THEN
      IF seal.phase<>'pending' OR NOT seal.write_required OR seal.before_parent IS DISTINCT FROM before_value
        OR NEW.action_revision IS DISTINCT FROM OLD.action_revision
        OR (after_value-'action_revision') IS DISTINCT FROM (seal.expected_parent-'action_revision')
        OR seal.expected_parent->>'action_revision' IS DISTINCT FROM (OLD.action_revision::numeric+1)::text
        OR (seal.source='hp_manual' AND (
          (after_value-ARRAY['state','action_revision']) IS DISTINCT FROM (before_value-ARRAY['state','action_revision'])
          OR (NEW.state-ARRAY['current_hp','temp_hp']) IS DISTINCT FROM (OLD.state-ARRAY['current_hp','temp_hp'])))
        OR (seal.source='campaign_assignment' AND (
          OLD.campaign_id IS NOT NULL OR NEW.campaign_id IS NULL
          OR (after_value-ARRAY['campaign_id','action_revision']) IS DISTINCT FROM (before_value-ARRAY['campaign_id','action_revision']))) THEN
        RAISE EXCEPTION 'basic_sheet_parent_not_admitted' USING ERRCODE='42501'; END IF;
      UPDATE private.character_parent_admissions_v1 SET phase='checked'
        WHERE transaction_id=seal.transaction_id AND character_id=seal.character_id AND sequence=1 AND phase='pending';
      IF NOT FOUND THEN RAISE EXCEPTION 'basic_sheet_seal_consumed' USING ERRCODE='23514'; END IF;
      RETURN NEW;
    END IF;
  END IF;
$branch$;
  IF (length(original.prosrc)-length(pg_catalog.replace(original.prosrc,needle,'')))/length(needle)<>1 THEN
    RAISE EXCEPTION 'basic_sheet_before_fragment_changed' USING ERRCODE='42501'; END IF;
  replacement:=pg_catalog.replace(original.prosrc,needle,insertion||needle);
  EXECUTE pg_catalog.replace(definition,original.prosrc,replacement);
END $finite_before$;

-- Retain every mechanical/narrative child, including ancestry/background pins
-- excluded from the older protected-class graph. No child write is permitted.
CREATE FUNCTION private.basic_sheet_children_v1(target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.builder_progression_full_graph_v1(target)||pg_catalog.jsonb_build_object(
  'all_refs',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_content_refs r WHERE r.character_id=target),
  'inventory',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_inventory r WHERE r.character_id=target),
  'journal',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_timeline_events r WHERE r.character_id=target),
  'relationships',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.npcs r WHERE r.character_id=target),
  'dm_notes',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.character_id),'[]') FROM public.character_dm_notes r WHERE r.character_id=target),
  'rolls',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_rolls r WHERE r.character_id=target))
$$;

CREATE FUNCTION private.finish_basic_sheet_v1(context jsonb,target uuid,source_name text,expected_full jsonb,children jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; seal private.character_parent_admissions_v1%ROWTYPE; ordering jsonb;
BEGIN
  PERFORM private.require_character_creation_context_v1(context);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=(context->>'actor_id')::uuid;
  SELECT * INTO seal FROM private.character_parent_admissions_v1
    WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target AND sequence=1;
  SELECT pg_catalog.to_jsonb(o)||pg_catalog.jsonb_build_object('producer_revision',o.producer_revision::text)
    INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=target;
  IF source_name NOT IN ('hp_manual','campaign_assignment') OR seal.source IS DISTINCT FROM source_name
    OR seal.phase IS DISTINCT FROM 'observed' OR NOT seal.write_required
    OR (pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('action_revision',parent.action_revision::text)) IS DISTINCT FROM expected_full
    OR seal.expected_parent IS DISTINCT FROM private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent))
    OR ordering IS DISTINCT FROM (seal.before_order||pg_catalog.jsonb_build_object('producer_revision',parent.action_revision::text))
    OR private.basic_sheet_children_v1(target) IS DISTINCT FROM children
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE character_id=target)
    OR private.first_class_parent_admission_v1(target) IS NOT NULL THEN
    RAISE EXCEPTION 'basic_sheet_postimage_changed' USING ERRCODE='23514'; END IF;
  DELETE FROM private.character_parent_admissions_v1
    WHERE transaction_id=seal.transaction_id AND character_id=target AND sequence=1 AND phase='observed' AND source=source_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'basic_sheet_finish_missing' USING ERRCODE='23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('status','applied','character_id',parent.id,'actor_id',parent.user_id,
    'revision',parent.action_revision::text,'state',parent.state,'campaign_id',parent.campaign_id);
END $$;

CREATE FUNCTION public.character_manual_hp_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; target uuid; patch jsonb; next_state jsonb; graph jsonb; children jsonb;
  maximum integer; hp integer; temp integer; expected_full jsonb; ordering jsonb; item record;
BEGIN
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['character_id','expected_parent','expected_max_hp','patch'])
    OR NOT private.builder_uuid_v1(p_request->>'character_id')
    OR pg_catalog.jsonb_typeof(p_request->'expected_parent') IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(p_request->'patch') IS DISTINCT FROM 'object'
    OR p_request->'patch'='{}'::jsonb OR (p_request->'patch'-ARRAY['current_hp','temp_hp'])<>'{}'::jsonb
    OR pg_catalog.jsonb_typeof(p_request->'expected_max_hp') IS DISTINCT FROM 'number'
    OR p_request->>'expected_max_hp' !~ '^[1-9][0-9]{0,9}$'
    OR (p_request->>'expected_max_hp')::numeric>2147483647 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  target:=(p_request->>'character_id')::uuid; patch:=p_request->'patch';
  FOR item IN SELECT key,value FROM pg_catalog.jsonb_each(patch) LOOP
    IF pg_catalog.jsonb_typeof(item.value)<>'number' OR item.value#>>'{}' !~ '^(0|[1-9][0-9]{0,9})$'
      OR (item.value#>>'{}')::numeric>2147483647 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  END LOOP;
  -- Existing exact JWT/context/actor/session/profile/expiry/row locks. No new
  -- generic Auth or service trust seam is introduced.
  parent:=private.begin_builder_step_v1(p_context,target,'manual_hp',true);
  IF parent.archived OR NOT private.enrolled_character_parent_v1(target)
    OR NOT EXISTS(SELECT 1 FROM public.game_systems WHERE id=parent.system_id AND slug='dnd-5e-2014')
    OR parent.action_revision=9223372036854775807
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1 WHERE character_id=target)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE character_id=target)
    OR private.first_class_parent_admission_v1(target) IS NOT NULL THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  IF private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent)) IS DISTINCT FROM p_request->'expected_parent' THEN
    RETURN '{"status":"conflict"}'::jsonb; END IF;
  -- Parent and singleton stay locked; lock exact saved mechanical inputs before
  -- the existing authoritative maximum-HP calculator reads their pinned data.
  PERFORM 1 FROM public.character_content_refs WHERE character_id=target ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.character_inventory WHERE character_id=target ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.content_versions v JOIN public.character_content_refs r ON r.content_id=v.content_id AND r.content_version=v.version
    WHERE r.character_id=target ORDER BY v.content_id,v.version FOR SHARE OF v;
  graph:=private.builder_progression_full_graph_v1(target);
  maximum:=private.builder_multiclass_max_hp_v1(target,parent.choices,graph);
  IF maximum IS NULL OR maximum<=0 OR maximum<>(p_request->>'expected_max_hp')::integer
    OR COALESCE(parent.state->'concentrating_on','null'::jsonb)<>'null'::jsonb THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  IF parent.state ? 'current_hp' AND (pg_catalog.jsonb_typeof(parent.state->'current_hp')<>'number'
      OR parent.state->>'current_hp' !~ '^[1-9][0-9]{0,9}$' OR (parent.state->>'current_hp')::numeric>maximum)
    OR parent.state ? 'temp_hp' AND (pg_catalog.jsonb_typeof(parent.state->'temp_hp')<>'number'
      OR parent.state->>'temp_hp' !~ '^(0|[1-9][0-9]{0,9})$' OR (parent.state->>'temp_hp')::numeric>2147483647) THEN
    RETURN '{"status":"unavailable"}'::jsonb; END IF;
  hp:=COALESCE((parent.state->>'current_hp')::integer,maximum); temp:=COALESCE((parent.state->>'temp_hp')::integer,0);
  next_state:=parent.state||patch;
  IF COALESCE((next_state->>'current_hp')::integer,hp) NOT BETWEEN 1 AND maximum
    OR COALESCE((next_state->>'temp_hp')::integer,temp)<0 THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  IF next_state=parent.state THEN RETURN pg_catalog.jsonb_build_object('status','unchanged','character_id',target,'actor_id',parent.user_id,
    'revision',parent.action_revision::text,'state',parent.state,'campaign_id',parent.campaign_id); END IF;
  children:=private.basic_sheet_children_v1(target);
  SELECT pg_catalog.to_jsonb(o) INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=target;
  IF ordering IS NULL OR ordering->>'producer_revision' IS DISTINCT FROM parent.action_revision::text THEN
    RAISE EXCEPTION 'basic_sheet_order_unavailable' USING ERRCODE='23514'; END IF;
  expected_full:=pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('state',next_state,'action_revision',(parent.action_revision+1)::text);
  INSERT INTO private.character_parent_admissions_v1 VALUES(pg_catalog.pg_current_xact_id(),target,1,'hp_manual',
    private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent)),private.character_parent_mechanics_v1(expected_full),ordering,'pending',true);
  UPDATE public.characters SET state=next_state WHERE id=target AND user_id=parent.user_id;
  RETURN private.finish_basic_sheet_v1(p_context,target,'hp_manual',expected_full,children);
END $$;

CREATE FUNCTION public.character_campaign_assignment_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; destination public.campaigns%ROWTYPE; target uuid; campaign uuid;
  children jsonb; expected_full jsonb; ordering jsonb;
BEGIN
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['character_id','campaign_id','expected_revision','expected_campaign_id'])
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'campaign_id')
    OR p_request->'expected_campaign_id' IS DISTINCT FROM 'null'::jsonb
    OR pg_catalog.jsonb_typeof(p_request->'expected_revision') IS DISTINCT FROM 'string'
    OR p_request->>'expected_revision' !~ '^(0|[1-9][0-9]{0,18})$' THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  target:=(p_request->>'character_id')::uuid; campaign:=(p_request->>'campaign_id')::uuid;
  parent:=private.begin_builder_step_v1(p_context,target,'campaign_assignment',true);
  IF parent.archived OR NOT private.enrolled_character_parent_v1(target) OR parent.action_revision=9223372036854775807
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1 WHERE character_id=target)
    OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1 WHERE character_id=target)
    OR private.first_class_parent_admission_v1(target) IS NOT NULL THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  IF parent.campaign_id IS NOT NULL OR parent.action_revision::text IS DISTINCT FROM p_request->>'expected_revision' THEN
    RETURN '{"status":"conflict"}'::jsonb; END IF;
  SELECT * INTO destination FROM public.campaigns WHERE id=campaign FOR SHARE;
  IF NOT FOUND OR destination.system_id<>parent.system_id THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  PERFORM 1 FROM public.campaign_members WHERE campaign_id=campaign AND user_id=parent.user_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"status":"unavailable"}'::jsonb; END IF;
  PERFORM 1 FROM public.character_content_refs WHERE character_id=target ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.content_versions v JOIN public.character_content_refs r ON r.content_id=v.content_id AND r.content_version=v.version
    WHERE r.character_id=target ORDER BY v.content_id,v.version FOR SHARE OF v;
  PERFORM 1 FROM public.content_shares s JOIN public.character_content_refs r ON r.content_id=s.content_id
    WHERE r.character_id=target AND s.campaign_id=campaign ORDER BY s.content_id FOR SHARE OF s;
  children:=private.basic_sheet_children_v1(target);
  SELECT pg_catalog.to_jsonb(o) INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=target;
  IF ordering IS NULL OR ordering->>'producer_revision' IS DISTINCT FROM parent.action_revision::text THEN
    RAISE EXCEPTION 'basic_sheet_order_unavailable' USING ERRCODE='23514'; END IF;
  expected_full:=pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('campaign_id',campaign,'action_revision',(parent.action_revision+1)::text);
  INSERT INTO private.character_parent_admissions_v1 VALUES(pg_catalog.pg_current_xact_id(),target,1,'campaign_assignment',
    private.character_parent_mechanics_v1(pg_catalog.to_jsonb(parent)),private.character_parent_mechanics_v1(expected_full),ordering,'pending',true);
  UPDATE public.characters SET campaign_id=campaign WHERE id=target AND user_id=parent.user_id;
  -- Evaluate the existing content policy against the ACTUAL new assignment;
  -- denial rolls back the parent/revision/seal atomically, with no repinning.
  IF EXISTS(SELECT 1 FROM public.character_content_refs r WHERE r.character_id=target
      AND NOT private.character_can_access_content_version(target,r.content_id,r.content_version))
    OR EXISTS(SELECT 1 FROM public.character_inventory r WHERE r.character_id=target AND r.content_id IS NOT NULL
      AND NOT private.character_can_access_content_version(target,r.content_id,r.content_version))
    OR EXISTS(SELECT 1 FROM public.character_spells r WHERE r.character_id=target AND r.content_id IS NOT NULL
      AND NOT private.character_can_access_content_version(target,r.content_id,r.content_version)) THEN
    RAISE EXCEPTION 'basic_sheet_destination_content_unavailable' USING ERRCODE='42501'; END IF;
  RETURN private.finish_basic_sheet_v1(p_context,target,'campaign_assignment',expected_full,children);
END $$;

REVOKE ALL ON FUNCTION private.basic_sheet_children_v1(uuid),
 private.finish_basic_sheet_v1(jsonb,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,
 inkborne_class_origin_owner,inkborne_hit_die_authority_owner,inkborne_character_command_gateway_owner;
REVOKE ALL ON FUNCTION public.character_manual_hp_command_v1(jsonb,jsonb),
 public.character_campaign_assignment_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,
 inkborne_class_origin_owner,inkborne_hit_die_authority_owner,inkborne_character_command_gateway_owner;
ALTER FUNCTION private.basic_sheet_children_v1(uuid) OWNER TO postgres;
ALTER FUNCTION private.finish_basic_sheet_v1(jsonb,uuid,text,jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.character_manual_hp_command_v1(jsonb,jsonb) OWNER TO postgres;
ALTER FUNCTION public.character_campaign_assignment_v1(jsonb,jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.character_manual_hp_command_v1(jsonb,jsonb),
 public.character_campaign_assignment_v1(jsonb,jsonb) TO authenticated;

DO $closed$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_temp.basic_sheet_functions_v1 b LEFT JOIN pg_catalog.pg_proc a ON a.oid=b.oid
      WHERE CASE WHEN b.oid='private.enrolled_parent_before_v1()'::pg_catalog.regprocedure
        THEN b.profile-'prosrc' IS DISTINCT FROM pg_catalog.to_jsonb(a)-'prosrc' ELSE b.profile IS DISTINCT FROM pg_catalog.to_jsonb(a) END)
    OR EXISTS(SELECT 1 FROM pg_temp.basic_sheet_wires_v1 b LEFT JOIN pg_catalog.pg_trigger a ON a.oid=b.oid WHERE b.wire IS DISTINCT FROM pg_catalog.to_jsonb(a))
    OR EXISTS(SELECT 1 FROM private.character_parent_admissions_v1) OR EXISTS(SELECT 1 FROM private.character_builder_capabilities_v1)
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled) OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'basic_sheet_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
