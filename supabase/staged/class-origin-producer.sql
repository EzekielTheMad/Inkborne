-- P1a SOURCE ONLY. Never a migration, seed, runtime authorization or cutover.
-- Requires frozen R09 kernel/authority stage 66621332. Do not alter those files.
-- No producer, shared metadata revision branch, order producer or positive Auth.
BEGIN;
CREATE ROLE inkborne_class_origin_owner NOLOGIN NOBYPASSRLS NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA public, private TO inkborne_class_origin_owner;
DO $$ BEGIN
  IF pg_catalog.has_schema_privilege('inkborne_class_origin_owner','public','CREATE')
    OR pg_catalog.has_schema_privilege('inkborne_class_origin_owner','private','CREATE') THEN
    RAISE EXCEPTION 'Runtime CREATE requires deployment reconciliation' USING ERRCODE='42501';
  END IF;
END $$;

CREATE TABLE private.class_origin_gate_v1 (
  singleton boolean PRIMARY KEY CHECK(singleton), enabled boolean NOT NULL DEFAULT false CHECK(NOT enabled)
);
INSERT INTO private.class_origin_gate_v1(singleton) VALUES(true);
CREATE TABLE private.character_class_origin_v1 (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  schema_version integer NOT NULL CHECK(schema_version=1), system_id uuid NOT NULL,
  origin_status text NOT NULL CHECK(origin_status IN ('draft','recorded','legacy_unavailable')),
  origin_occurrence_id uuid, creation_provenance text CHECK(creation_provenance IN ('new_character','fresh_draft_copy','confirmed_copy')),
  creation_operation_id uuid, source_draft_operation_id uuid, role_proof jsonb,
  command_revision bigint NOT NULL CHECK(command_revision>=0)
);
CREATE TABLE private.character_class_occurrences_v1 (
  id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  system_id uuid NOT NULL, content_id uuid NOT NULL, content_version integer NOT NULL CHECK(content_version>0),
  class_slug text NOT NULL CHECK(length(class_slug) BETWEEN 1 AND 200),
  lifecycle text NOT NULL CHECK(lifecycle IN ('provisional','accepted','ended')),
  selected_at timestamptz NOT NULL, acquired_character_level integer CHECK(acquired_character_level BETWEEN 1 AND 20),
  acquisition_operation_id uuid, accepted_at timestamptz, ended_at timestamptz,
  controller_ref_id uuid, subclass_ref_id uuid,
  FOREIGN KEY(content_id,content_version) REFERENCES public.content_versions(content_id,version) ON DELETE RESTRICT,
  CHECK((lifecycle='ended')=(ended_at IS NOT NULL)),
  CHECK(lifecycle<>'provisional' OR (acquired_character_level IS NULL AND acquisition_operation_id IS NULL AND accepted_at IS NULL)),
  CHECK(lifecycle<>'accepted' OR (acquisition_operation_id IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE UNIQUE INDEX class_origin_active_slug_v1 ON private.character_class_occurrences_v1(character_id,class_slug) WHERE lifecycle<>'ended';
CREATE UNIQUE INDEX class_origin_active_ref_v1 ON private.character_class_occurrences_v1(character_id,controller_ref_id) WHERE lifecycle<>'ended';
CREATE INDEX class_origin_occurrence_parent_v1 ON private.character_class_occurrences_v1(character_id,id);
CREATE TABLE private.class_save_occurrence_manifests_v1 (
  content_id uuid NOT NULL, content_version integer NOT NULL CHECK(content_version>0), system_id uuid NOT NULL,
  compiler_id text NOT NULL CHECK(compiler_id='private-basic-class-v1'),
  body jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(body)='object' AND pg_catalog.octet_length(body::text)<=131072),
  PRIMARY KEY(content_id,content_version),
  FOREIGN KEY(content_id,content_version) REFERENCES public.content_versions(content_id,version) ON DELETE RESTRICT
);
CREATE TABLE private.character_class_commands_v1 (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL, receipt jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(receipt)='object'),
  PRIMARY KEY(character_id,operation_id)
);
CREATE TABLE private.character_creation_commands_v1 (
  verified_actor_id uuid NOT NULL, operation_id uuid NOT NULL,
  target_character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  receipt jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(receipt)='object'),
  PRIMARY KEY(verified_actor_id,operation_id), UNIQUE(target_character_id)
);
CREATE TABLE private.class_writer_acceptance_v1 (
  acceptance_id uuid PRIMARY KEY, transaction_id xid8 NOT NULL, verified_actor_id uuid NOT NULL,
  target_character_id uuid NOT NULL,
  acceptance_kind text NOT NULL CHECK(acceptance_kind IN ('class_transition','bootstrap_new','bootstrap_copy')),
  before_parent jsonb, before_origin jsonb, preinsert_proof jsonb,
  expected_graph jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(expected_graph)='object' AND pg_catalog.octet_length(expected_graph::text)<=4194304),
  planned_transitions jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(planned_transitions)='array' AND pg_catalog.jsonb_array_length(planned_transitions) BETWEEN 1 AND 1024),
  receipt jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(receipt)='object'),
  revision_transition_consumed boolean NOT NULL DEFAULT false,
  finalized boolean NOT NULL DEFAULT false,
  UNIQUE(transaction_id,target_character_id),
  CHECK((acceptance_kind='class_transition')=(before_parent IS NOT NULL AND before_origin IS NOT NULL)),
  CHECK(acceptance_kind='class_transition' OR (before_parent IS NULL AND before_origin IS NULL AND NOT revision_transition_consumed))
);
CREATE TABLE private.class_writer_row_transitions_v1 (
  acceptance_id uuid NOT NULL REFERENCES private.class_writer_acceptance_v1(acceptance_id) ON DELETE RESTRICT,
  relation_key text NOT NULL CHECK(relation_key IN ('origin','occurrence','class_receipt','creation_receipt')),
  row_key jsonb NOT NULL CHECK(pg_catalog.jsonb_typeof(row_key)='array' AND pg_catalog.jsonb_array_length(row_key) BETWEEN 1 AND 2),
  before_row jsonb, after_row jsonb, consumed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(acceptance_id,relation_key,row_key), CHECK(before_row IS NOT NULL OR after_row IS NOT NULL)
);
-- Completed journal is retained; consumed entries cannot authorize another write.
-- Deliberately no marker issuance, compiler writer, readiness mutation or public RPC.
DO $$ DECLARE relation_name text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['class_origin_gate_v1','character_class_origin_v1','character_class_occurrences_v1',
    'class_save_occurrence_manifests_v1','character_class_commands_v1','character_creation_commands_v1',
    'class_writer_acceptance_v1','class_writer_row_transitions_v1'] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',relation_name);
    EXECUTE pg_catalog.format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',relation_name);
    EXECUTE pg_catalog.format('GRANT SELECT ON private.%I TO inkborne_class_origin_owner',relation_name);
    EXECUTE pg_catalog.format('CREATE POLICY class_origin_internal_read ON private.%I FOR SELECT TO inkborne_class_origin_owner USING(true)',relation_name);
  END LOOP;
END $$;
GRANT INSERT,UPDATE ON private.character_class_origin_v1,private.character_class_occurrences_v1,
  private.class_writer_acceptance_v1,private.class_writer_row_transitions_v1 TO inkborne_class_origin_owner;
GRANT INSERT ON private.character_class_commands_v1,private.character_creation_commands_v1 TO inkborne_class_origin_owner;
-- No manifest INSERT granted: the real compiler transaction is a future producer.
DO $$ DECLARE relation_name text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['character_class_origin_v1','character_class_occurrences_v1','class_writer_acceptance_v1',
    'class_writer_row_transitions_v1','character_class_commands_v1','character_creation_commands_v1'] LOOP
    EXECUTE pg_catalog.format('CREATE POLICY class_origin_internal_insert ON private.%I FOR INSERT TO inkborne_class_origin_owner WITH CHECK(true)',relation_name);
  END LOOP;
  FOREACH relation_name IN ARRAY ARRAY['character_class_origin_v1','character_class_occurrences_v1','class_writer_acceptance_v1','class_writer_row_transitions_v1'] LOOP
    EXECUTE pg_catalog.format('CREATE POLICY class_origin_internal_update ON private.%I FOR UPDATE TO inkborne_class_origin_owner USING(true) WITH CHECK(true)',relation_name);
  END LOOP;
END $$;
GRANT SELECT ON public.characters,public.character_content_refs,public.character_inventory,public.character_spells,
  public.character_feature_grants,public.character_spell_grants,public.content_versions,
  private.character_projection_order_v1,private.character_writer_guard_v1 TO inkborne_class_origin_owner;
