-- Local staged continuation after the complete seventeen-stage class profile.
-- Authenticated calls retain the real PostgREST JWT; equipment plans are trusted
-- server input and have a SEPARATE service-only entry. No general Auth/readiness
-- gate, legacy writer privilege, bootstrap or first-class producer is enabled.
BEGIN;

DO $preflight$
DECLARE dependency record;
BEGIN
  IF CURRENT_USER<>'supabase_admin' OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
    OR pg_catalog.has_schema_privilege('service_role','private','USAGE') THEN
    RAISE EXCEPTION 'builder_installation_unavailable' USING ERRCODE='42501'; END IF;
  FOR dependency IN SELECT * FROM (VALUES
    ('private.first_class_materialization_inputs_v1(uuid,text)','aefca16532137e976c03f5262164864e'),
    ('private.prune_inactive_asi_choices_before_choices()','f5972f0b1a35e5e27f3112c072418a08'),
    ('private.hit_die_character_revision_v1()','2daf275513b60cc98818f07a7e982946')
  ) wanted(signature,body_md5) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(dependency.signature)
      AND pg_catalog.md5(pg_catalog.replace(prosrc,E'\r\n',E'\n'))=dependency.body_md5
      AND proconfig=ARRAY['search_path=""']::text[])
      OR pg_catalog.has_function_privilege('anon',pg_catalog.to_regprocedure(dependency.signature),'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',pg_catalog.to_regprocedure(dependency.signature),'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',pg_catalog.to_regprocedure(dependency.signature),'EXECUTE') THEN
      RAISE EXCEPTION 'builder_dependency_drift' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM private.character_writer_readiness_v1)<>13
    OR EXISTS(SELECT 1 FROM private.character_writer_readiness_v1 WHERE ready)
    OR EXISTS(SELECT 1 FROM private.class_origin_gate_v1 WHERE enabled)
    OR EXISTS(SELECT 1 FROM private.hit_die_gate_v1 WHERE enabled) THEN
    RAISE EXCEPTION 'builder_general_gate_drift' USING ERRCODE='42501'; END IF;
END $preflight$;

CREATE TABLE private.character_builder_receipts_v1 (
  actor_id uuid NOT NULL, operation_id uuid NOT NULL, character_id uuid NOT NULL,
  request jsonb NOT NULL, receipt jsonb NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,operation_id),
  CHECK(pg_catalog.octet_length(request::text)<=524288 AND pg_catalog.octet_length(receipt::text)<=1048576)
);
ALTER TABLE private.character_builder_receipts_v1 OWNER TO postgres;
ALTER TABLE private.character_builder_receipts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_builder_receipts_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_receipts_owner ON private.character_builder_receipts_v1 TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON private.character_builder_receipts_v1 FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE TABLE private.character_builder_capabilities_v1 (
  transaction_id xid8 NOT NULL, character_id uuid NOT NULL, actor_id uuid NOT NULL,
  command text NOT NULL, context jsonb NOT NULL, before_parent jsonb NOT NULL,
  before_order jsonb NOT NULL, protected_graph jsonb NOT NULL, before_inventory jsonb NOT NULL,
  PRIMARY KEY(transaction_id,character_id),
  CHECK(pg_catalog.octet_length(pg_catalog.to_jsonb(ROW(context,before_parent,before_order,protected_graph,before_inventory))::text)<=8388608)
);
ALTER TABLE private.character_builder_capabilities_v1 OWNER TO postgres;
ALTER TABLE private.character_builder_capabilities_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.character_builder_capabilities_v1 FORCE ROW LEVEL SECURITY;
CREATE POLICY builder_capability_owner ON private.character_builder_capabilities_v1 TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON private.character_builder_capabilities_v1 FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner;

CREATE FUNCTION private.builder_exact_keys_v1(value jsonb,keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE WHEN pg_catalog.jsonb_typeof(value)='object' THEN
    (SELECT count(*) FROM pg_catalog.jsonb_object_keys(value))=pg_catalog.cardinality(keys) AND value ?& keys ELSE false END
$$;
CREATE FUNCTION private.builder_uuid_v1(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT COALESCE(value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
$$;
CREATE FUNCTION private.builder_string_map_v1(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE WHEN pg_catalog.jsonb_typeof(value)='object' THEN
    (SELECT count(*) FROM pg_catalog.jsonb_each(value))<=100 AND NOT EXISTS(
      SELECT 1 FROM pg_catalog.jsonb_each(value) e WHERE length(e.key)>150
        OR pg_catalog.jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}') NOT BETWEEN 1 AND 300) ELSE false END
$$;
CREATE FUNCTION private.builder_protected_graph_v1(target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'refs',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      WHERE r.character_id=target AND v.content_type_snapshot NOT IN ('race','subrace','background')),
    'feature_grants',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_feature_grants r WHERE r.character_id=target),
    'spell_grants',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_spell_grants r WHERE r.character_id=target),
    'spells',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM public.character_spells r WHERE r.character_id=target),
    'origin',(SELECT pg_catalog.to_jsonb(r) FROM private.character_class_origin_v1 r WHERE r.character_id=target),
    'occurrences',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.id),'[]') FROM private.character_class_occurrences_v1 r WHERE r.character_id=target),
    'commands',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.operation_id),'[]') FROM private.character_class_commands_v1 r WHERE r.character_id=target))
$$;

CREATE FUNCTION private.read_builder_capability_v1(target uuid) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
  SELECT pg_catalog.to_jsonb(c) FROM private.character_builder_capabilities_v1 c
    WHERE c.transaction_id=pg_catalog.pg_current_xact_id() AND c.character_id=target
