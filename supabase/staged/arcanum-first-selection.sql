-- M6 v1 SOURCE ONLY / UNAPPLIED / UNVERIFIED. No positive issuer or app entry.
-- Install after unchanged R09 authority; all13false/Authdeny remain unchanged.
BEGIN;
DO $$ DECLARE owner_oid oid; kernel_oid oid; required text; BEGIN
  SELECT r.oid INTO owner_oid FROM pg_catalog.pg_roles r WHERE r.rolname='inkborne_hit_die_authority_owner'
    AND NOT(r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication);
  IF owner_oid IS NULL OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=owner_oid OR m.member=owner_oid)
    OR pg_catalog.has_schema_privilege(owner_oid,'public','CREATE') OR pg_catalog.has_schema_privilege(owner_oid,'private','CREATE')
    OR NOT pg_catalog.has_schema_privilege(owner_oid,'public','USAGE') OR NOT pg_catalog.has_schema_privilege(owner_oid,'private','USAGE') THEN
    RAISE EXCEPTION 'Isolated original authority owner required' USING ERRCODE='42501';
  END IF;
  FOREACH required IN ARRAY ARRAY['private.hit_die_context_shape_v1(jsonb)','private.require_verified_hit_die_auth_v1(jsonb)',
    'private.lock_character_writer_guard_v1()'] LOOP
    IF pg_catalog.to_regprocedure(required) IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(required) AND p.proowner=owner_oid)
      OR NOT pg_catalog.has_function_privilege(owner_oid,pg_catalog.to_regprocedure(required),'EXECUTE') THEN
      RAISE EXCEPTION 'Frozen helper/owner prerequisite absent' USING ERRCODE='42501';
    END IF;
  END LOOP;
  -- Frozen kernel helpers keep their original owner. Existing authority EXECUTE
  -- and schema USAGE are checked, never newly granted or transferred here.
  SELECT r.oid INTO kernel_oid FROM pg_catalog.pg_roles r WHERE r.rolname='inkborne_hit_die_kernel_owner'
    AND NOT(r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication);
  IF kernel_oid IS NULL THEN RAISE EXCEPTION 'Frozen kernel owner absent' USING ERRCODE='42501'; END IF;
  FOREACH required IN ARRAY ARRAY['private.hit_die_exact_keys_v1(jsonb,text[])','private.hit_die_native_v1(timestamp with time zone)'] LOOP
    IF pg_catalog.to_regprocedure(required) IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(required) AND p.proowner=kernel_oid)
      OR NOT pg_catalog.has_function_privilege(owner_oid,pg_catalog.to_regprocedure(required),'EXECUTE') THEN
      RAISE EXCEPTION 'Frozen kernel helper/effective authority EXECUTE absent' USING ERRCODE='42501';
    END IF;
  END LOOP;
  IF NOT pg_catalog.has_table_privilege(owner_oid,'public.characters','SELECT')
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='public.characters'::regclass
      AND p.polname='hit_die_authority_character_read' AND p.polcmd='r' AND owner_oid=ANY(p.polroles)
      AND pg_catalog.pg_get_expr(p.polqual,p.polrelid)='true')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='public.characters'::regclass AND NOT p.polpermissive
      AND p.polcmd IN('r','*') AND (0::oid=ANY(p.polroles) OR owner_oid=ANY(p.polroles)))
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='public.characters'::regclass AND c.relrowsecurity)
    OR (SELECT pg_catalog.count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid='private.require_verified_hit_die_auth_v1(jsonb)'::regprocedure
      AND p.prosrc LIKE '%RAISE EXCEPTION ''auth_unavailable''%' AND p.prosrc !~* '\mRETURN\M') THEN
    RAISE EXCEPTION 'Disabled frozen Auth/readiness/RLS required' USING ERRCODE='42501';
  END IF;