-- Only the immutable key/guard marker for FOR UPDATE visibility, no actual mutation.
GRANT UPDATE(id) ON public.characters TO inkborne_class_origin_owner;
GRANT UPDATE(marker) ON private.character_writer_guard_v1 TO inkborne_class_origin_owner;
CREATE POLICY class_origin_parent_read ON public.characters FOR SELECT TO inkborne_class_origin_owner USING(true);
CREATE POLICY class_origin_parent_lock ON public.characters FOR UPDATE TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
CREATE POLICY class_origin_parent_no_update ON public.characters AS RESTRICTIVE FOR UPDATE TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
CREATE POLICY class_origin_guard_read ON private.character_writer_guard_v1 FOR SELECT TO inkborne_class_origin_owner USING(true);
CREATE POLICY class_origin_guard_lock ON private.character_writer_guard_v1 FOR UPDATE TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
CREATE POLICY class_origin_guard_no_update ON private.character_writer_guard_v1 AS RESTRICTIVE FOR UPDATE TO inkborne_class_origin_owner USING(true) WITH CHECK(false);
DO $$ DECLARE relation_name text; BEGIN
  FOREACH relation_name IN ARRAY ARRAY['character_content_refs','character_inventory','character_spells','character_feature_grants','character_spell_grants','content_versions'] LOOP
    EXECUTE pg_catalog.format('CREATE POLICY class_origin_internal_read ON public.%I FOR SELECT TO inkborne_class_origin_owner USING(true)',relation_name);
  END LOOP;
END $$;
CREATE POLICY class_origin_order_read ON private.character_projection_order_v1 FOR SELECT TO inkborne_class_origin_owner USING(true);
GRANT EXECUTE ON FUNCTION private.lock_character_writer_guard_v1() TO inkborne_class_origin_owner;