$$;

-- Reuse the existing class/authority ownership split: postgres has no direct
-- UPDATE privilege on the singleton guard. No private-table privilege is added.
CREATE FUNCTION private.lock_builder_character_rows_v1(context jsonb,target uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE expires timestamptz;
BEGIN
  PERFORM private.require_character_creation_context_v1(context);
  expires:=(context->>'jwt_expires_at')::timestamptz;
  PERFORM private.lock_character_writer_guard_v1();
  PERFORM private.check_character_command_clock_v1(expires);
  PERFORM 1 FROM public.characters c WHERE c.id=target AND c.user_id=(context->>'actor_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  PERFORM private.check_character_command_clock_v1(expires);
  PERFORM private.require_character_creation_context_v1(context);
END $$;
ALTER FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) OWNER TO inkborne_class_origin_owner;
REVOKE ALL ON FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role,postgres,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.lock_builder_character_rows_v1(jsonb,uuid) TO postgres,inkborne_class_origin_owner;

-- Keep the complete B2 implementation as the fallthrough. Only a private row
-- minted after real JWT/row-lock/ownership admission can select the ordinary
-- bodies. Caller JSON, role strings, trigger depth and GUCs cannot mint this row.
ALTER FUNCTION private.first_class_materialization_inputs_v1(uuid,text) RENAME TO first_class_materialization_inputs_before_builder_v1;
CREATE FUNCTION private.first_class_materialization_inputs_v1(p_target uuid,p_phase text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=p_target;
  IF FOUND THEN
    IF p_phase NOT IN ('grants','active','prune') OR p_phase IS NULL THEN
      RAISE EXCEPTION 'builder_capability_unavailable' USING ERRCODE='42501'; END IF;
    PERFORM private.lock_builder_character_rows_v1(cap.context,p_target);
    SELECT * INTO parent FROM public.characters WHERE id=p_target AND user_id=cap.actor_id;
    IF NOT FOUND OR parent.choices->'classes' IS DISTINCT FROM cap.before_parent->'choices'->'classes'
      OR private.builder_protected_graph_v1(p_target) IS DISTINCT FROM cap.protected_graph THEN
      RAISE EXCEPTION 'builder_protected_class_changed' USING ERRCODE='23514'; END IF;
    RETURN NULL;
  END IF;
  RETURN private.first_class_materialization_inputs_before_builder_v1(p_target,p_phase);
END $$;

CREATE FUNCTION private.begin_builder_step_v1(context jsonb,target uuid,command text,authenticated_call boolean) RETURNS public.characters
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; jwt jsonb; claims_context jsonb; expires numeric; ordering jsonb; protected jsonb;
BEGIN
  IF authenticated_call THEN
    jwt:=auth.jwt();
    IF jwt->>'role' IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL OR jwt->>'sub' IS DISTINCT FROM auth.uid()::text
      OR NOT private.builder_uuid_v1(jwt->>'session_id') OR pg_catalog.jsonb_typeof(jwt->'exp')<>'number'
      OR jwt->>'exp' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'builder_auth_unavailable' USING ERRCODE='42501'; END IF;
    expires:=(jwt->>'exp')::numeric;
    IF expires<0 OR expires>253402300799 THEN RAISE EXCEPTION 'builder_auth_unavailable' USING ERRCODE='42501'; END IF;
    claims_context:=pg_catalog.jsonb_build_object('context_version',1,'actor_id',auth.uid(),'session_id',jwt->>'session_id',
      'jwt_expires_at',pg_catalog.to_char(pg_catalog.to_timestamp(expires::double precision) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
    IF context IS DISTINCT FROM claims_context THEN RAISE EXCEPTION 'builder_context_mismatch' USING ERRCODE='42501'; END IF;
  END IF;
  PERFORM private.lock_builder_character_rows_v1(context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=(context->>'actor_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_character_unavailable' USING ERRCODE='42501'; END IF;
  RETURN parent;
END $$;

-- The existing award receipt/provenance format is retained, without E's legacy
-- creation/copy entrypoints or its service-role private-schema grant.
CREATE TABLE public.character_starting_grants (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  grant_kind text NOT NULL DEFAULT 'starting_equipment' CHECK(grant_kind='starting_equipment'),
  status text NOT NULL CHECK(status IN ('eligible','awarded','inherited_completion')),
  canonical_intent jsonb,receipt jsonb,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
  UNIQUE(character_id,grant_kind),UNIQUE(id,character_id),
  CHECK((status='eligible' AND canonical_intent IS NULL AND receipt IS NULL AND completed_at IS NULL)
    OR (status='awarded' AND canonical_intent IS NOT NULL AND receipt IS NOT NULL AND completed_at IS NOT NULL)
    OR (status='inherited_completion' AND canonical_intent IS NULL AND receipt IS NULL AND completed_at IS NOT NULL))
);
ALTER TABLE public.character_starting_grants OWNER TO postgres;
ALTER TABLE public.character_starting_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_starting_grants FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.character_starting_grants TO authenticated;
CREATE POLICY starting_grants_owner_read ON public.character_starting_grants FOR SELECT TO authenticated
  USING(EXISTS(SELECT 1 FROM public.characters c WHERE c.id=character_id AND c.user_id=(SELECT auth.uid())));
ALTER TABLE public.character_inventory ADD COLUMN starting_grant_id uuid;
ALTER TABLE public.character_inventory ADD CONSTRAINT inventory_starting_grant_character_fkey
  FOREIGN KEY(starting_grant_id,character_id) REFERENCES public.character_starting_grants(id,character_id);

CREATE FUNCTION private.preserve_builder_starting_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF OLD.status<>'eligible' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.character_id IS DISTINCT FROM OLD.character_id
    OR NEW.grant_kind IS DISTINCT FROM OLD.grant_kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Completed starting grants are immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER preserve_starting_grant_receipt BEFORE UPDATE ON public.character_starting_grants
  FOR EACH ROW EXECUTE FUNCTION private.preserve_builder_starting_receipt_v1();
CREATE FUNCTION private.protect_builder_inventory_provenance_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.starting_grant_id IS NOT NULL AND (NEW.starting_grant_id IS DISTINCT FROM OLD.starting_grant_id
    OR NEW.character_id IS DISTINCT FROM OLD.character_id) THEN
    RAISE EXCEPTION 'Starting grant provenance is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.starting_grant_id IS NOT NULL AND CURRENT_USER IN ('authenticated','anon','service_role')
    AND (TG_OP='INSERT' OR NEW.starting_grant_id IS DISTINCT FROM OLD.starting_grant_id) THEN
    RAISE EXCEPTION 'Starting provenance requires trusted creation' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_starting_inventory_provenance BEFORE INSERT OR UPDATE ON public.character_inventory
  FOR EACH ROW EXECUTE FUNCTION private.protect_builder_inventory_provenance_v1();

CREATE FUNCTION public.commit_character_builder_equipment_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; saved public.characters%ROWTYPE; grant_row public.character_starting_grants%ROWTYPE;
  stored private.character_builder_receipts_v1%ROWTYPE; target uuid; operation uuid; canonical jsonb; actual_refs jsonb;
  item jsonb; source record; item_id uuid; inventory_ids jsonb:='[]'; next_state jsonb; currency jsonb; delta jsonb;
  unit text; amount numeric; next_sort integer; award_receipt jsonb; sources jsonb; class_source jsonb; background_source jsonb;
BEGIN
  IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','operation_id','character_id','expected_choices','expected_refs','canonical_intent'])
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb OR pg_catalog.octet_length(p_request::text)>524288
    OR NOT private.builder_uuid_v1(p_request->>'operation_id') OR NOT private.builder_uuid_v1(p_request->>'character_id')
    OR pg_catalog.jsonb_typeof(p_request->'expected_choices')<>'object' OR pg_catalog.jsonb_typeof(p_request->'expected_refs')<>'array' THEN
    RAISE EXCEPTION 'builder_invalid_award_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid; canonical:=p_request->'canonical_intent';
  IF NOT private.builder_exact_keys_v1(canonical,ARRAY['selections','sources','plan'])
    OR NOT private.builder_exact_keys_v1(canonical->'selections',ARRAY['selections','picks'])
    OR NOT private.builder_string_map_v1(canonical#>'{selections,selections}') OR NOT private.builder_string_map_v1(canonical#>'{selections,picks}')
    OR NOT private.builder_exact_keys_v1(canonical->'sources',ARRAY['class','background'])
    OR NOT private.builder_exact_keys_v1(canonical->'plan',ARRAY['items','currency'])
    OR pg_catalog.jsonb_typeof(canonical#>'{plan,items}')<>'array' OR pg_catalog.jsonb_array_length(canonical#>'{plan,items}')>200
    OR pg_catalog.jsonb_typeof(canonical#>'{plan,currency}')<>'object' THEN
    RAISE EXCEPTION 'builder_invalid_award_intent' USING ERRCODE='22023'; END IF;
  parent:=private.begin_builder_step_v1(p_context,target,'award_equipment',false);
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=parent.user_id AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request IS DISTINCT FROM (p_request||'{"command":"award_equipment"}'::jsonb) THEN RETURN '{"status":"conflict"}'::jsonb; END IF;
    RETURN pg_catalog.jsonb_build_object('status','awarded','receipt',stored.receipt);
  END IF;
  -- Character-wide award identity survives a different operation ID or source
  -- drift. Current ownership/session was checked; current sources are not read.
  SELECT * INTO grant_row FROM public.character_starting_grants WHERE character_id=target AND grant_kind='starting_equipment' FOR UPDATE;
  IF FOUND THEN
    IF grant_row.status='awarded' THEN
      IF grant_row.canonical_intent=canonical THEN RETURN pg_catalog.jsonb_build_object('status','awarded','receipt',grant_row.receipt); END IF;
      RETURN '{"status":"conflict"}'::jsonb;
    ELSIF grant_row.status='inherited_completion' THEN RETURN '{"status":"already_completed"}'::jsonb;
    ELSE RAISE EXCEPTION 'builder_unexpected_eligible_grant' USING ERRCODE='23514'; END IF;
  END IF;
  IF parent.choices#>'{starting_equipment,confirmed}'='true'::jsonb
    OR parent.choices IS DISTINCT FROM p_request->'expected_choices'
    OR pg_catalog.jsonb_build_object('selections',parent.choices#>'{starting_equipment,selections}',
      'picks',parent.choices#>'{starting_equipment,picks}') IS DISTINCT FROM canonical->'selections' THEN
    RETURN '{"status":"conflict"}'::jsonb; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('content_id',r.content_id,'content_version',r.content_version)
    ORDER BY r.content_id,r.content_version),'[]') INTO actual_refs FROM public.character_content_refs r WHERE r.character_id=target;
  IF actual_refs IS DISTINCT FROM p_request->'expected_refs' THEN RETURN '{"status":"conflict"}'::jsonb; END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,'award_equipment');
  SELECT pg_catalog.jsonb_build_object('id',r.content_id,'version',r.content_version) INTO STRICT class_source
    FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.character_id=target AND v.content_type_snapshot='class' AND v.slug_snapshot=parent.choices#>>'{classes,0,slug}';
  SELECT pg_catalog.jsonb_build_object('id',r.content_id,'version',r.content_version) INTO background_source
    FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
    WHERE r.character_id=target AND v.content_type_snapshot='background' AND v.slug_snapshot=parent.choices->>'background';
  sources:=pg_catalog.jsonb_build_object('class',class_source,'background',background_source);
  IF class_source IS NULL OR sources IS DISTINCT FROM canonical->'sources' THEN RAISE EXCEPTION 'builder_award_source_mismatch' USING ERRCODE='23514'; END IF;
  FOR source IN SELECT r.content_id,r.content_version FROM public.character_content_refs r WHERE r.character_id=target LOOP
    IF NOT private.character_can_access_content_version(target,source.content_id,source.content_version) THEN
      RAISE EXCEPTION 'builder_award_source_unavailable' USING ERRCODE='42501'; END IF;
  END LOOP;
  next_state:=COALESCE(parent.state,'{}'); currency:=COALESCE(next_state->'currency','{}'); delta:=canonical#>'{plan,currency}';
  IF pg_catalog.jsonb_typeof(next_state)<>'object' OR pg_catalog.jsonb_typeof(currency)<>'object'
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_object_keys(delta) key WHERE key NOT IN ('cp','sp','ep','gp','pp')) THEN
    RAISE EXCEPTION 'builder_invalid_currency' USING ERRCODE='22023'; END IF;
  FOREACH unit IN ARRAY ARRAY['cp','sp','ep','gp','pp'] LOOP
    IF currency ? unit AND (pg_catalog.jsonb_typeof(currency->unit)<>'number' OR (currency->>unit)::numeric<>trunc((currency->>unit)::numeric))
      OR delta ? unit AND (pg_catalog.jsonb_typeof(delta->unit)<>'number' OR (delta->>unit)::numeric<>trunc((delta->>unit)::numeric)) THEN
      RAISE EXCEPTION 'builder_invalid_currency' USING ERRCODE='22023'; END IF;
    amount:=COALESCE((delta->>unit)::numeric,0);
    IF amount<0 OR amount>1000000 THEN RAISE EXCEPTION 'builder_invalid_currency' USING ERRCODE='22023'; END IF;
    currency:=pg_catalog.jsonb_set(currency,ARRAY[unit],pg_catalog.to_jsonb(COALESCE((currency->>unit)::numeric,0)+amount));
  END LOOP;
  INSERT INTO public.character_starting_grants(character_id,status) VALUES(target,'eligible') RETURNING * INTO grant_row;
  SELECT COALESCE(max(sort_order),-1)+1 INTO next_sort FROM public.character_inventory WHERE character_id=target;
  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(canonical#>'{plan,items}') LOOP
    IF NOT private.builder_exact_keys_v1(item,ARRAY['content_id','content_version','name','content_type','quantity'])
      OR pg_catalog.jsonb_typeof(item->'quantity')<>'number' OR item->>'quantity' !~ '^[1-9][0-9]{0,4}$' OR (item->>'quantity')::numeric>10000
      OR pg_catalog.jsonb_typeof(item->'name')<>'string' OR length(item->>'name') NOT BETWEEN 1 AND 500
      OR item->>'content_type' NOT IN ('weapon','armor','item')
      OR (item->'content_id'='null'::jsonb) IS DISTINCT FROM (item->'content_version'='null'::jsonb) THEN
      RAISE EXCEPTION 'builder_invalid_award_item' USING ERRCODE='22023'; END IF;
    IF item->'content_id'<>'null'::jsonb THEN
      IF NOT private.builder_uuid_v1(item->>'content_id') OR pg_catalog.jsonb_typeof(item->'content_version')<>'number'
        OR item->>'content_version' !~ '^[1-9][0-9]{0,9}$' OR (item->>'content_version')::numeric>2147483647 THEN
        RAISE EXCEPTION 'builder_invalid_award_item' USING ERRCODE='22023'; END IF;
      IF NOT private.character_can_access_content_version(target,(item->>'content_id')::uuid,(item->>'content_version')::integer)
        OR NOT EXISTS(SELECT 1 FROM public.content_versions v WHERE v.content_id=(item->>'content_id')::uuid AND v.version=(item->>'content_version')::integer
          AND v.content_type_snapshot=item->>'content_type' AND v.name_snapshot=item->>'name') THEN
        RAISE EXCEPTION 'builder_award_item_unavailable' USING ERRCODE='42501'; END IF;
    END IF;
    INSERT INTO public.character_inventory(character_id,content_id,content_version,name,content_type,quantity,sort_order,starting_grant_id)
      VALUES(target,(item->>'content_id')::uuid,(item->>'content_version')::integer,item->>'name',item->>'content_type',(item->>'quantity')::integer,next_sort,grant_row.id)
      RETURNING id INTO item_id;
    inventory_ids:=inventory_ids||pg_catalog.jsonb_build_array(item_id); next_sort:=next_sort+1;
  END LOOP;
  next_state:=pg_catalog.jsonb_set(next_state,'{currency}',currency);
  UPDATE public.characters SET state=next_state,choices=pg_catalog.jsonb_set(parent.choices,'{starting_equipment}',
    (parent.choices->'starting_equipment')||'{"confirmed":true}'::jsonb,true) WHERE id=target;
  saved:=private.finish_builder_step_v1(p_context,target);
  award_receipt:=pg_catalog.jsonb_build_object('grant_id',grant_row.id,'inventory_ids',inventory_ids,'plan',canonical->'plan','awarded_at',pg_catalog.transaction_timestamp());
  UPDATE public.character_starting_grants SET status='awarded',canonical_intent=canonical,receipt=award_receipt,
    completed_at=pg_catalog.transaction_timestamp() WHERE id=grant_row.id;
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(parent.user_id,operation,target,p_request||'{"command":"award_equipment"}'::jsonb,award_receipt,pg_catalog.transaction_timestamp());
  RETURN pg_catalog.jsonb_build_object('status','awarded','receipt',award_receipt);
END $$;

CREATE FUNCTION private.mint_builder_step_v1(context jsonb,parent public.characters,command text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ordering jsonb; protected jsonb;
BEGIN
  IF parent.campaign_id IS NOT NULL OR parent.level<>1
    OR NOT EXISTS(SELECT 1 FROM private.character_class_origin_v1 o WHERE o.character_id=parent.id AND o.creation_provenance='new_character' AND o.command_revision=1
      AND EXISTS(SELECT 1 FROM private.character_creation_commands_v1 c WHERE c.target_character_id=parent.id AND c.operation_id=o.creation_operation_id
        AND c.receipt->>'verified_actor_id'=parent.user_id::text AND c.receipt->>'receipt_kind'='bootstrap_new'))
    OR (SELECT count(*) FROM private.character_class_commands_v1 c WHERE c.character_id=parent.id)<>1
    OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 c WHERE c.character_id=parent.id AND c.receipt#>>'{canonical_intent,command}'='add_class'
      AND c.receipt->>'verified_actor_id'=parent.user_id::text AND c.receipt->>'after_class_revision'='1') THEN
    RAISE EXCEPTION 'builder_genuine_first_class_required' USING ERRCODE='42501'; END IF;
  SELECT pg_catalog.to_jsonb(o) INTO ordering FROM private.character_projection_order_v1 o WHERE character_id=parent.id;
  IF ordering IS NULL OR (ordering->>'producer_revision')::bigint<>parent.action_revision THEN
    RAISE EXCEPTION 'builder_order_unavailable' USING ERRCODE='23514'; END IF;
  protected:=private.builder_protected_graph_v1(parent.id);
  INSERT INTO private.character_builder_capabilities_v1(transaction_id,character_id,actor_id,command,context,before_parent,before_order,protected_graph,before_inventory)
  VALUES(pg_catalog.pg_current_xact_id(),parent.id,parent.user_id,command,context,pg_catalog.to_jsonb(parent),ordering,protected,
    (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=parent.id));
END $$;

CREATE FUNCTION public.character_builder_command_v1(p_context jsonb,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE parent public.characters%ROWTYPE; saved public.characters%ROWTYPE; stored private.character_builder_receipts_v1%ROWTYPE;
  target uuid; operation uuid; actor uuid; command text; fields jsonb; next_choices jsonb; receipt jsonb;
  selected public.content_versions%ROWTYPE; selected_type text; old_types text[]; choice_ids text[];
  choice jsonb; choice_count bigint; chosen jsonb; choice_key text; narrative_key text;
BEGIN
  IF pg_catalog.jsonb_typeof(p_request)<>'object' OR pg_catalog.octet_length(p_request::text)>131072
    OR p_request->'contract_version' IS DISTINCT FROM '1'::jsonb
    OR NOT private.builder_uuid_v1(p_request->>'character_id') OR NOT private.builder_uuid_v1(p_request->>'operation_id')
    OR pg_catalog.jsonb_typeof(p_request->'command')<>'string' THEN
    RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  target:=(p_request->>'character_id')::uuid; operation:=(p_request->>'operation_id')::uuid; command:=p_request->>'command';
  IF command='resolve_builder' THEN
    IF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command']) THEN
      RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023'; END IF;
  ELSIF NOT private.builder_exact_keys_v1(p_request,ARRAY['contract_version','character_id','operation_id','command','fields'])
    OR command NOT IN ('select_race','select_subrace','clear_race','clear_subrace','race_choice','select_background',
      'background_choice','background_narrative','save_abilities','select_equipment')
    OR pg_catalog.jsonb_typeof(p_request->'fields')<>'object' THEN
    RAISE EXCEPTION 'builder_invalid_request' USING ERRCODE='22023';
  END IF;
  fields:=p_request->'fields';
  parent:=private.begin_builder_step_v1(p_context,target,command,true); actor:=parent.user_id;
  SELECT * INTO stored FROM private.character_builder_receipts_v1 WHERE actor_id=actor AND operation_id=operation;
  IF FOUND THEN
    IF stored.character_id<>target OR stored.request->>'command'='award_equipment' THEN
      RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    IF command='resolve_builder' THEN RETURN pg_catalog.jsonb_build_object('status','recorded','receipt',stored.receipt); END IF;
    IF stored.request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'builder_operation_intent_conflict' USING ERRCODE='23505'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','replayed','receipt',stored.receipt);
  END IF;
  IF command='resolve_builder' THEN RETURN '{"status":"absent"}'::jsonb; END IF;
  PERFORM private.mint_builder_step_v1(p_context,parent,command);
  next_choices:=COALESCE(parent.choices,'{}');
  IF command IN ('select_race','select_subrace','select_background') THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['content_id','content_version'])
      OR NOT private.builder_uuid_v1(fields->>'content_id') OR pg_catalog.jsonb_typeof(fields->'content_version')<>'number'
      OR fields->>'content_version' !~ '^[1-9][0-9]{0,9}$' OR (fields->>'content_version')::numeric>2147483647 THEN
      RAISE EXCEPTION 'builder_invalid_selection' USING ERRCODE='22023'; END IF;
    selected_type:=CASE command WHEN 'select_race' THEN 'race' WHEN 'select_subrace' THEN 'subrace' ELSE 'background' END;
    SELECT v.* INTO selected FROM public.content_versions v JOIN public.content_definitions d ON d.id=v.content_id AND d.version=v.version
      WHERE v.content_id=(fields->>'content_id')::uuid AND v.version=(fields->>'content_version')::integer
        AND v.system_id_snapshot=parent.system_id AND v.content_type_snapshot=selected_type AND NOT d.is_retired
        AND private.character_can_access_content_version(parent.id,v.content_id,v.version) FOR SHARE OF v,d;
    IF NOT FOUND THEN RAISE EXCEPTION 'builder_content_unavailable' USING ERRCODE='42501'; END IF;
    IF command='select_background' THEN
      PERFORM public.set_character_background(target,selected.content_id,selected.version);
    ELSE
      IF selected_type='subrace' AND (selected.data_snapshot->>'parent_race' IS DISTINCT FROM parent.choices->>'race'
        OR NOT EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
          WHERE r.character_id=target AND v.content_type_snapshot='race' AND v.slug_snapshot=parent.choices->>'race')) THEN
        RAISE EXCEPTION 'builder_subrace_parent_mismatch' USING ERRCODE='22023'; END IF;
      old_types:=CASE selected_type WHEN 'race' THEN ARRAY['race','subrace'] ELSE ARRAY['subrace'] END;
      SELECT COALESCE(array_agg(e.value->>'choice_id'),'{}') INTO choice_ids FROM public.character_content_refs r
        JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
        WHERE r.character_id=target AND v.content_type_snapshot=ANY(old_types) AND e.value->>'type'='choice';
      next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-choice_ids,true);
      IF selected_type='race' THEN next_choices:=next_choices-'subrace'; END IF;
      next_choices:=pg_catalog.jsonb_set(next_choices,ARRAY[selected_type],pg_catalog.to_jsonb(selected.slug_snapshot),true);
      DELETE FROM public.character_content_refs r USING public.content_versions v WHERE r.character_id=target
        AND v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot=ANY(old_types);
      UPDATE public.characters SET choices=next_choices WHERE id=target;
      INSERT INTO public.character_content_refs(character_id,content_id,content_version,context,choice_source)
        VALUES(target,selected.content_id,selected.version,pg_catalog.jsonb_build_object('source',selected_type),NULL);
    END IF;
  ELSIF command IN ('clear_race','clear_subrace') THEN
    IF NOT private.builder_exact_keys_v1(fields,'{}'::text[]) THEN RAISE EXCEPTION 'builder_invalid_clear' USING ERRCODE='22023'; END IF;
    old_types:=CASE command WHEN 'clear_race' THEN ARRAY['race','subrace'] ELSE ARRAY['subrace'] END;
    SELECT COALESCE(array_agg(e.value->>'choice_id'),'{}') INTO choice_ids FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target AND v.content_type_snapshot=ANY(old_types) AND e.value->>'type'='choice';
    next_choices:=next_choices-old_types;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')-choice_ids,true);
    DELETE FROM public.character_content_refs r USING public.content_versions v WHERE r.character_id=target
      AND v.content_id=r.content_id AND v.version=r.content_version AND v.content_type_snapshot=ANY(old_types);
    UPDATE public.characters SET choices=next_choices WHERE id=target;
  ELSIF command='save_abilities' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['method','scores','expected_method','expected_scores'])
      OR pg_catalog.jsonb_typeof(fields->'method')<>'string'
      OR pg_catalog.jsonb_typeof(fields->'scores')<>'object' OR pg_catalog.jsonb_typeof(fields->'expected_scores')<>'object'
      OR pg_catalog.jsonb_typeof(fields->'expected_method') NOT IN ('string','null') THEN
      RAISE EXCEPTION 'builder_invalid_abilities' USING ERRCODE='22023'; END IF;
    PERFORM public.save_character_abilities(target,fields->>'method',fields->'scores',fields->>'expected_method',fields->'expected_scores');
  ELSIF command='select_equipment' THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['selections','picks']) OR NOT private.builder_string_map_v1(fields->'selections')
      OR NOT private.builder_string_map_v1(fields->'picks') OR parent.choices#>'{starting_equipment,confirmed}'='true'::jsonb THEN
      RAISE EXCEPTION 'builder_invalid_equipment_selection' USING ERRCODE='22023'; END IF;
    UPDATE public.characters SET choices=pg_catalog.jsonb_set(next_choices,'{starting_equipment}',fields||'{"confirmed":false}'::jsonb,true) WHERE id=target;
  ELSIF command IN ('race_choice','background_choice') THEN
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['choice_id','selections']) OR pg_catalog.jsonb_typeof(fields->'choice_id')<>'string'
      OR length(fields->>'choice_id') NOT BETWEEN 1 AND 200 OR pg_catalog.jsonb_typeof(fields->'selections')<>'array'
      OR pg_catalog.jsonb_array_length(fields->'selections')>100
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(fields->'selections') e(value) WHERE pg_catalog.jsonb_typeof(value)<>'string' OR length(value#>>'{}') NOT BETWEEN 1 AND 300)
      OR (SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements(fields->'selections'))<>pg_catalog.jsonb_array_length(fields->'selections') THEN
      RAISE EXCEPTION 'builder_invalid_choice' USING ERRCODE='22023'; END IF;
    old_types:=CASE command WHEN 'race_choice' THEN ARRAY['race','subrace'] ELSE ARRAY['background'] END;
    SELECT count(*),jsonb_agg(e.value)->0 INTO choice_count,choice FROM public.character_content_refs r
      JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(v.effects_snapshot) e(value)
      WHERE r.character_id=target AND v.content_type_snapshot=ANY(old_types) AND e.value->>'type'='choice' AND e.value->>'choice_id'=fields->>'choice_id';
    IF choice_count<>1 OR choice->>'choose' !~ '^[1-9][0-9]{0,2}$'
      OR pg_catalog.jsonb_array_length(fields->'selections')>(choice->>'choose')::integer THEN
      RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
    FOR chosen IN SELECT value FROM pg_catalog.jsonb_array_elements(fields->'selections') LOOP
      IF pg_catalog.jsonb_typeof(choice->'from')='array' THEN
        IF NOT (choice->'from') @> pg_catalog.jsonb_build_array(chosen) THEN RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
      ELSIF choice->>'from'='all_languages' OR choice->>'from'='any' AND choice->>'grant_type'='language' THEN
        IF NOT EXISTS(SELECT 1 FROM public.content_definitions d WHERE d.system_id=parent.system_id AND d.content_type='language'
          AND NOT d.is_retired AND d.slug=chosen#>>'{}' AND private.character_can_access_content_version(target,d.id,d.version))
          OR EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
            WHERE r.character_id=target AND (COALESCE(v.data_snapshot->'languages','[]') @> pg_catalog.jsonb_build_array(chosen)
              OR COALESCE(v.data_snapshot->'languageProfs','[]') @> pg_catalog.jsonb_build_array(chosen))) THEN
          RAISE EXCEPTION 'builder_choice_unavailable' USING ERRCODE='22023'; END IF;
      ELSE RAISE EXCEPTION 'builder_choice_category_unavailable' USING ERRCODE='22023'; END IF;
    END LOOP;
    next_choices:=pg_catalog.jsonb_set(next_choices,'{resolved_choices}',COALESCE(next_choices->'resolved_choices','{}')
      ||pg_catalog.jsonb_build_object(fields->>'choice_id',fields->'selections'),true);
    UPDATE public.characters SET choices=next_choices WHERE id=target;
  ELSIF command='background_narrative' THEN
    narrative_key:=fields->>'key';
    IF NOT private.builder_exact_keys_v1(fields,ARRAY['key','values']) OR narrative_key NOT IN ('personality_traits','ideals','bonds','flaws')
      OR pg_catalog.jsonb_typeof(fields->'values')<>'array' OR pg_catalog.jsonb_array_length(fields->'values')>20
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(fields->'values') e(value) WHERE pg_catalog.jsonb_typeof(value)<>'string'
        OR length(pg_catalog.btrim(value#>>'{}')) NOT BETWEEN 1 AND 2000)
      OR NOT EXISTS(SELECT 1 FROM public.character_content_refs r JOIN public.content_versions v ON v.content_id=r.content_id AND v.version=r.content_version
        WHERE r.character_id=target AND v.content_type_snapshot='background' AND v.slug_snapshot=parent.choices->>'background') THEN
      RAISE EXCEPTION 'builder_invalid_narrative' USING ERRCODE='22023'; END IF;
    UPDATE public.characters SET choices=pg_catalog.jsonb_set(next_choices,ARRAY[narrative_key],fields->'values',true) WHERE id=target;
  END IF;
  saved:=private.finish_builder_step_v1(p_context,target);
  receipt:=pg_catalog.jsonb_build_object('operation_id',operation,'character_id',target,'actor_id',actor,'command',command,'fields',fields,
    'saved_choices',saved.choices,'saved_scores',saved.base_stats,'action_revision',saved.action_revision::text);
  INSERT INTO private.character_builder_receipts_v1(actor_id,operation_id,character_id,request,receipt,created_at)
    VALUES(actor,operation,target,p_request,receipt,pg_catalog.transaction_timestamp());
  RETURN pg_catalog.jsonb_build_object('status','applied','receipt',receipt);
END $$;

CREATE FUNCTION private.apply_builder_step_order_v1(target uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap jsonb; ordering private.character_projection_order_v1%ROWTYPE; parent public.characters%ROWTYPE;
  next_pins uuid[]; next_inventory uuid[]; before_pins uuid[]; before_inventory uuid[];
BEGIN
  cap:=private.read_builder_capability_v1(target);
  IF cap IS NULL THEN RAISE EXCEPTION 'builder_order_capability_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=(cap->>'actor_id')::uuid;
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=target FOR UPDATE;
  IF NOT FOUND OR ordering.producer_revision<>parent.action_revision
    OR (pg_catalog.to_jsonb(ordering)-'producer_revision') IS DISTINCT FROM ((cap->'before_order')-'producer_revision') THEN
    RAISE EXCEPTION 'builder_order_before_changed' USING ERRCODE='23514'; END IF;
  before_pins:=ordering.pins; before_inventory:=ordering.inventory;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_pins FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(before_pins) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_content_refs ref WHERE ref.id=value AND ref.character_id=target)
    UNION ALL SELECT ref.id,pg_catalog.cardinality(before_pins)+row_number() OVER(ORDER BY ref.created_at,ref.id)
      FROM public.character_content_refs ref WHERE ref.character_id=target AND NOT ref.id=ANY(before_pins)) r;
  SELECT COALESCE(array_agg(r.id ORDER BY r.position),'{}') INTO next_inventory FROM (
    SELECT value AS id,position FROM pg_catalog.unnest(before_inventory) WITH ORDINALITY old(value,position)
      WHERE EXISTS(SELECT 1 FROM public.character_inventory item WHERE item.id=value AND item.character_id=target)
    UNION ALL SELECT item.id,pg_catalog.cardinality(before_inventory)+row_number() OVER(ORDER BY item.sort_order,item.created_at,item.id)
      FROM public.character_inventory item WHERE item.character_id=target AND NOT item.id=ANY(before_inventory)) r;
  IF cap->>'command'<>'award_equipment' AND next_inventory IS DISTINCT FROM before_inventory THEN
    RAISE EXCEPTION 'builder_inventory_changed' USING ERRCODE='23514'; END IF;
  UPDATE private.character_projection_order_v1 SET pins=next_pins,inventory=next_inventory WHERE character_id=target;
END $$;
ALTER FUNCTION private.apply_builder_step_order_v1(uuid) OWNER TO inkborne_hit_die_authority_owner;
GRANT UPDATE(inventory) ON private.character_projection_order_v1 TO inkborne_hit_die_authority_owner;

CREATE FUNCTION private.finish_builder_step_v1(context jsonb,target uuid) RETURNS public.characters
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap private.character_builder_capabilities_v1%ROWTYPE; parent public.characters%ROWTYPE;
BEGIN
  SELECT * INTO cap FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'builder_capability_required' USING ERRCODE='42501'; END IF;
  PERFORM private.lock_builder_character_rows_v1(context,target);
  SELECT * INTO parent FROM public.characters WHERE id=target AND user_id=cap.actor_id;
  IF NOT FOUND OR private.builder_protected_graph_v1(target) IS DISTINCT FROM cap.protected_graph
    OR parent.choices->'classes' IS DISTINCT FROM cap.before_parent->'choices'->'classes'
    OR (pg_catalog.to_jsonb(parent)-ARRAY['choices','base_stats','state','action_revision'])
      IS DISTINCT FROM (cap.before_parent-ARRAY['choices','base_stats','state','action_revision'])
    OR cap.command<>'save_abilities' AND pg_catalog.to_jsonb(parent.base_stats) IS DISTINCT FROM cap.before_parent->'base_stats'
    OR cap.command<>'award_equipment' AND pg_catalog.to_jsonb(parent.state) IS DISTINCT FROM cap.before_parent->'state'
    OR cap.command<>'award_equipment' AND (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.id),'[]') FROM public.character_inventory i WHERE i.character_id=target)
      IS DISTINCT FROM cap.before_inventory THEN
    RAISE EXCEPTION 'builder_protected_state_changed' USING ERRCODE='23514'; END IF;
  PERFORM private.apply_builder_step_order_v1(target);
  DELETE FROM private.character_builder_capabilities_v1 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND character_id=target;
  RETURN parent;
END $$;

-- Complete closure is atomic with creation. No transient default PUBLIC entry
-- is externally visible; unexpected installer defaults are removed only on the
-- new routines, not on any pre-existing role/schema or legacy object.
DO $closure$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'private.builder_exact_keys_v1(jsonb,text[])','private.builder_uuid_v1(text)','private.builder_string_map_v1(jsonb)',
    'private.builder_protected_graph_v1(uuid)','private.read_builder_capability_v1(uuid)',
    'private.first_class_materialization_inputs_v1(uuid,text)','private.begin_builder_step_v1(jsonb,uuid,text,boolean)',
    'private.mint_builder_step_v1(jsonb,public.characters,text)','private.finish_builder_step_v1(jsonb,uuid)',
    'private.preserve_builder_starting_receipt_v1()','private.protect_builder_inventory_provenance_v1()',
    'public.character_builder_command_v1(jsonb,jsonb)','public.commit_character_builder_equipment_v1(jsonb,jsonb)'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO postgres',signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role,inkborne_class_origin_owner,inkborne_hit_die_authority_owner',signature);
  END LOOP;
END $closure$;
REVOKE ALL ON FUNCTION private.apply_builder_step_order_v1(uuid) FROM PUBLIC,anon,authenticated,service_role,postgres,inkborne_class_origin_owner;
GRANT EXECUTE ON FUNCTION private.apply_builder_step_order_v1(uuid) TO postgres,inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION private.read_builder_capability_v1(uuid) TO inkborne_hit_die_authority_owner;
GRANT EXECUTE ON FUNCTION public.character_builder_command_v1(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_character_builder_equipment_v1(jsonb,jsonb) TO service_role;
DO $closed$
BEGIN
  IF pg_catalog.has_schema_privilege('service_role','private','USAGE')
    OR pg_catalog.has_function_privilege('anon','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.character_builder_command_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.commit_character_builder_equipment_v1(jsonb,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.commit_character_builder_equipment_v1(jsonb,jsonb)','EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      WHERE c.oid IN ('private.character_builder_receipts_v1'::regclass,'private.character_builder_capabilities_v1'::regclass)
        AND a.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'builder_privilege_closure_failed' USING ERRCODE='42501'; END IF;
END $closed$;
COMMIT;