END $$;
CREATE TABLE private.character_arcanum_selections_v1 (
  schema_version integer NOT NULL CHECK(schema_version=1), capture_kind text NOT NULL CHECK(capture_kind='first_choice'),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  selection_id uuid NOT NULL, system_id uuid NOT NULL, earned_occurrence_id uuid NOT NULL, origin_id uuid NOT NULL,
  operation_id uuid NOT NULL, original_actor_id uuid NOT NULL, accepted_at timestamptz NOT NULL CHECK(pg_catalog.isfinite(accepted_at) AND accepted_at>='0001-01-01T00:00:00Z' AND accepted_at<'10000-01-01T00:00:00Z'),
  before_revision bigint NOT NULL CHECK(before_revision>=0 AND before_revision<9223372036854775807),
  after_revision bigint NOT NULL CHECK(after_revision=before_revision+1),
  original_feature_grant_id uuid NOT NULL, controller_ref_id uuid NOT NULL, controller_content_id uuid NOT NULL,
  controller_version integer NOT NULL CHECK(controller_version BETWEEN 1 AND 2147483647),
  derived_feature_ref_id uuid NOT NULL, feature_content_id uuid NOT NULL, feature_version integer NOT NULL CHECK(feature_version BETWEEN 1 AND 2147483647),
  feature_slug text NOT NULL CHECK(pg_catalog.length(feature_slug) BETWEEN 1 AND 500 AND pg_catalog.btrim(feature_slug)<>''),
  unlock_level integer NOT NULL CHECK(unlock_level BETWEEN 1 AND 20),
  spell_content_id uuid NOT NULL, spell_version integer NOT NULL CHECK(spell_version BETWEEN 1 AND 2147483647),
  capture jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(capture)='object' AND pg_catalog.octet_length(capture::text)<=8388608),
  PRIMARY KEY(character_id,selection_id), UNIQUE(character_id,earned_occurrence_id), UNIQUE(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version)
);
CREATE TABLE private.character_arcanum_selection_receipts_v1 (
  schema_version integer NOT NULL CHECK(schema_version=1), capture_kind text NOT NULL CHECK(capture_kind='first_choice'),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  selection_id uuid NOT NULL, system_id uuid NOT NULL, earned_occurrence_id uuid NOT NULL, origin_id uuid NOT NULL,
  operation_id uuid NOT NULL, original_actor_id uuid NOT NULL, accepted_at timestamptz NOT NULL CHECK(pg_catalog.isfinite(accepted_at) AND accepted_at>='0001-01-01T00:00:00Z' AND accepted_at<'10000-01-01T00:00:00Z'),
  before_revision bigint NOT NULL CHECK(before_revision>=0 AND before_revision<9223372036854775807),
  after_revision bigint NOT NULL CHECK(after_revision=before_revision+1),
  original_feature_grant_id uuid NOT NULL, controller_ref_id uuid NOT NULL, controller_content_id uuid NOT NULL,
  controller_version integer NOT NULL CHECK(controller_version BETWEEN 1 AND 2147483647),
  derived_feature_ref_id uuid NOT NULL, feature_content_id uuid NOT NULL, feature_version integer NOT NULL CHECK(feature_version BETWEEN 1 AND 2147483647),
  feature_slug text NOT NULL CHECK(pg_catalog.length(feature_slug) BETWEEN 1 AND 500 AND pg_catalog.btrim(feature_slug)<>''),
  unlock_level integer NOT NULL CHECK(unlock_level BETWEEN 1 AND 20),
  spell_content_id uuid NOT NULL, spell_version integer NOT NULL CHECK(spell_version BETWEEN 1 AND 2147483647),
  capture jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(capture)='object' AND pg_catalog.octet_length(capture::text)<=8388608),
  receipt jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(receipt)='object' AND pg_catalog.octet_length(receipt::text)<=8388608),
  PRIMARY KEY(character_id,operation_id), UNIQUE(character_id,selection_id), UNIQUE(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version)
);
ALTER TABLE private.character_arcanum_selections_v1 ADD CONSTRAINT arcanum_selection_original_receipt FOREIGN KEY(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version) REFERENCES private.character_arcanum_selection_receipts_v1(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE private.character_arcanum_selection_receipts_v1 ADD CONSTRAINT arcanum_receipt_original_selection FOREIGN KEY(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version) REFERENCES private.character_arcanum_selections_v1(character_id,selection_id,earned_occurrence_id,origin_id,operation_id,original_actor_id,accepted_at,before_revision,after_revision,original_feature_grant_id,controller_ref_id,controller_content_id,controller_version,derived_feature_ref_id,feature_content_id,feature_version,spell_content_id,spell_version) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE private.character_arcanum_selections_v1 OWNER TO inkborne_hit_die_authority_owner;
ALTER TABLE private.character_arcanum_selection_receipts_v1 OWNER TO inkborne_hit_die_authority_owner;
ALTER TABLE private.character_arcanum_selections_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_arcanum_selections_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE private.character_arcanum_selection_receipts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_arcanum_selection_receipts_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY arcanum_selection_owner_read ON private.character_arcanum_selections_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
CREATE POLICY arcanum_receipt_owner_read ON private.character_arcanum_selection_receipts_v1 FOR SELECT TO inkborne_hit_die_authority_owner USING(true);
-- No INSERT/UPDATE/DELETE policy, choices privilege or schema membership is granted.
CREATE FUNCTION private.arcanum_request_shape_v1(p_request jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE k text; v numeric; BEGIN
  IF NOT private.hit_die_exact_keys_v1(p_request,ARRAY['command_version','command','operation_id','expected_revision','earned_occurrence_id','feature_grant_id','spell_content_id','spell_version'])
    OR pg_catalog.octet_length(p_request::text)>8192 OR p_request->'command_version' IS DISTINCT FROM '1'::jsonb
    OR p_request->'command' IS DISTINCT FROM '"first_select"'::jsonb
    OR pg_catalog.jsonb_typeof(p_request->'expected_revision') IS DISTINCT FROM 'string'
    OR p_request->>'expected_revision' !~ '^(0|[1-9][0-9]{0,18})$' THEN RETURN false; END IF;
  PERFORM (p_request->>'expected_revision')::bigint;
  FOREACH k IN ARRAY ARRAY['operation_id','earned_occurrence_id','feature_grant_id','spell_content_id'] LOOP
    IF pg_catalog.jsonb_typeof(p_request->k) IS DISTINCT FROM 'string' OR p_request->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    PERFORM (p_request->>k)::uuid;
  END LOOP;
  IF pg_catalog.jsonb_typeof(p_request->'spell_version') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  v:=(p_request->>'spell_version')::numeric; RETURN v BETWEEN 1 AND 2147483647 AND v=pg_catalog.trunc(v);
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
CREATE FUNCTION private.arcanum_capture_shape_v1(p_capture jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE k text; n numeric; t timestamptz; raw jsonb; grant_row jsonb; BEGIN
  IF NOT private.hit_die_exact_keys_v1(p_capture,ARRAY['schema_version','capture_kind','selection_id','character_id','system_id','earned_occurrence_id','origin_id','operation_id','original_actor_id','accepted_at','before_revision','after_revision','original_feature_grant_id','controller_ref_id','controller_content_id','controller_version','derived_feature_ref_id','feature_content_id','feature_version','feature_slug','unlock_level','spell_content_id','spell_version','controller_snapshot','feature_snapshot','spell_snapshot','captured_grant','canonical_intent'])
    OR pg_catalog.octet_length(p_capture::text)>8388608 OR p_capture->'schema_version' IS DISTINCT FROM '1'::jsonb
    OR p_capture->'capture_kind' IS DISTINCT FROM '"first_choice"'::jsonb THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['selection_id','character_id','system_id','earned_occurrence_id','origin_id','operation_id','original_actor_id','original_feature_grant_id','controller_ref_id','controller_content_id','derived_feature_ref_id','feature_content_id','spell_content_id'] LOOP
    IF pg_catalog.jsonb_typeof(p_capture->k) IS DISTINCT FROM 'string' OR p_capture->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
    PERFORM (p_capture->>k)::uuid;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['controller_version','feature_version','spell_version','unlock_level'] LOOP
    IF pg_catalog.jsonb_typeof(p_capture->k) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    n:=(p_capture->>k)::numeric;
    IF n<1 OR n>CASE WHEN k='unlock_level' THEN 20 ELSE 2147483647 END OR n<>pg_catalog.trunc(n) THEN RETURN false; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['before_revision','after_revision'] LOOP
    IF pg_catalog.jsonb_typeof(p_capture->k) IS DISTINCT FROM 'string' OR p_capture->>k !~ '^(0|[1-9][0-9]{0,18})$' THEN RETURN false; END IF;
    PERFORM (p_capture->>k)::bigint;
  END LOOP;
  IF (p_capture->>'before_revision')::bigint=9223372036854775807 OR (p_capture->>'after_revision')::bigint<>(p_capture->>'before_revision')::bigint+1
    OR pg_catalog.jsonb_typeof(p_capture->'accepted_at') IS DISTINCT FROM 'string'
    OR p_capture->>'accepted_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$' THEN RETURN false; END IF;
  t:=(p_capture->>'accepted_at')::timestamptz;
  IF NOT pg_catalog.isfinite(t) OR t<'0001-01-01T00:00:00Z' OR t>='10000-01-01T00:00:00Z' OR private.hit_die_native_v1(t) IS DISTINCT FROM p_capture->>'accepted_at' THEN RETURN false; END IF;
  IF pg_catalog.jsonb_typeof(p_capture->'feature_slug') IS DISTINCT FROM 'string' OR pg_catalog.length(p_capture->>'feature_slug') NOT BETWEEN 1 AND 500 OR pg_catalog.btrim(p_capture->>'feature_slug')='' THEN RETURN false; END IF;
  IF NOT private.arcanum_request_shape_v1(p_capture->'canonical_intent') OR NOT (p_capture->'canonical_intent' @> pg_catalog.jsonb_build_object(
    'operation_id',p_capture->'operation_id','expected_revision',p_capture->'before_revision','earned_occurrence_id',p_capture->'earned_occurrence_id','feature_grant_id',p_capture->'original_feature_grant_id','spell_content_id',p_capture->'spell_content_id','spell_version',p_capture->'spell_version')) THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['controller','feature','spell'] LOOP
    raw:=p_capture->(k||'_snapshot');
    IF NOT private.hit_die_exact_keys_v1(raw,ARRAY['content_id','version','system_id_snapshot','content_type_snapshot','slug_snapshot','name_snapshot','data_snapshot','effects_snapshot','source_snapshot','scope_snapshot','owner_id_snapshot','created_at'])
      OR raw->'content_id' IS DISTINCT FROM p_capture->(k||'_content_id') OR raw->'version' IS DISTINCT FROM p_capture->(k||'_version')
      OR raw->'system_id_snapshot' IS DISTINCT FROM p_capture->'system_id'
      OR pg_catalog.jsonb_typeof(raw->'content_type_snapshot') IS DISTINCT FROM 'string'
      OR NOT(CASE WHEN k='controller' THEN raw->>'content_type_snapshot' IN('class','subclass') ELSE raw->>'content_type_snapshot'=k END)
      OR pg_catalog.jsonb_typeof(raw->'slug_snapshot') IS DISTINCT FROM 'string' OR pg_catalog.btrim(raw->>'slug_snapshot')=''
      OR pg_catalog.jsonb_typeof(raw->'name_snapshot') IS DISTINCT FROM 'string' OR pg_catalog.length(raw->>'name_snapshot')=0
      OR pg_catalog.jsonb_typeof(raw->'data_snapshot') IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(raw->'effects_snapshot') IS DISTINCT FROM 'array'
      OR NOT COALESCE(raw->>'source_snapshot' IN('srd','homebrew'),false) OR NOT COALESCE(raw->>'scope_snapshot' IN('platform','personal','shared'),false)
      OR pg_catalog.jsonb_typeof(raw->'created_at') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    t:=(raw->>'created_at')::timestamptz;
    IF NOT pg_catalog.isfinite(t) OR t<'0001-01-01T00:00:00Z' OR t>='10000-01-01T00:00:00Z' THEN RETURN false; END IF;
    IF raw->'owner_id_snapshot' IS DISTINCT FROM 'null'::jsonb THEN
      IF pg_catalog.jsonb_typeof(raw->'owner_id_snapshot') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
      PERFORM (raw->>'owner_id_snapshot')::uuid;
    END IF;
  END LOOP;
  IF p_capture#>'{feature_snapshot,slug_snapshot}' IS DISTINCT FROM p_capture->'feature_slug' THEN RETURN false; END IF;
  grant_row:=p_capture->'captured_grant';
  RETURN pg_catalog.jsonb_typeof(grant_row)='object' AND grant_row @> pg_catalog.jsonb_build_object('id',p_capture->'original_feature_grant_id','character_id',p_capture->'character_id','controller_ref_id',p_capture->'controller_ref_id','feature_slug',p_capture->'feature_slug','feature_content_id',p_capture->'feature_content_id','feature_version',p_capture->'feature_version','unlock_level',p_capture->'unlock_level');
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
CREATE FUNCTION private.arcanum_receipt_correspondence_v1(p_selection jsonb,p_receipt jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
  RETURN COALESCE(private.arcanum_capture_shape_v1(p_selection) AND private.hit_die_exact_keys_v1(p_receipt,ARRAY['receipt_version','capture_kind','character_id','operation_id','selection_id','earned_occurrence_id','origin_id','original_actor_id','accepted_at','before_revision','after_revision','canonical_intent','capture'])
    AND pg_catalog.octet_length(p_receipt::text)<=8388608 AND p_receipt->'receipt_version'='1'::jsonb
    AND p_receipt->'capture_kind'='"first_choice"'::jsonb AND p_receipt->'capture'=p_selection
    AND p_receipt @> pg_catalog.jsonb_build_object('character_id',p_selection->'character_id','operation_id',p_selection->'operation_id','selection_id',p_selection->'selection_id','earned_occurrence_id',p_selection->'earned_occurrence_id','origin_id',p_selection->'origin_id','original_actor_id',p_selection->'original_actor_id','accepted_at',p_selection->'accepted_at','before_revision',p_selection->'before_revision','after_revision',p_selection->'after_revision','canonical_intent',p_selection->'canonical_intent'),false);
END $$;
CREATE FUNCTION private.arcanum_canonical_ready_v1(p_character_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;
CREATE FUNCTION private.arcanum_lineage_ready_v1(p_character_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;
CREATE FUNCTION private.arcanum_order_ready_v1(p_character_id uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT false $$;
CREATE FUNCTION private.arcanum_prerequisite_refusal_v1(p_character_id uuid) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '{"status":"unready","reason":"canonical_lineage_order_unimplemented"}'::jsonb $$;
CREATE FUNCTION private.lock_arcanum_parent_v1(p_verified_context jsonb,p_character_id uuid) RETURNS public.characters
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE c public.characters%ROWTYPE; BEGIN
  IF p_character_id IS NULL OR NOT private.hit_die_context_shape_v1(p_verified_context) THEN RAISE EXCEPTION 'invalid_context' USING ERRCODE='22023'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  PERFORM private.lock_character_writer_guard_v1();
  SELECT parent.* INTO c FROM public.characters AS parent WHERE parent.id=p_character_id AND parent.user_id=(p_verified_context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inaccessible' USING ERRCODE='42501'; END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  IF pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'expired_context' USING ERRCODE='42501'; END IF;
  RETURN c;
END $$;
CREATE FUNCTION private.read_locked_arcanum_selection_v1(p_verified_context jsonb,p_character_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE c public.characters%ROWTYPE; captures jsonb; receipts jsonb; result jsonb; n_c bigint; n_r bigint; mismatch boolean; BEGIN
  c:=private.lock_arcanum_parent_v1(p_verified_context,p_character_id);
  IF pg_catalog.jsonb_typeof(c.state) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'state_projection_unavailable' USING ERRCODE='23514'; END IF;
  SELECT pg_catalog.count(*),COALESCE(pg_catalog.jsonb_agg(s.capture ORDER BY s.selection_id),'[]'::jsonb) INTO n_c,captures FROM private.character_arcanum_selections_v1 s WHERE s.character_id=c.id;
  SELECT pg_catalog.count(*),COALESCE(pg_catalog.jsonb_agg(r.receipt ORDER BY r.selection_id),'[]'::jsonb) INTO n_r,receipts FROM private.character_arcanum_selection_receipts_v1 r WHERE r.character_id=c.id;
  SELECT EXISTS(SELECT 1 FROM private.character_arcanum_selections_v1 s FULL JOIN private.character_arcanum_selection_receipts_v1 r
    ON r.character_id=s.character_id AND r.selection_id=s.selection_id AND r.operation_id=s.operation_id
    WHERE (s.character_id=c.id OR r.character_id=c.id) AND (s.selection_id IS NULL OR r.selection_id IS NULL
      OR s.system_id IS DISTINCT FROM c.system_id OR r.system_id IS DISTINCT FROM c.system_id
      OR s.capture->>'system_id' IS DISTINCT FROM c.system_id::text OR r.capture->>'system_id' IS DISTINCT FROM c.system_id::text
      OR r.receipt->'capture'->>'system_id' IS DISTINCT FROM c.system_id::text
      OR NOT private.arcanum_receipt_correspondence_v1(s.capture,r.receipt))) INTO mismatch;
  IF n_c<>n_r OR mismatch THEN RAISE EXCEPTION 'reciprocal_graph_unavailable' USING ERRCODE='23514'; END IF;
  result:=pg_catalog.jsonb_build_object('status','read','read_version',1,'character_id',c.id,'system_id',c.system_id,'revision',c.action_revision::text,'native_read_at',private.hit_die_native_v1(pg_catalog.clock_timestamp()),'counts',pg_catalog.jsonb_build_object('selections',n_c::text,'receipts',n_r::text),'selections',captures,'receipts',receipts,'state',c.state,'current_eligibility',pg_catalog.jsonb_build_object('status','unavailable','reason','prerequisites_unimplemented'));
  IF pg_catalog.octet_length(result::text)>8388608 THEN RAISE EXCEPTION 'read_budget_exceeded' USING ERRCODE='22023'; END IF;
  -- Terminal Auth/owner/native expiry recheck AFTER all read construction.
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=c.id AND parent.user_id=(p_verified_context->>'actor_id')::uuid)
    OR pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'inaccessible' USING ERRCODE='42501'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION private.select_arcanum_spell_v1(p_verified_context jsonb,p_character_id uuid,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE c public.characters%ROWTYPE; previous jsonb; capture_row jsonb; result jsonb; BEGIN
  IF NOT private.arcanum_request_shape_v1(p_request) THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  c:=private.lock_arcanum_parent_v1(p_verified_context,p_character_id);
  SELECT command.receipt,selection.capture INTO previous,capture_row FROM private.character_arcanum_selection_receipts_v1 command
    LEFT JOIN private.character_arcanum_selections_v1 selection ON selection.character_id=command.character_id AND selection.selection_id=command.selection_id AND selection.operation_id=command.operation_id
    WHERE command.character_id=c.id AND command.operation_id=(p_request->>'operation_id')::uuid;
  IF FOUND THEN
    IF NOT private.arcanum_receipt_correspondence_v1(capture_row,previous) THEN result:='{"status":"unready","reason":"receipt_correspondence_unavailable"}'::jsonb;
    ELSIF previous->'canonical_intent' IS DISTINCT FROM p_request THEN result:='{"status":"intent_conflict"}'::jsonb;
    ELSE result:=pg_catalog.jsonb_build_object('status','recorded','receipt',previous); END IF;
  ELSE result:=private.arcanum_prerequisite_refusal_v1(c.id); END IF;
  -- NO positive issuance: no source/history/revision gate precedes replay; no DML.
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=c.id AND parent.user_id=(p_verified_context->>'actor_id')::uuid)
    OR pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'inaccessible' USING ERRCODE='42501'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION private.resolve_arcanum_selection_v1(p_verified_context jsonb,p_character_id uuid,p_operation_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE c public.characters%ROWTYPE; previous jsonb; capture_row jsonb; result jsonb; BEGIN
  IF p_operation_id IS NULL THEN RETURN '{"status":"invalid"}'::jsonb; END IF;
  c:=private.lock_arcanum_parent_v1(p_verified_context,p_character_id);
  SELECT command.receipt,selection.capture INTO previous,capture_row FROM private.character_arcanum_selection_receipts_v1 command
    LEFT JOIN private.character_arcanum_selections_v1 selection ON selection.character_id=command.character_id AND selection.selection_id=command.selection_id AND selection.operation_id=command.operation_id
    WHERE command.character_id=c.id AND command.operation_id=p_operation_id;
  IF NOT FOUND THEN result:='{"status":"absent"}'::jsonb;
  ELSIF NOT private.arcanum_receipt_correspondence_v1(capture_row,previous) THEN result:='{"status":"unready","reason":"receipt_correspondence_unavailable"}'::jsonb;
  ELSE result:=pg_catalog.jsonb_build_object('status','recorded','receipt',previous); END IF;
  PERFORM private.require_verified_hit_die_auth_v1(p_verified_context);
  IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=c.id AND parent.user_id=(p_verified_context->>'actor_id')::uuid)
    OR pg_catalog.clock_timestamp()>=(p_verified_context->>'jwt_expires_at')::timestamptz THEN RAISE EXCEPTION 'inaccessible' USING ERRCODE='42501'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION private.arcanum_immutable_row_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE identity jsonb; BEGIN
  IF TG_TABLE_SCHEMA<>'private' OR TG_TABLE_NAME NOT IN('character_arcanum_selections_v1','character_arcanum_selection_receipts_v1') THEN RAISE EXCEPTION 'wrong_trigger_target' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN
    -- Explicit OLD parent identity under isolated owner's all-row parent visibility.
    IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=OLD.character_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'capture_lifetime_immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'capture_identity_immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=NEW.character_id AND parent.system_id=NEW.system_id) THEN RAISE EXCEPTION 'exact_parent_unavailable' USING ERRCODE='23514'; END IF;
  identity:=pg_catalog.jsonb_build_object('schema_version',NEW.schema_version,'capture_kind',NEW.capture_kind,'character_id',NEW.character_id,'selection_id',NEW.selection_id,'system_id',NEW.system_id,'earned_occurrence_id',NEW.earned_occurrence_id,'origin_id',NEW.origin_id,'operation_id',NEW.operation_id,'original_actor_id',NEW.original_actor_id,'accepted_at',private.hit_die_native_v1(NEW.accepted_at),'before_revision',NEW.before_revision::text,'after_revision',NEW.after_revision::text,'original_feature_grant_id',NEW.original_feature_grant_id,'controller_ref_id',NEW.controller_ref_id,'controller_content_id',NEW.controller_content_id,'controller_version',NEW.controller_version,'derived_feature_ref_id',NEW.derived_feature_ref_id,'feature_content_id',NEW.feature_content_id,'feature_version',NEW.feature_version,'feature_slug',NEW.feature_slug,'unlock_level',NEW.unlock_level,'spell_content_id',NEW.spell_content_id,'spell_version',NEW.spell_version);
  IF NOT private.arcanum_capture_shape_v1(NEW.capture) OR NOT NEW.capture @> identity THEN RAISE EXCEPTION 'capture_row_correspondence' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='character_arcanum_selection_receipts_v1' THEN
    IF NOT private.arcanum_receipt_correspondence_v1(NEW.capture,NEW.receipt) THEN RAISE EXCEPTION 'receipt_row_correspondence' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION private.arcanum_pair_closure_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE s private.character_arcanum_selections_v1%ROWTYPE; r private.character_arcanum_selection_receipts_v1%ROWTYPE; BEGIN
  IF TG_TABLE_SCHEMA<>'private' OR TG_TABLE_NAME NOT IN('character_arcanum_selections_v1','character_arcanum_selection_receipts_v1') OR TG_OP<>'INSERT' THEN RAISE EXCEPTION 'wrong_pair_trigger' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.characters parent WHERE parent.id=NEW.character_id) THEN RETURN NULL; END IF;
  SELECT selection.* INTO s FROM private.character_arcanum_selections_v1 selection WHERE selection.character_id=NEW.character_id AND selection.selection_id=NEW.selection_id AND selection.operation_id=NEW.operation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'selection_pair_absent' USING ERRCODE='23514'; END IF;
  SELECT command.* INTO r FROM private.character_arcanum_selection_receipts_v1 command WHERE command.character_id=NEW.character_id AND command.selection_id=NEW.selection_id AND command.operation_id=NEW.operation_id;
  IF NOT FOUND OR NOT private.arcanum_receipt_correspondence_v1(s.capture,r.receipt) OR s.capture IS DISTINCT FROM r.capture THEN RAISE EXCEPTION 'reciprocal_pair_mismatch' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER arcanum_selection_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.character_arcanum_selections_v1 FOR EACH ROW EXECUTE FUNCTION private.arcanum_immutable_row_v1();
CREATE TRIGGER arcanum_receipt_immutable BEFORE INSERT OR UPDATE OR DELETE ON private.character_arcanum_selection_receipts_v1 FOR EACH ROW EXECUTE FUNCTION private.arcanum_immutable_row_v1();
CREATE CONSTRAINT TRIGGER arcanum_selection_pair AFTER INSERT ON private.character_arcanum_selections_v1 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.arcanum_pair_closure_v1();
CREATE CONSTRAINT TRIGGER arcanum_receipt_pair AFTER INSERT ON private.character_arcanum_selection_receipts_v1 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.arcanum_pair_closure_v1();
ALTER FUNCTION private.arcanum_request_shape_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_request_shape_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_capture_shape_v1(jsonb) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_capture_shape_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_receipt_correspondence_v1(jsonb,jsonb) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_receipt_correspondence_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_canonical_ready_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_canonical_ready_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_lineage_ready_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_lineage_ready_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_order_ready_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_order_ready_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_prerequisite_refusal_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_prerequisite_refusal_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.lock_arcanum_parent_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.lock_arcanum_parent_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.read_locked_arcanum_selection_v1(jsonb,uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.read_locked_arcanum_selection_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.select_arcanum_spell_v1(jsonb,uuid,jsonb) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.select_arcanum_spell_v1(jsonb,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.resolve_arcanum_selection_v1(jsonb,uuid,uuid) OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.resolve_arcanum_selection_v1(jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_immutable_row_v1() OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_immutable_row_v1() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION private.arcanum_pair_closure_v1() OWNER TO inkborne_hit_die_authority_owner;
REVOKE ALL ON FUNCTION private.arcanum_pair_closure_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON private.character_arcanum_selections_v1,private.character_arcanum_selection_receipts_v1 FROM PUBLIC,anon,authenticated,service_role;
-- NO runtime EXECUTE grant / private writer policy / choices UPDATE / readiness activation.
COMMIT;