CREATE FUNCTION private.require_class_origin_auth_v1(p_context jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ BEGIN
  -- Shape, actor ID, GUC or service role is not verified token/session/config authority.
  RAISE EXCEPTION 'auth_unavailable' USING ERRCODE='P0001';
END $$;
CREATE FUNCTION private.begin_class_origin_acceptance_v1(p_context jsonb,p_intent jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM private.require_class_origin_auth_v1(p_context);
  PERFORM private.lock_character_writer_guard_v1();
  -- No accepted producer or joint metadata revision path exists in P1a.
  RAISE EXCEPTION 'class_origin_producer_unavailable' USING ERRCODE='P0001';
END $$;
CREATE FUNCTION private.class_origin_exact_keys_v1(value jsonb, keys text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT pg_catalog.jsonb_typeof(value)='object' AND
   (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(value))=pg_catalog.cardinality(keys)
   AND value ?& keys
$$;
CREATE FUNCTION private.class_origin_ids_match_v1(expected uuid[], actual uuid[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT expected IS NOT NULL AND actual IS NOT NULL
   AND pg_catalog.cardinality(expected)=pg_catalog.cardinality(actual)
   AND (SELECT pg_catalog.count(DISTINCT value) FROM pg_catalog.unnest(expected) entry(value))=pg_catalog.cardinality(expected)
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.unnest(expected) entry(value) WHERE value IS NULL)
   AND NOT EXISTS(SELECT value FROM pg_catalog.unnest(expected) entry(value) EXCEPT SELECT value FROM pg_catalog.unnest(actual) entry(value))
$$;
CREATE FUNCTION private.class_origin_decimal_v1(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
  IF value IS NULL OR value !~ '^(0|[1-9][0-9]{0,18})$' THEN RETURN false; END IF;
  RETURN value::bigint>=0;
EXCEPTION WHEN numeric_value_out_of_range THEN RETURN false;
END $$;
CREATE FUNCTION private.class_origin_uuid_v1(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN
  IF pg_catalog.jsonb_typeof(value) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  PERFORM (value#>>'{}')::uuid; RETURN true;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
CREATE FUNCTION private.class_origin_instant_v1(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE instant_value timestamptz; BEGIN
  IF pg_catalog.jsonb_typeof(value) IS DISTINCT FROM 'string'
    OR value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RETURN false; END IF;
  instant_value:=(value#>>'{}')::timestamptz;
  RETURN COALESCE(pg_catalog.isfinite(instant_value) AND instant_value>='0001-01-01T00:00:00Z'::timestamptz
    AND instant_value<'10000-01-01T00:00:00Z'::timestamptz,false);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
CREATE FUNCTION private.class_origin_row_scope_v1(relation text,row_value jsonb,target uuid,actor uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN row_value IS NULL THEN true
   WHEN pg_catalog.jsonb_typeof(row_value) IS DISTINCT FROM 'object' THEN false
   WHEN relation='creation_receipt' THEN COALESCE(row_value->>'target_character_id'=target::text AND row_value->>'verified_actor_id'=actor::text,false)
   WHEN relation IN ('origin','occurrence','class_receipt') THEN COALESCE(row_value->>'character_id'=target::text,false)
   ELSE false END
$$;
CREATE FUNCTION private.class_origin_row_key_v1(relation text,row_value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN row_value IS NULL THEN NULL
   WHEN relation='origin' THEN pg_catalog.jsonb_build_array(row_value->>'character_id')
   WHEN relation='occurrence' THEN pg_catalog.jsonb_build_array(row_value->>'id')
   WHEN relation='class_receipt' THEN pg_catalog.jsonb_build_array(row_value->>'character_id',row_value->>'operation_id')
   WHEN relation='creation_receipt' THEN pg_catalog.jsonb_build_array(row_value->>'verified_actor_id',row_value->>'operation_id')
   ELSE NULL END
$$;
CREATE FUNCTION private.class_origin_copy_lineage_shape_v1(lineage jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE source jsonb:=lineage->'immediate_source'; anchor jsonb:=lineage->'root_anchor'; original jsonb; occurrence jsonb;
  prior jsonb:=lineage->'source_copy_receipt_identity'; mapping jsonb; domain text; BEGIN
  IF NOT COALESCE(private.class_origin_exact_keys_v1(lineage,ARRAY['lineage_version','copy_kind','root_anchor','immediate_source','source_copy_receipt_identity','occurrence_map','ref_map']),false)
    OR lineage->'lineage_version' IS DISTINCT FROM '1'::jsonb
    OR lineage->>'copy_kind' NOT IN ('draft','recorded','legacy')
    OR NOT COALESCE(private.class_origin_exact_keys_v1(source,ARRAY['source_character_id','source_origin_occurrence_id','creation_operation_id','action_revision','class_revision','origin_status','lifecycle','ended_at','raw_provenance']),false)
    OR NOT private.class_origin_uuid_v1(source->'source_character_id') OR NOT private.class_origin_decimal_v1(source->>'action_revision')
    OR source->>'origin_status' IS DISTINCT FROM (CASE lineage->>'copy_kind' WHEN 'draft' THEN 'draft' WHEN 'recorded' THEN 'recorded' ELSE 'legacy_unavailable' END)
    OR pg_catalog.jsonb_typeof(source->'raw_provenance') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF source->'lifecycle' IS DISTINCT FROM 'null'::jsonb AND source->>'lifecycle' NOT IN ('provisional','accepted','ended') THEN RETURN false; END IF;
  IF source->'ended_at' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_instant_v1(source->'ended_at') THEN RETURN false; END IF;
  IF source->'source_origin_occurrence_id' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_uuid_v1(source->'source_origin_occurrence_id')
    OR source->'creation_operation_id' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_uuid_v1(source->'creation_operation_id')
    OR source->'class_revision' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_decimal_v1(source->>'class_revision')
    OR COALESCE(source->>'lifecycle'='ended',false) IS DISTINCT FROM (source->'ended_at' IS DISTINCT FROM 'null'::jsonb) THEN RETURN false; END IF;
  FOREACH domain IN ARRAY ARRAY['occurrence_map','ref_map'] LOOP
    IF pg_catalog.jsonb_typeof(lineage->domain) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(lineage->domain)>256 THEN RETURN false; END IF;
    FOR mapping IN SELECT value FROM pg_catalog.jsonb_array_elements(lineage->domain) LOOP
      IF NOT COALESCE(private.class_origin_exact_keys_v1(mapping,ARRAY['source_id','target_id']),false)
        OR NOT private.class_origin_uuid_v1(mapping->'source_id') OR NOT private.class_origin_uuid_v1(mapping->'target_id') THEN RETURN false; END IF;
    END LOOP;
    IF (SELECT pg_catalog.count(DISTINCT value->>'source_id') FROM pg_catalog.jsonb_array_elements(lineage->domain))<>pg_catalog.jsonb_array_length(lineage->domain)
      OR (SELECT pg_catalog.count(DISTINCT value->>'target_id') FROM pg_catalog.jsonb_array_elements(lineage->domain))<>pg_catalog.jsonb_array_length(lineage->domain) THEN RETURN false; END IF;
  END LOOP;
  IF lineage->>'copy_kind'<>'recorded' THEN RETURN anchor='null'::jsonb AND prior='null'::jsonb; END IF;
  IF NOT COALESCE(private.class_origin_exact_keys_v1(anchor,ARRAY['root_confirmation','root_occurrence_at_confirmation']),false)
    OR NOT private.class_origin_uuid_v1(source->'source_origin_occurrence_id') OR NOT private.class_origin_uuid_v1(source->'creation_operation_id')
    OR NOT private.class_origin_decimal_v1(source->>'class_revision') OR source->>'lifecycle' NOT IN ('accepted','ended') THEN RETURN false; END IF;
  original:=anchor#>'{root_confirmation,canonical_intent}'; occurrence:=anchor->'root_occurrence_at_confirmation';
  IF NOT COALESCE(private.class_origin_exact_keys_v1(anchor->'root_confirmation',ARRAY['canonical_intent','applied_revision','accepted_at']),false)
    OR NOT COALESCE(private.class_origin_exact_keys_v1(original,ARRAY['contract_version','command','character_id','operation_id','expected_revision','selected_occurrence_id']),false)
    OR original->'contract_version' IS DISTINCT FROM '1'::jsonb OR original->>'command' IS DISTINCT FROM 'confirm_origin'
    OR NOT private.class_origin_uuid_v1(original->'character_id') OR NOT private.class_origin_uuid_v1(original->'operation_id')
    OR NOT private.class_origin_uuid_v1(original->'selected_occurrence_id') OR NOT private.class_origin_decimal_v1(original->>'expected_revision')
    OR NOT private.class_origin_decimal_v1(anchor#>>'{root_confirmation,applied_revision}')
    OR NOT COALESCE(private.class_origin_exact_keys_v1(occurrence,ARRAY['id','character_id','system_id','content_id','content_version','class_slug','lifecycle',
      'selected_at','acquired_character_level','acquisition_operation_id','accepted_at','ended_at']),false)
    OR NOT private.class_origin_uuid_v1(occurrence->'system_id') OR NOT private.class_origin_uuid_v1(occurrence->'content_id')
    OR pg_catalog.jsonb_typeof(occurrence->'content_version') IS DISTINCT FROM 'number' OR (occurrence->>'content_version')::integer<1
    OR pg_catalog.jsonb_typeof(occurrence->'class_slug') IS DISTINCT FROM 'string' OR length(occurrence->>'class_slug') NOT BETWEEN 1 AND 200
    OR NOT private.class_origin_instant_v1(occurrence->'selected_at') OR NOT private.class_origin_instant_v1(occurrence->'accepted_at')
    OR NOT private.class_origin_instant_v1(anchor#>'{root_confirmation,accepted_at}')
    OR (occurrence->>'selected_at')::timestamptz>(occurrence->>'accepted_at')::timestamptz THEN RETURN false; END IF;
  IF (original->>'expected_revision')::bigint=9223372036854775807
    OR (anchor#>>'{root_confirmation,applied_revision}')::bigint<>(original->>'expected_revision')::bigint+1
    OR occurrence->>'character_id' IS DISTINCT FROM original->>'character_id' OR occurrence->>'id' IS DISTINCT FROM original->>'selected_occurrence_id'
    OR occurrence->>'acquisition_operation_id' IS DISTINCT FROM original->>'operation_id'
    OR occurrence->'acquired_character_level' IS DISTINCT FROM '1'::jsonb OR occurrence->>'lifecycle' IS DISTINCT FROM 'accepted'
    OR occurrence->'ended_at' IS DISTINCT FROM 'null'::jsonb OR occurrence->>'accepted_at' IS DISTINCT FROM anchor#>>'{root_confirmation,accepted_at}' THEN RETURN false; END IF;
  IF source->>'lifecycle'='ended' AND (source->>'ended_at')::timestamptz<(occurrence->>'accepted_at')::timestamptz THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(lineage->'occurrence_map') WHERE value->>'source_id'=source->>'source_origin_occurrence_id') THEN RETURN false; END IF;
  IF prior IS DISTINCT FROM 'null'::jsonb THEN
    RETURN COALESCE(private.class_origin_exact_keys_v1(prior,ARRAY['operation_id','target_character_id','root_character_id','root_occurrence_id']),false)
      AND prior->>'operation_id'=source->>'creation_operation_id' AND prior->>'target_character_id'=source->>'source_character_id'
      AND prior->>'root_character_id'=original->>'character_id' AND prior->>'root_occurrence_id'=original->>'selected_occurrence_id';
  END IF;
  RETURN source->>'source_character_id'=original->>'character_id';
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RETURN false;
END $$;
CREATE FUNCTION private.class_origin_receipt_shape_v1(receipt jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE intent jsonb:=receipt->'canonical_intent'; fields jsonb:=intent->'fields'; command text:=intent->>'command'; shape_ok boolean; BEGIN
  IF receipt->'receipt_version' IS DISTINCT FROM '1'::jsonb OR intent->'contract_version' IS DISTINCT FROM '1'::jsonb
    OR NOT private.class_origin_instant_v1(receipt->'accepted_at') THEN RETURN false; END IF;
  IF NOT private.class_origin_uuid_v1(receipt->'operation_id') OR NOT private.class_origin_uuid_v1(receipt->'target_character_id')
    OR NOT private.class_origin_uuid_v1(receipt->'verified_actor_id') OR NOT private.class_origin_uuid_v1(intent->'operation_id') THEN RETURN false; END IF;
  IF receipt->>'operation_id' IS DISTINCT FROM intent->>'operation_id' OR pg_catalog.octet_length(intent::text)>32768 THEN RETURN false; END IF;
  IF receipt->>'receipt_kind'='class_transition' THEN
    IF NOT COALESCE(private.class_origin_exact_keys_v1(receipt,ARRAY['receipt_version','receipt_kind','operation_id','verified_actor_id','target_character_id','accepted_at',
      'canonical_intent','before_action_revision','after_action_revision','before_class_revision','after_class_revision','confirmation']),false)
      OR NOT COALESCE(private.class_origin_exact_keys_v1(intent,ARRAY['contract_version','character_id','operation_id','command','expected_action_revision','expected_class_revision','fields']),false)
      OR NOT private.class_origin_decimal_v1(receipt->>'before_action_revision') OR NOT private.class_origin_decimal_v1(receipt->>'after_action_revision')
      OR NOT private.class_origin_decimal_v1(receipt->>'before_class_revision') OR NOT private.class_origin_decimal_v1(receipt->>'after_class_revision')
      OR NOT private.class_origin_decimal_v1(intent->>'expected_action_revision') OR NOT private.class_origin_decimal_v1(intent->>'expected_class_revision') THEN RETURN false; END IF;
    IF NOT private.class_origin_uuid_v1(intent->'character_id') THEN RETURN false; END IF;
    IF command='confirm_origin' THEN
      shape_ok:=private.class_origin_exact_keys_v1(fields,ARRAY['selected_occurrence_id']) AND private.class_origin_uuid_v1(fields->'selected_occurrence_id');
      IF NOT COALESCE(private.class_origin_exact_keys_v1(receipt->'confirmation',ARRAY['canonical_intent','applied_revision','accepted_at']),false)
        OR NOT COALESCE(private.class_origin_exact_keys_v1(receipt#>'{confirmation,canonical_intent}',ARRAY['contract_version','command','character_id','operation_id','expected_revision','selected_occurrence_id']),false)
        OR receipt#>'{confirmation,canonical_intent,contract_version}' IS DISTINCT FROM '1'::jsonb
        OR receipt#>>'{confirmation,canonical_intent,command}' IS DISTINCT FROM 'confirm_origin' THEN RETURN false; END IF;
    ELSIF command IN ('set_level','remove_class') THEN
      shape_ok:=private.class_origin_exact_keys_v1(fields,CASE WHEN command='set_level' THEN ARRAY['occurrence_id','level'] ELSE ARRAY['occurrence_id'] END);
      IF NOT private.class_origin_uuid_v1(fields->'occurrence_id') THEN RETURN false; END IF;
      IF command='set_level' AND (pg_catalog.jsonb_typeof(fields->'level') IS DISTINCT FROM 'number' OR fields->>'level' !~ '^[0-9]+$'
        OR (fields->>'level')::integer NOT BETWEEN 1 AND 20) THEN RETURN false; END IF;
    ELSIF command='reorder_classes' THEN
      shape_ok:=private.class_origin_exact_keys_v1(fields,ARRAY['occurrence_ids']);
      IF pg_catalog.jsonb_typeof(fields->'occurrence_ids') IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(fields->'occurrence_ids')>20 THEN RETURN false; END IF;
      IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(fields->'occurrence_ids') WHERE NOT private.class_origin_uuid_v1(value)) THEN RETURN false; END IF;
      IF (SELECT pg_catalog.count(DISTINCT value) FROM pg_catalog.jsonb_array_elements_text(fields->'occurrence_ids'))<>pg_catalog.jsonb_array_length(fields->'occurrence_ids') THEN RETURN false; END IF;
    ELSIF command IN ('add_class','set_subclass') THEN
      shape_ok:=private.class_origin_exact_keys_v1(fields,CASE WHEN command='add_class' THEN ARRAY['content_id','content_version','subclass'] ELSE ARRAY['occurrence_id','subclass'] END);
      IF command='add_class' THEN
        IF NOT private.class_origin_uuid_v1(fields->'content_id') THEN RETURN false; END IF;
        IF pg_catalog.jsonb_typeof(fields->'content_version') IS DISTINCT FROM 'number' OR fields->>'content_version' !~ '^[1-9][0-9]*$'
          OR (fields->>'content_version')::integer<1 THEN RETURN false; END IF;
      ELSE IF NOT private.class_origin_uuid_v1(fields->'occurrence_id') THEN RETURN false; END IF; END IF;
      IF fields->'subclass' IS DISTINCT FROM 'null'::jsonb THEN
        IF NOT COALESCE(private.class_origin_exact_keys_v1(fields->'subclass',ARRAY['content_id','content_version']),false)
          OR pg_catalog.jsonb_typeof(fields#>'{subclass,content_version}') IS DISTINCT FROM 'number' OR fields#>>'{subclass,content_version}' !~ '^[1-9][0-9]*$'
          OR (fields#>>'{subclass,content_version}')::integer<1 THEN RETURN false; END IF;
        IF NOT private.class_origin_uuid_v1(fields#>'{subclass,content_id}') THEN RETURN false; END IF;
      END IF;
    ELSE RETURN false; END IF;
    IF command<>'confirm_origin' AND receipt->'confirmation' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
    RETURN COALESCE(shape_ok,false);
  ELSIF receipt->>'receipt_kind' IN ('bootstrap_new','bootstrap_copy') THEN
    IF NOT COALESCE(private.class_origin_exact_keys_v1(receipt,ARRAY['receipt_version','receipt_kind','operation_id','verified_actor_id','target_character_id','accepted_at',
      'canonical_intent','initial_action_revision','initial_class_revision','initial_producer_revision','copy_lineage']),false)
      OR NOT COALESCE(private.class_origin_exact_keys_v1(intent,ARRAY['contract_version','operation_id','command','fields']),false)
      OR receipt->'initial_action_revision' IS DISTINCT FROM '"0"'::jsonb OR receipt->'initial_class_revision' IS DISTINCT FROM '"0"'::jsonb
      OR receipt->'initial_producer_revision' IS DISTINCT FROM '"0"'::jsonb THEN RETURN false; END IF;
    IF receipt->>'receipt_kind'='bootstrap_new' THEN
      shape_ok:=command='create_character' AND private.class_origin_exact_keys_v1(fields,ARRAY['name','system_id','campaign_id']) AND receipt->'copy_lineage'='null'::jsonb;
      IF NOT private.class_origin_uuid_v1(fields->'system_id') THEN RETURN false; END IF;
    ELSE
      shape_ok:=command='copy_character' AND private.class_origin_exact_keys_v1(fields,ARRAY['name','campaign_id','source_character_id','expected_source_action_revision','expected_source_class_revision'])
        AND COALESCE(private.class_origin_copy_lineage_shape_v1(receipt->'copy_lineage'),false);
      IF NOT private.class_origin_uuid_v1(fields->'source_character_id') THEN RETURN false; END IF;
      IF NOT private.class_origin_decimal_v1(fields->>'expected_source_action_revision') OR (fields->'expected_source_class_revision' IS DISTINCT FROM 'null'::jsonb
        AND NOT private.class_origin_decimal_v1(fields->>'expected_source_class_revision')) THEN RETURN false; END IF;
    END IF;
    IF pg_catalog.jsonb_typeof(fields->'name') IS DISTINCT FROM 'string' OR length(pg_catalog.btrim(fields->>'name')) NOT BETWEEN 1 AND 100 THEN RETURN false; END IF;
    IF fields->'campaign_id' IS DISTINCT FROM 'null'::jsonb AND NOT private.class_origin_uuid_v1(fields->'campaign_id') THEN RETURN false; END IF;
    RETURN COALESCE(shape_ok,false);
  END IF;
  RETURN false;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RETURN false;
END $$;
CREATE FUNCTION private.class_origin_acceptance_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE parent public.characters%ROWTYPE; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Journal retained' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.finalized OR (pg_catalog.to_jsonb(NEW)-ARRAY['finalized','revision_transition_consumed'])
      IS DISTINCT FROM (pg_catalog.to_jsonb(OLD)-ARRAY['finalized','revision_transition_consumed'])
      OR (OLD.revision_transition_consumed AND NOT NEW.revision_transition_consumed) THEN
      RAISE EXCEPTION 'Immutable acceptance evidence' USING ERRCODE='42501';
    END IF;
    IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() THEN RAISE EXCEPTION 'Transaction mismatch' USING ERRCODE='42501'; END IF;
    RETURN NEW;
  END IF;
  PERFORM private.lock_character_writer_guard_v1();
  IF NEW.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR NEW.finalized OR NEW.revision_transition_consumed THEN
    RAISE EXCEPTION 'Invalid initial acceptance' USING ERRCODE='23514'; END IF;
  IF (SELECT pg_catalog.count(DISTINCT pg_catalog.jsonb_build_array(value->'relation_key',value->'row_key')) FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions))
      <>pg_catalog.jsonb_array_length(NEW.planned_transitions)
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions) WHERE NOT COALESCE(private.class_origin_exact_keys_v1(value,
      ARRAY['relation_key','row_key','before_row','after_row']),false)) THEN
    RAISE EXCEPTION 'Unique exact planned transitions required' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(NEW.planned_transitions) transition
    WHERE NOT private.class_origin_row_scope_v1(transition->>'relation_key',NULLIF(transition->'before_row','null'::jsonb),NEW.target_character_id,NEW.verified_actor_id)
      OR NOT private.class_origin_row_scope_v1(transition->>'relation_key',NULLIF(transition->'after_row','null'::jsonb),NEW.target_character_id,NEW.verified_actor_id)
      OR transition->'before_row' IS DISTINCT FROM 'null'::jsonb AND private.class_origin_row_key_v1(transition->>'relation_key',transition->'before_row') IS DISTINCT FROM transition->'row_key'
      OR transition->'after_row' IS DISTINCT FROM 'null'::jsonb AND private.class_origin_row_key_v1(transition->>'relation_key',transition->'after_row') IS DISTINCT FROM transition->'row_key') THEN
    RAISE EXCEPTION 'Planned row target actor or immutable key mismatch' USING ERRCODE='42501'; END IF;
  IF NEW.acceptance_kind='class_transition' THEN
    SELECT * INTO parent FROM public.characters WHERE id=NEW.target_character_id FOR UPDATE;
    IF NOT FOUND OR parent.user_id<>NEW.verified_actor_id
      OR (pg_catalog.to_jsonb(parent)||pg_catalog.jsonb_build_object('action_revision',parent.action_revision::text)) IS DISTINCT FROM NEW.before_parent
      OR NEW.preinsert_proof IS NOT NULL THEN RAISE EXCEPTION 'Actual before parent mismatch' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM private.character_class_origin_v1 origin WHERE origin.character_id=parent.id AND
      (pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision',origin.command_revision::text))=NEW.before_origin) THEN
      RAISE EXCEPTION 'Actual before origin mismatch' USING ERRCODE='23514'; END IF;
  ELSE
    -- Immediate pre-INSERT capture under exclusive guard + internal all-row SELECT;
    -- no caller boolean, supplied proof, or later hidden-RLS absence inference.
    IF NEW.before_parent IS NOT NULL OR NEW.before_origin IS NOT NULL OR NEW.preinsert_proof IS NOT NULL
      OR EXISTS(SELECT 1 FROM public.characters WHERE id=NEW.target_character_id)
      OR EXISTS(SELECT 1 FROM private.character_class_origin_v1 WHERE character_id=NEW.target_character_id)
      OR EXISTS(SELECT 1 FROM private.character_projection_order_v1 WHERE character_id=NEW.target_character_id) THEN
      RAISE EXCEPTION 'Bootstrap target not absent before INSERT' USING ERRCODE='23514'; END IF;
    NEW.preinsert_proof:=pg_catalog.jsonb_build_object('acceptance_id',NEW.acceptance_id,'target_character_id',NEW.target_character_id,
      'transaction_id',NEW.transaction_id::text,'captured_at',pg_catalog.clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER class_origin_acceptance_guard BEFORE INSERT OR UPDATE OR DELETE ON private.class_writer_acceptance_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_acceptance_guard_v1();

CREATE FUNCTION private.class_origin_row_transition_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Transition proof retained' USING ERRCODE='42501'; END IF;
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=NEW.acceptance_id;
  IF NOT FOUND OR j.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR j.finalized THEN
    RAISE EXCEPTION 'No pending acceptance' USING ERRCODE='42501'; END IF;
  IF NOT j.planned_transitions @> pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(NEW)-ARRAY['acceptance_id','consumed']) THEN
    RAISE EXCEPTION 'Unplanned transition' USING ERRCODE='42501'; END IF;
  IF NOT private.class_origin_row_scope_v1(NEW.relation_key,NEW.before_row,j.target_character_id,j.verified_actor_id)
    OR NOT private.class_origin_row_scope_v1(NEW.relation_key,NEW.after_row,j.target_character_id,j.verified_actor_id)
    OR NEW.before_row IS NOT NULL AND private.class_origin_row_key_v1(NEW.relation_key,NEW.before_row) IS DISTINCT FROM NEW.row_key
    OR NEW.after_row IS NOT NULL AND private.class_origin_row_key_v1(NEW.relation_key,NEW.after_row) IS DISTINCT FROM NEW.row_key THEN
    RAISE EXCEPTION 'Row target actor or immutable key mismatch' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' AND NEW.consumed OR TG_OP='UPDATE' AND (OLD.consumed OR NOT NEW.consumed
    OR (pg_catalog.to_jsonb(OLD)-'consumed') IS DISTINCT FROM (pg_catalog.to_jsonb(NEW)-'consumed')) THEN
    RAISE EXCEPTION 'Transition is single consumption' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER class_origin_row_transition_guard BEFORE INSERT OR UPDATE OR DELETE ON private.class_writer_row_transitions_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_row_transition_guard_v1();
CREATE FUNCTION private.class_origin_protected_row_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row jsonb; new_row jsonb; identity_row jsonb; computed_key jsonb:='[]'; key_name text; match_count integer; proof record; BEGIN
  IF TG_OP<>'INSERT' THEN old_row:=pg_catalog.to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN new_row:=pg_catalog.to_jsonb(NEW); END IF;
  IF TG_ARGV[0]='origin' THEN
    IF old_row IS NOT NULL THEN old_row:=old_row||pg_catalog.jsonb_build_object('command_revision',old_row->>'command_revision'); END IF;
    IF new_row IS NOT NULL THEN new_row:=new_row||pg_catalog.jsonb_build_object('command_revision',new_row->>'command_revision'); END IF;
  END IF;
  identity_row:=COALESCE(new_row,old_row);
  FOREACH key_name IN ARRAY pg_catalog.string_to_array(TG_ARGV[1],',') LOOP computed_key:=computed_key||pg_catalog.jsonb_build_array(identity_row->>key_name); END LOOP;
  SELECT pg_catalog.count(*) INTO match_count FROM private.class_writer_row_transitions_v1 transition
    JOIN private.class_writer_acceptance_v1 j USING(acceptance_id)
    WHERE transition.relation_key=TG_ARGV[0] AND transition.row_key=computed_key AND NOT transition.consumed AND NOT j.finalized
      AND j.transaction_id=pg_catalog.pg_current_xact_id() AND transition.before_row IS NOT DISTINCT FROM old_row AND transition.after_row IS NOT DISTINCT FROM new_row
      AND private.class_origin_row_scope_v1(TG_ARGV[0],old_row,j.target_character_id,j.verified_actor_id)
      AND private.class_origin_row_scope_v1(TG_ARGV[0],new_row,j.target_character_id,j.verified_actor_id)
      AND (old_row IS NULL OR private.class_origin_row_key_v1(TG_ARGV[0],old_row)=computed_key)
      AND (new_row IS NULL OR private.class_origin_row_key_v1(TG_ARGV[0],new_row)=computed_key);
  IF match_count<>1 THEN RAISE EXCEPTION 'Exact protected row proof required' USING ERRCODE='42501'; END IF;
  SELECT transition.acceptance_id INTO proof FROM private.class_writer_row_transitions_v1 transition
    JOIN private.class_writer_acceptance_v1 j USING(acceptance_id)
    WHERE transition.relation_key=TG_ARGV[0] AND transition.row_key=computed_key AND NOT transition.consumed AND NOT j.finalized
      AND j.transaction_id=pg_catalog.pg_current_xact_id() AND transition.before_row IS NOT DISTINCT FROM old_row AND transition.after_row IS NOT DISTINCT FROM new_row
      AND private.class_origin_row_scope_v1(TG_ARGV[0],old_row,j.target_character_id,j.verified_actor_id)
      AND private.class_origin_row_scope_v1(TG_ARGV[0],new_row,j.target_character_id,j.verified_actor_id)
      AND (old_row IS NULL OR private.class_origin_row_key_v1(TG_ARGV[0],old_row)=computed_key)
      AND (new_row IS NULL OR private.class_origin_row_key_v1(TG_ARGV[0],new_row)=computed_key);
  UPDATE private.class_writer_row_transitions_v1 SET consumed=true WHERE acceptance_id=proof.acceptance_id AND relation_key=TG_ARGV[0] AND row_key=computed_key;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER class_origin_origin_guard BEFORE INSERT OR UPDATE OR DELETE ON private.character_class_origin_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_protected_row_guard_v1('origin','character_id');
CREATE TRIGGER class_origin_occurrence_guard BEFORE INSERT OR UPDATE OR DELETE ON private.character_class_occurrences_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_protected_row_guard_v1('occurrence','id');
CREATE TRIGGER class_origin_class_receipt_guard BEFORE INSERT ON private.character_class_commands_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_protected_row_guard_v1('class_receipt','character_id,operation_id');
CREATE TRIGGER class_origin_creation_receipt_guard BEFORE INSERT ON private.character_creation_commands_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_protected_row_guard_v1('creation_receipt','verified_actor_id,operation_id');
CREATE FUNCTION private.class_origin_immutable_v1() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'Immutable history; lifecycle prerequisite unavailable' USING ERRCODE='42501';
END $$;
CREATE TRIGGER class_origin_manifest_immutable BEFORE UPDATE OR DELETE ON private.class_save_occurrence_manifests_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_immutable_v1();
CREATE TRIGGER class_origin_class_receipt_immutable BEFORE UPDATE OR DELETE ON private.character_class_commands_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_immutable_v1();
CREATE TRIGGER class_origin_creation_receipt_immutable BEFORE UPDATE OR DELETE ON private.character_creation_commands_v1
 FOR EACH ROW EXECUTE FUNCTION private.class_origin_immutable_v1();

CREATE FUNCTION private.class_origin_read_final_graph_v1(p_target uuid,p_occurrence_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE c public.characters%ROWTYPE; origin private.character_class_origin_v1%ROWTYPE; ordering private.character_projection_order_v1%ROWTYPE;
  actual_ids uuid[]; domain text; rows_json jsonb; graph jsonb; version_rows jsonb; required_count bigint; resolved_count bigint; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO c FROM public.characters WHERE id=p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing final parent' USING ERRCODE='23514'; END IF;
  SELECT * INTO origin FROM private.character_class_origin_v1 WHERE character_id=p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing final origin' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE character_id=p_target AND system_id IS DISTINCT FROM c.system_id) THEN
    RAISE EXCEPTION 'Retained occurrence system mismatch' USING ERRCODE='23514'; END IF;
  SELECT * INTO ordering FROM private.character_projection_order_v1 WHERE character_id=p_target;
  IF NOT FOUND OR ordering.producer_version<>1 OR ordering.producer_revision<>c.action_revision THEN
    RAISE EXCEPTION 'Order revision mismatch' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM private.character_class_occurrences_v1 WHERE character_id=p_target;
  IF NOT private.class_origin_ids_match_v1(p_occurrence_ids,actual_ids) THEN RAISE EXCEPTION 'Retained occurrence bijection mismatch' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
    FROM pg_catalog.unnest(p_occurrence_ids) WITH ORDINALITY ids(id,position)
    JOIN private.character_class_occurrences_v1 o ON o.id=ids.id AND o.character_id=p_target;
  graph:=pg_catalog.jsonb_build_object('parent',pg_catalog.to_jsonb(c)||pg_catalog.jsonb_build_object('action_revision',c.action_revision::text),
    'origin',pg_catalog.to_jsonb(origin)||pg_catalog.jsonb_build_object('command_revision',origin.command_revision::text),
    'occurrences',rows_json,'order',pg_catalog.to_jsonb(ordering)||pg_catalog.jsonb_build_object('producer_revision',ordering.producer_revision::text));
  FOREACH domain IN ARRAY ARRAY['refs','inventory','spells','feature_grants','spell_grants'] LOOP
    IF domain='refs' THEN
      SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM public.character_content_refs WHERE character_id=p_target;
      IF NOT private.class_origin_ids_match_v1(ordering.pins,actual_ids) THEN RAISE EXCEPTION 'Ref bijection mismatch' USING ERRCODE='23514'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source_row) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
        FROM pg_catalog.unnest(ordering.pins) WITH ORDINALITY ids(id,position) JOIN public.character_content_refs source_row ON source_row.id=ids.id AND source_row.character_id=p_target;
    ELSIF domain='inventory' THEN
      SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM public.character_inventory WHERE character_id=p_target;
      IF NOT private.class_origin_ids_match_v1(ordering.inventory,actual_ids) THEN RAISE EXCEPTION 'Inventory bijection mismatch' USING ERRCODE='23514'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source_row) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
        FROM pg_catalog.unnest(ordering.inventory) WITH ORDINALITY ids(id,position) JOIN public.character_inventory source_row ON source_row.id=ids.id AND source_row.character_id=p_target;
    ELSIF domain='spells' THEN
      SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM public.character_spells WHERE character_id=p_target;
      IF NOT private.class_origin_ids_match_v1(ordering.spells,actual_ids) THEN RAISE EXCEPTION 'Spell bijection mismatch' USING ERRCODE='23514'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source_row) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
        FROM pg_catalog.unnest(ordering.spells) WITH ORDINALITY ids(id,position) JOIN public.character_spells source_row ON source_row.id=ids.id AND source_row.character_id=p_target;
    ELSIF domain='feature_grants' THEN
      SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM public.character_feature_grants WHERE character_id=p_target;
      IF NOT private.class_origin_ids_match_v1(ordering.feature_grants,actual_ids) THEN RAISE EXCEPTION 'Feature grant bijection mismatch' USING ERRCODE='23514'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source_row) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
        FROM pg_catalog.unnest(ordering.feature_grants) WITH ORDINALITY ids(id,position) JOIN public.character_feature_grants source_row ON source_row.id=ids.id AND source_row.character_id=p_target;
    ELSE
      SELECT COALESCE(pg_catalog.array_agg(id),ARRAY[]::uuid[]) INTO actual_ids FROM public.character_spell_grants WHERE character_id=p_target;
      IF NOT private.class_origin_ids_match_v1(ordering.spell_grants,actual_ids) THEN RAISE EXCEPTION 'Spell grant bijection mismatch' USING ERRCODE='23514'; END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(source_row) ORDER BY ids.position),'[]'::jsonb) INTO rows_json
        FROM pg_catalog.unnest(ordering.spell_grants) WITH ORDINALITY ids(id,position) JOIN public.character_spell_grants source_row ON source_row.id=ids.id AND source_row.character_id=p_target;
    END IF;
    graph:=graph||pg_catalog.jsonb_build_object(domain,rows_json);
  END LOOP;
  WITH required AS (
    SELECT content_id,content_version FROM public.character_content_refs WHERE character_id=p_target
    UNION SELECT content_id,content_version FROM public.character_inventory WHERE character_id=p_target AND content_id IS NOT NULL
    UNION SELECT content_id,content_version FROM public.character_spells WHERE character_id=p_target AND content_id IS NOT NULL
    UNION SELECT feature_content_id,feature_version FROM public.character_feature_grants WHERE character_id=p_target
    UNION SELECT spell_content_id,spell_version FROM public.character_spell_grants WHERE character_id=p_target
    UNION SELECT content_id,content_version FROM private.character_class_occurrences_v1 WHERE character_id=p_target
  ) SELECT pg_catalog.count(*),pg_catalog.count(v.content_id),COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) ORDER BY required.content_id,required.content_version),'[]'::jsonb)
    INTO required_count,resolved_count,version_rows FROM required LEFT JOIN public.content_versions v ON v.content_id=required.content_id AND v.version=required.content_version;
  IF required_count<>resolved_count THEN RAISE EXCEPTION 'Immutable version closure incomplete' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(version_rows) WHERE value->>'system_id_snapshot' IS DISTINCT FROM c.system_id::text) THEN
    RAISE EXCEPTION 'Required immutable version system mismatch' USING ERRCODE='23514'; END IF;
  RETURN graph||pg_catalog.jsonb_build_object('versions',version_rows);
END $$;

CREATE FUNCTION private.class_origin_assert_common_v1(p_acceptance uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE j private.class_writer_acceptance_v1%ROWTYPE; graph jsonb; occurrence_ids uuid[]; choice jsonb; matching bigint; origin_id uuid; BEGIN
  PERFORM private.lock_character_writer_guard_v1();
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND OR j.transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR NOT j.finalized THEN
    RAISE EXCEPTION 'Finalized current transaction acceptance required' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id)
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id AND NOT consumed) THEN
    RAISE EXCEPTION 'All exact row proofs must be consumed' USING ERRCODE='23514'; END IF;
  IF (SELECT pg_catalog.count(*) FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id)<>pg_catalog.jsonb_array_length(j.planned_transitions)
    OR EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 transition WHERE acceptance_id=j.acceptance_id
      AND NOT j.planned_transitions @> pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(transition)-ARRAY['acceptance_id','consumed'])) THEN
    RAISE EXCEPTION 'Exact planned proof set mismatch' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM private.class_writer_row_transitions_v1 transition WHERE acceptance_id=j.acceptance_id AND
    (NOT private.class_origin_row_scope_v1(transition.relation_key,transition.before_row,j.target_character_id,j.verified_actor_id)
      OR NOT private.class_origin_row_scope_v1(transition.relation_key,transition.after_row,j.target_character_id,j.verified_actor_id)
      OR transition.before_row IS NOT NULL AND private.class_origin_row_key_v1(transition.relation_key,transition.before_row) IS DISTINCT FROM transition.row_key
      OR transition.after_row IS NOT NULL AND private.class_origin_row_key_v1(transition.relation_key,transition.after_row) IS DISTINCT FROM transition.row_key)) THEN
    RAISE EXCEPTION 'Consumed row target actor or key mismatch' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(pg_catalog.array_agg((value->>'id')::uuid ORDER BY position),ARRAY[]::uuid[]) INTO occurrence_ids
    FROM pg_catalog.jsonb_array_elements(j.expected_graph->'occurrences') WITH ORDINALITY expected(value,position);
  graph:=private.class_origin_read_final_graph_v1(j.target_character_id,occurrence_ids);
  IF NOT private.class_origin_receipt_shape_v1(j.receipt) OR graph IS DISTINCT FROM j.expected_graph OR graph#>>'{parent,user_id}' IS DISTINCT FROM j.verified_actor_id::text
    OR graph#>>'{parent,id}' IS DISTINCT FROM j.target_character_id::text
    OR graph#>>'{origin,system_id}' IS DISTINCT FROM graph#>>'{parent,system_id}'
    OR j.receipt->>'receipt_kind' IS DISTINCT FROM j.acceptance_kind
    OR j.receipt->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR j.receipt->>'verified_actor_id' IS DISTINCT FROM j.verified_actor_id::text
    OR j.receipt->>'operation_id' IS DISTINCT FROM j.receipt#>>'{canonical_intent,operation_id}' THEN
    RAISE EXCEPTION 'Final raw graph/receipt identity mismatch' USING ERRCODE='23514'; END IF;
  -- Both directions: no active occurrence without selection, no extra class pin,
  -- including fully independent-only and no-save class sources.
  IF pg_catalog.jsonb_array_length(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb))>20
    OR (SELECT pg_catalog.count(DISTINCT value->>'occurrence_id') FROM pg_catalog.jsonb_array_elements(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb)))
      <>pg_catalog.jsonb_array_length(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb))
    OR (SELECT pg_catalog.count(DISTINCT value->>'slug') FROM pg_catalog.jsonb_array_elements(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb)))
      <>pg_catalog.jsonb_array_length(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb)) THEN
    RAISE EXCEPTION 'Unique bounded class choices required' USING ERRCODE='23514'; END IF;
  FOR choice IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb)) LOOP
    SELECT pg_catalog.count(*) INTO matching FROM private.character_class_occurrences_v1 occurrence
      JOIN public.character_content_refs ref ON ref.id=occurrence.controller_ref_id AND ref.character_id=occurrence.character_id
      JOIN public.content_versions v ON v.content_id=ref.content_id AND v.version=ref.content_version
      WHERE occurrence.character_id=j.target_character_id AND occurrence.id=(choice->>'occurrence_id')::uuid AND occurrence.lifecycle<>'ended'
        AND occurrence.class_slug=choice->>'slug' AND occurrence.content_id=ref.content_id AND occurrence.content_version=ref.content_version
        AND v.content_type_snapshot='class' AND v.slug_snapshot=occurrence.class_slug AND v.system_id_snapshot=occurrence.system_id
        AND ref.context->>'source'='class';
    IF matching<>1 OR pg_catalog.jsonb_typeof(choice->'level') IS DISTINCT FROM 'number'
      OR (choice->>'level')::integer NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Selected occurrence/pin mismatch' USING ERRCODE='23514'; END IF;
    IF choice ? 'subclass' THEN
      IF NOT EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 occurrence
        JOIN public.character_content_refs ref ON ref.id=occurrence.subclass_ref_id AND ref.character_id=occurrence.character_id
        JOIN public.content_versions v ON v.content_id=ref.content_id AND v.version=ref.content_version
        WHERE occurrence.id=(choice->>'occurrence_id')::uuid AND occurrence.character_id=j.target_character_id
          AND v.content_type_snapshot='subclass' AND v.slug_snapshot=choice->>'subclass' AND v.system_id_snapshot=occurrence.system_id
          AND v.data_snapshot->>'parent_class'=occurrence.class_slug AND ref.context->>'source'='subclass' AND ref.context->>'class'=occurrence.class_slug) THEN
        RAISE EXCEPTION 'Subclass exact parent mismatch' USING ERRCODE='23514'; END IF;
    ELSIF EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE id=(choice->>'occurrence_id')::uuid AND subclass_ref_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Unselected subclass association' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF GREATEST(1,COALESCE((SELECT pg_catalog.sum((value->>'level')::integer) FROM pg_catalog.jsonb_array_elements(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb))),0))
    IS DISTINCT FROM (graph#>>'{parent,level}')::integer OR (graph#>>'{parent,level}')::integer>20 THEN
    RAISE EXCEPTION 'Total class level mismatch' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 occurrence WHERE occurrence.character_id=j.target_character_id AND occurrence.lifecycle<>'ended'
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(COALESCE(graph#>'{parent,choices,classes}','[]'::jsonb)) AS selected_choice(value) WHERE selected_choice.value->>'occurrence_id'=occurrence.id::text))
    OR EXISTS(SELECT 1 FROM public.character_content_refs ref JOIN public.content_versions v ON v.content_id=ref.content_id AND v.version=ref.content_version
      WHERE ref.character_id=j.target_character_id AND v.content_type_snapshot='class' AND NOT EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 occurrence
        WHERE occurrence.character_id=ref.character_id AND occurrence.lifecycle<>'ended' AND occurrence.controller_ref_id=ref.id))
    OR EXISTS(SELECT 1 FROM public.character_content_refs ref JOIN public.content_versions v ON v.content_id=ref.content_id AND v.version=ref.content_version
      WHERE ref.character_id=j.target_character_id AND v.content_type_snapshot='subclass' AND NOT EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 occurrence
        WHERE occurrence.character_id=ref.character_id AND occurrence.lifecycle<>'ended' AND occurrence.subclass_ref_id=ref.id)) THEN
    RAISE EXCEPTION 'Reverse class graph mismatch' USING ERRCODE='23514'; END IF;
  origin_id:=(graph#>>'{origin,origin_occurrence_id}')::uuid;
  IF graph#>>'{origin,origin_status}'='recorded' AND NOT EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE character_id=j.target_character_id AND id=origin_id) THEN
    RAISE EXCEPTION 'Recorded origin must retain its occurrence' USING ERRCODE='23514'; END IF;
  IF graph#>>'{origin,origin_status}'='draft' AND (origin_id IS NOT NULL OR graph#>'{origin,role_proof}' IS DISTINCT FROM 'null'::jsonb)
    OR graph#>>'{origin,origin_status}'='recorded' AND pg_catalog.jsonb_typeof(graph#>'{origin,role_proof}') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Origin proof state mismatch' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM private.character_class_occurrences_v1 WHERE character_id=j.target_character_id AND id=origin_id AND lifecycle<>'ended')
    AND graph#>>'{parent,choices,classes,0,occurrence_id}' IS DISTINCT FROM origin_id::text THEN
    RAISE EXCEPTION 'Recorded active origin must retain first HP position' USING ERRCODE='23514'; END IF;
  RETURN graph;
END $$;
CREATE FUNCTION private.class_origin_finalize_transition_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; graph jsonb; before_shared bigint; before_class bigint;
  selected_id uuid; selected_proof private.class_writer_row_transitions_v1%ROWTYPE; selected_occurrence private.character_class_occurrences_v1%ROWTYPE; matching bigint; BEGIN
  graph:=private.class_origin_assert_common_v1(p_acceptance);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  before_shared:=(j.before_parent->>'action_revision')::bigint; before_class:=(j.before_origin->>'command_revision')::bigint;
  IF j.acceptance_kind<>'class_transition' OR NOT j.revision_transition_consumed OR j.preinsert_proof IS NOT NULL
    OR before_shared=9223372036854775807 OR before_class=9223372036854775807
    OR (graph#>>'{parent,action_revision}')::bigint<>before_shared+1 OR (graph#>>'{origin,command_revision}')::bigint<>before_class+1
    OR j.receipt->>'before_action_revision' IS DISTINCT FROM before_shared::text OR j.receipt->>'before_class_revision' IS DISTINCT FROM before_class::text
    OR j.receipt->>'after_action_revision' IS DISTINCT FROM graph#>>'{parent,action_revision}'
    OR j.receipt->>'after_class_revision' IS DISTINCT FROM graph#>>'{origin,command_revision}'
    OR j.receipt#>>'{canonical_intent,character_id}' IS DISTINCT FROM j.target_character_id::text
    OR j.receipt#>>'{canonical_intent,expected_action_revision}' IS DISTINCT FROM before_shared::text
    OR j.receipt#>>'{canonical_intent,expected_class_revision}' IS DISTINCT FROM before_class::text
    OR NOT EXISTS(SELECT 1 FROM private.character_class_commands_v1 WHERE character_id=j.target_character_id AND operation_id=(j.receipt->>'operation_id')::uuid AND receipt=j.receipt) THEN
    RAISE EXCEPTION 'Changed transition receipt/revision mismatch' USING ERRCODE='23514'; END IF;
  IF j.receipt#>>'{canonical_intent,command}'='confirm_origin' THEN
    IF j.before_origin->>'origin_status'<>'draft' OR graph#>>'{origin,origin_status}'<>'recorded'
      OR graph#>>'{origin,origin_occurrence_id}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,selected_occurrence_id}'
      OR j.receipt#>>'{confirmation,canonical_intent,expected_revision}' IS DISTINCT FROM before_class::text
      OR j.receipt#>>'{confirmation,applied_revision}' IS DISTINCT FROM (before_class+1)::text
      OR j.receipt#>>'{confirmation,canonical_intent,character_id}' IS DISTINCT FROM j.target_character_id::text
      OR j.receipt#>>'{confirmation,canonical_intent,operation_id}' IS DISTINCT FROM j.receipt->>'operation_id'
      OR j.receipt#>>'{confirmation,canonical_intent,selected_occurrence_id}' IS DISTINCT FROM graph#>>'{origin,origin_occurrence_id}'
      OR j.receipt#>>'{confirmation,accepted_at}' IS DISTINCT FROM j.receipt->>'accepted_at'
      OR graph#>'{origin,role_proof}' IS DISTINCT FROM pg_catalog.jsonb_build_object('kind','confirmation','receipt',j.receipt->'confirmation') THEN
      RAISE EXCEPTION 'Actual metadata confirmation delta missing' USING ERRCODE='23514'; END IF;
    selected_id:=(j.receipt#>>'{canonical_intent,fields,selected_occurrence_id}')::uuid;
    SELECT pg_catalog.count(*) INTO matching FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
      AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected_id) AND consumed;
    IF matching<>1 THEN RAISE EXCEPTION 'Consumed selected occurrence confirmation required' USING ERRCODE='23514'; END IF;
    SELECT * INTO selected_proof FROM private.class_writer_row_transitions_v1 WHERE acceptance_id=j.acceptance_id
      AND relation_key='occurrence' AND row_key=pg_catalog.jsonb_build_array(selected_id) AND consumed;
    SELECT * INTO selected_occurrence FROM private.character_class_occurrences_v1 WHERE id=selected_id AND character_id=j.target_character_id;
    IF NOT FOUND OR selected_proof.before_row IS NULL OR selected_proof.before_row->>'lifecycle' IS DISTINCT FROM 'provisional'
      OR selected_proof.before_row->'acquired_character_level' IS DISTINCT FROM 'null'::jsonb
      OR selected_proof.before_row->'acquisition_operation_id' IS DISTINCT FROM 'null'::jsonb
      OR selected_proof.before_row->'accepted_at' IS DISTINCT FROM 'null'::jsonb
      OR selected_occurrence.lifecycle IS DISTINCT FROM 'accepted' OR selected_occurrence.acquired_character_level IS DISTINCT FROM 1
      OR selected_occurrence.acquisition_operation_id IS DISTINCT FROM (j.receipt->>'operation_id')::uuid
      OR selected_occurrence.accepted_at IS DISTINCT FROM (j.receipt->>'accepted_at')::timestamptz
      OR selected_occurrence.selected_at>selected_occurrence.accepted_at
      OR selected_proof.after_row IS DISTINCT FROM pg_catalog.to_jsonb(selected_occurrence)
      OR EXISTS(SELECT 1 FROM pg_catalog.unnest(ARRAY['id','character_id','system_id','content_id','content_version','class_slug','selected_at','controller_ref_id']) key(name)
        WHERE selected_proof.before_row->name IS DISTINCT FROM selected_proof.after_row->name) THEN
      RAISE EXCEPTION 'Selected confirmation occurrence transition mismatch' USING ERRCODE='23514'; END IF;
  ELSIF (j.before_origin-ARRAY['command_revision']) IS DISTINCT FROM (graph->'origin'-ARRAY['command_revision']) THEN
    RAISE EXCEPTION 'Other command cannot reseal origin' USING ERRCODE='23514';
  END IF;
END $$;
CREATE FUNCTION private.class_origin_finalize_bootstrap_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; graph jsonb; lineage jsonb; origin_occurrence jsonb; BEGIN
  graph:=private.class_origin_assert_common_v1(p_acceptance);
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF j.acceptance_kind NOT IN ('bootstrap_new','bootstrap_copy') OR j.before_parent IS NOT NULL OR j.before_origin IS NOT NULL
    OR j.revision_transition_consumed OR j.preinsert_proof->>'acceptance_id' IS DISTINCT FROM j.acceptance_id::text
    OR j.preinsert_proof->>'target_character_id' IS DISTINCT FROM j.target_character_id::text
    OR j.preinsert_proof->>'transaction_id' IS DISTINCT FROM j.transaction_id::text
    OR graph#>>'{parent,action_revision}' IS DISTINCT FROM '0' OR graph#>>'{origin,command_revision}' IS DISTINCT FROM '0' OR graph#>>'{order,producer_revision}' IS DISTINCT FROM '0'
    OR j.receipt ?| ARRAY['before_action_revision','before_class_revision','before_parent','before_state','after_action_revision','after_class_revision']
    OR j.receipt->>'initial_action_revision' IS DISTINCT FROM '0' OR j.receipt->>'initial_class_revision' IS DISTINCT FROM '0' OR j.receipt->>'initial_producer_revision' IS DISTINCT FROM '0'
    OR NOT EXISTS(SELECT 1 FROM private.character_creation_commands_v1 WHERE target_character_id=j.target_character_id AND verified_actor_id=j.verified_actor_id
      AND operation_id=(j.receipt->>'operation_id')::uuid AND receipt=j.receipt) THEN
    RAISE EXCEPTION 'Initial bootstrap proof/counters mismatch' USING ERRCODE='23514'; END IF;
  IF graph#>>'{parent,name}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,name}'
    OR graph#>'{parent,campaign_id}' IS DISTINCT FROM j.receipt#>'{canonical_intent,fields,campaign_id}'
    OR graph#>>'{origin,origin_status}'<>'legacy_unavailable' AND graph#>>'{origin,creation_operation_id}' IS DISTINCT FROM j.receipt->>'operation_id' THEN
    RAISE EXCEPTION 'Bootstrap requested identity mismatch' USING ERRCODE='23514'; END IF;
  IF j.acceptance_kind='bootstrap_new' AND (j.receipt#>>'{canonical_intent,command}'<>'create_character'
    OR graph#>>'{origin,origin_status}'<>'draft' OR graph#>'{origin,origin_occurrence_id}'<>'null'::jsonb
    OR graph#>>'{origin,creation_provenance}'<>'new_character' OR j.receipt->'copy_lineage'<>'null'::jsonb
    OR graph#>>'{parent,system_id}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,system_id}'
    OR pg_catalog.jsonb_array_length(graph->'occurrences')<>0 OR pg_catalog.jsonb_array_length(graph->'refs')<>0) THEN
    RAISE EXCEPTION 'Fresh bootstrap is not an empty genuine draft' USING ERRCODE='23514'; END IF;
  IF j.acceptance_kind='bootstrap_copy' AND (j.receipt#>>'{canonical_intent,command}'<>'copy_character'
    OR j.receipt#>>'{copy_lineage,immediate_source,source_character_id}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,source_character_id}'
    OR j.receipt#>>'{copy_lineage,immediate_source,action_revision}' IS DISTINCT FROM j.receipt#>>'{canonical_intent,fields,expected_source_action_revision}'
    OR j.receipt#>'{copy_lineage,immediate_source,class_revision}' IS DISTINCT FROM j.receipt#>'{canonical_intent,fields,expected_source_class_revision}') THEN
    RAISE EXCEPTION 'Immediate copy lineage mismatch' USING ERRCODE='23514'; END IF;
  IF j.acceptance_kind='bootstrap_copy' THEN
    lineage:=j.receipt->'copy_lineage';
    IF lineage->>'copy_kind'='recorded' THEN
      SELECT value INTO origin_occurrence FROM pg_catalog.jsonb_array_elements(graph->'occurrences')
        WHERE value->>'id'=graph#>>'{origin,origin_occurrence_id}';
      IF graph#>>'{origin,origin_status}' IS DISTINCT FROM 'recorded' OR graph#>>'{origin,creation_provenance}' IS DISTINCT FROM 'confirmed_copy'
        OR graph#>'{origin,role_proof}' IS DISTINCT FROM pg_catalog.jsonb_build_object('kind','copy_lineage','lineage_version',1,'lineage',lineage)
        OR NOT EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(lineage->'occurrence_map') mapping
          WHERE mapping->>'source_id'=lineage#>>'{immediate_source,source_origin_occurrence_id}' AND mapping->>'target_id'=origin_occurrence->>'id')
        OR origin_occurrence->>'lifecycle' IS DISTINCT FROM lineage#>>'{immediate_source,lifecycle}'
        OR (origin_occurrence->>'ended_at')::timestamptz IS DISTINCT FROM (lineage#>>'{immediate_source,ended_at}')::timestamptz
        OR origin_occurrence->>'acquisition_operation_id' IS DISTINCT FROM lineage#>>'{root_anchor,root_occurrence_at_confirmation,acquisition_operation_id}'
        OR origin_occurrence->>'content_id' IS DISTINCT FROM lineage#>>'{root_anchor,root_occurrence_at_confirmation,content_id}'
        OR origin_occurrence->'content_version' IS DISTINCT FROM lineage#>'{root_anchor,root_occurrence_at_confirmation,content_version}'
        OR origin_occurrence->>'class_slug' IS DISTINCT FROM lineage#>>'{root_anchor,root_occurrence_at_confirmation,class_slug}'
        OR origin_occurrence->>'system_id' IS DISTINCT FROM lineage#>>'{root_anchor,root_occurrence_at_confirmation,system_id}'
        OR lineage#>>'{root_anchor,root_occurrence_at_confirmation,system_id}' IS DISTINCT FROM graph#>>'{parent,system_id}'
        OR origin_occurrence->'acquired_character_level' IS DISTINCT FROM '1'::jsonb
        OR (origin_occurrence->>'selected_at')::timestamptz IS DISTINCT FROM (lineage#>>'{root_anchor,root_occurrence_at_confirmation,selected_at}')::timestamptz
        OR (origin_occurrence->>'accepted_at')::timestamptz IS DISTINCT FROM (lineage#>>'{root_anchor,root_occurrence_at_confirmation,accepted_at}')::timestamptz THEN
        RAISE EXCEPTION 'Target copy must preserve root identity and immediate lifecycle' USING ERRCODE='23514'; END IF;
    ELSIF lineage->>'copy_kind'='draft' THEN
      IF graph#>>'{origin,origin_status}' IS DISTINCT FROM 'draft' OR graph#>>'{origin,creation_provenance}' IS DISTINCT FROM 'fresh_draft_copy'
        OR graph#>'{origin,origin_occurrence_id}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Draft copy cannot seal origin' USING ERRCODE='23514'; END IF;
    ELSE
      IF graph#>>'{origin,origin_status}' IS DISTINCT FROM 'legacy_unavailable' OR graph#>'{origin,origin_occurrence_id}' IS DISTINCT FROM 'null'::jsonb THEN
        RAISE EXCEPTION 'Legacy copy cannot bootstrap role' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  -- Full real producer/materializer and multi-hop lineage bridge remain future;
  -- source shape correspondence cannot authenticate source historical lineage.
END $$;
CREATE FUNCTION private.class_origin_finalize_acceptance_v1(p_acceptance uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.class_writer_acceptance_v1%ROWTYPE; BEGIN
  SELECT * INTO j FROM private.class_writer_acceptance_v1 WHERE acceptance_id=p_acceptance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing acceptance' USING ERRCODE='23514'; END IF;
  IF j.acceptance_kind='class_transition' THEN PERFORM private.class_origin_finalize_transition_v1(p_acceptance);
  ELSIF j.acceptance_kind IN ('bootstrap_new','bootstrap_copy') THEN PERFORM private.class_origin_finalize_bootstrap_v1(p_acceptance);
  ELSE RAISE EXCEPTION 'Unknown finalizer kind' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION private.class_origin_deferred_finalizer_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  PERFORM private.class_origin_finalize_acceptance_v1(NEW.acceptance_id); RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER class_origin_acceptance_closure AFTER INSERT OR UPDATE ON private.class_writer_acceptance_v1
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_origin_deferred_finalizer_v1();
CREATE CONSTRAINT TRIGGER class_origin_transition_closure AFTER INSERT OR UPDATE ON private.class_writer_row_transitions_v1
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.class_origin_deferred_finalizer_v1();

-- Function defaults are revoked in this same source transaction. No caller gets
-- EXECUTE, owner membership, CREATE, readiness or marker mutation capability.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::pg_catalog.regprocedure AS signature FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private'
    AND (p.proname LIKE 'class_origin_%_v1' OR p.proname IN ('require_class_origin_auth_v1','begin_class_origin_acceptance_v1')) LOOP
    EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO inkborne_class_origin_owner',f.signature);
    EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  END LOOP;
END $$;
-- All R09 readiness rows remain false. No INSERT/UPDATE to readiness/order,
-- no parent action_revision privilege, no metadata bump implementation,
-- no existing public table trigger/legacy grant/RPC replacement or live producer.
COMMIT;
