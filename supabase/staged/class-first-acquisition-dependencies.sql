-- STAGED ONLY: an internal, read-only dependency descriptor for a hypothetical
-- first class level. This does not allocate a graph, prove actor/provenance,
-- accept a request, issue a receipt, or enable any acquisition path.
-- Existing materializers and application entry points remain untouched.
-- Selector semantics follow the immutable class feature/spell materializers;
-- malformed/coercive manifests and non-total feature ties are refused here.

BEGIN;

-- Fail if an earlier object exists: replacing a function would preserve any
-- unexpected prior grantees instead of establishing this closed new ACL.
CREATE FUNCTION private.resolve_first_class_dependencies_v1(
  target_character_id uuid,
  class_content_id uuid,
  class_content_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_system_id uuid;
  controller public.content_versions%ROWTYPE;
  level_entry jsonb;
  manifest_entry record;
  request_entry record;
  dependency_value jsonb;
  spell_values jsonb;
  dependency_slug text;
  dependency_level integer;
  level_number numeric;
  feature_requests jsonb := '{}'::jsonb;
  spell_requests jsonb := '{}'::jsonb;
  feature_ordinal integer := 0;
  spell_ordinal integer := 0;
  domain_size integer;
  candidate record;
  selected_candidate record;
  top_feature_tie boolean;
  feature_grants jsonb := '[]'::jsonb;
  spell_grants jsonb := '[]'::jsonb;
  active_feature_refs jsonb := '[]'::jsonb;
  active_spells jsonb := '[]'::jsonb;
  versions jsonb := '[]'::jsonb;
  version_keys jsonb := '{}'::jsonb;
  version_key text;
  version_snapshot jsonb;
  result jsonb;
BEGIN
  SELECT character.system_id INTO target_system_id
  FROM public.characters AS character
  WHERE character.id = target_character_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'First class dependency target is unavailable'
      USING ERRCODE = '23503';
  END IF;

  SELECT version.* INTO controller
  FROM public.content_versions AS version
  WHERE version.content_id = class_content_id
    AND version.version = class_content_version
    AND version.content_type_snapshot = 'class'
    AND version.system_id_snapshot = target_system_id
    AND version.source_snapshot IN ('srd', 'homebrew')
    AND private.character_can_access_content_version(
      target_character_id, version.content_id, version.version
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact first class snapshot is unavailable'
      USING ERRCODE = '23503';
  END IF;

  version_snapshot := to_jsonb(controller);
  IF octet_length(version_snapshot::text) > 4194304 THEN
    RAISE EXCEPTION 'First class dependency snapshot exceeds byte bound'
      USING ERRCODE = '54000';
  END IF;
  versions := jsonb_build_array(version_snapshot);
  version_key := controller.content_id::text || ':' || controller.version::text;
  version_keys := jsonb_build_object(version_key, true);

  -- Preserve feature whitespace literally: only blank values are forbidden.
  IF jsonb_typeof(controller.data_snapshot->'levels') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'First class requires a feature level array'
      USING ERRCODE = '22023';
  END IF;
  FOR level_entry IN
    SELECT value FROM jsonb_array_elements(controller.data_snapshot->'levels')
  LOOP
    IF jsonb_typeof(level_entry) IS DISTINCT FROM 'object'
      OR jsonb_typeof(level_entry->'level') IS DISTINCT FROM 'number'
      OR jsonb_typeof(level_entry->'features') IS DISTINCT FROM 'array'
    THEN
      RAISE EXCEPTION 'First class has a malformed feature tier'
        USING ERRCODE = '22023';
    END IF;
    IF (level_entry->>'level') !~ '^(0|[1-9][0-9]*)$' THEN
      RAISE EXCEPTION 'First class requires an integer-text feature level'
        USING ERRCODE = '22023';
    END IF;
    level_number := (level_entry->>'level')::numeric;
    IF level_number < 1 OR level_number > 20 THEN
      RAISE EXCEPTION 'First class has an invalid feature unlock level'
        USING ERRCODE = '22023';
    END IF;
    dependency_level := level_number::integer;
    FOR dependency_value IN
      SELECT value FROM jsonb_array_elements(level_entry->'features')
    LOOP
      feature_ordinal := feature_ordinal + 1;
      IF feature_ordinal > 4096 THEN
        RAISE EXCEPTION 'First class feature reference bound exceeded'
          USING ERRCODE = '54000';
      END IF;
      IF jsonb_typeof(dependency_value) IS DISTINCT FROM 'string'
        OR btrim(dependency_value #>> '{}') = ''
      THEN
        RAISE EXCEPTION 'First class has a non-text or blank feature slug'
          USING ERRCODE = '22023';
      END IF;
      dependency_slug := dependency_value #>> '{}';
      IF feature_requests ? dependency_slug THEN
        feature_requests := jsonb_set(
          feature_requests, ARRAY[dependency_slug, 'unlock_level'],
          to_jsonb(LEAST(dependency_level,
            (feature_requests->dependency_slug->>'unlock_level')::integer))
        );
      ELSE
        feature_requests := feature_requests || jsonb_build_object(
          dependency_slug, jsonb_build_object(
            'unlock_level', dependency_level, 'source_ordinal', feature_ordinal
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Absence alone means no spell grants. Explicit JSON null is malformed.
  IF controller.data_snapshot ? 'spellcastingExtra' THEN
    IF jsonb_typeof(controller.data_snapshot->'spellcastingExtra') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'First class has a malformed spell grant array'
        USING ERRCODE = '22023';
    END IF;
    FOR manifest_entry IN
      SELECT value, ordinality FROM jsonb_array_elements(
        controller.data_snapshot->'spellcastingExtra'
      ) WITH ORDINALITY
    LOOP
      IF jsonb_typeof(manifest_entry.value) = 'object' THEN
        IF COALESCE(manifest_entry.value->>'level', '') !~ '^[0-9]+$'
          OR jsonb_typeof(manifest_entry.value->'spells') IS DISTINCT FROM 'array'
        THEN
          RAISE EXCEPTION 'First class has a malformed spell tier'
            USING ERRCODE = '22023';
        END IF;
        BEGIN
          level_number := (manifest_entry.value->>'level')::numeric;
        EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
          RAISE EXCEPTION 'First class has an invalid spell unlock level'
            USING ERRCODE = '22023';
        END;
        IF level_number < 1 OR level_number > 20 THEN
          RAISE EXCEPTION 'First class has an invalid spell unlock level'
            USING ERRCODE = '22023';
        END IF;
        dependency_level := level_number::integer;
        spell_values := manifest_entry.value->'spells';
      ELSIF jsonb_typeof(manifest_entry.value) IN ('array', 'string') THEN
        IF manifest_entry.ordinality > 20 THEN
          RAISE EXCEPTION 'First class has an invalid positional spell level'
            USING ERRCODE = '22023';
        END IF;
        dependency_level := manifest_entry.ordinality::integer;
        spell_values := CASE WHEN jsonb_typeof(manifest_entry.value) = 'array'
          THEN manifest_entry.value ELSE jsonb_build_array(manifest_entry.value) END;
      ELSE
        RAISE EXCEPTION 'First class has a malformed spell grant entry'
          USING ERRCODE = '22023';
      END IF;
      FOR dependency_value IN SELECT value FROM jsonb_array_elements(spell_values)
      LOOP
        spell_ordinal := spell_ordinal + 1;
        IF spell_ordinal > 4096 THEN
          RAISE EXCEPTION 'First class spell reference bound exceeded'
            USING ERRCODE = '54000';
        END IF;
        IF jsonb_typeof(dependency_value) IS DISTINCT FROM 'string'
          OR btrim(dependency_value #>> '{}') = ''
        THEN
          RAISE EXCEPTION 'First class has a non-text or blank spell slug'
            USING ERRCODE = '22023';
        END IF;
        dependency_slug := btrim(dependency_value #>> '{}');
        IF spell_requests ? dependency_slug THEN
          spell_requests := jsonb_set(
            spell_requests, ARRAY[dependency_slug, 'unlock_level'],
            to_jsonb(LEAST(dependency_level,
              (spell_requests->dependency_slug->>'unlock_level')::integer))
          );
        ELSE
          spell_requests := spell_requests || jsonb_build_object(
            dependency_slug, jsonb_build_object(
              'unlock_level', dependency_level, 'source_ordinal', spell_ordinal
            )
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  FOR request_entry IN
    SELECT key, value FROM jsonb_each(feature_requests)
    ORDER BY (value->>'source_ordinal')::integer
  LOOP
    dependency_slug := request_entry.key;
    dependency_level := (request_entry.value->>'unlock_level')::integer;
    domain_size := 0;
    top_feature_tie := false;
    -- A bounded domain scan preserves the historical rank. It does not invent
    -- a content-id tie breaker for feature families with non-total top ranks.
    FOR candidate IN
      SELECT version.content_id, version.version, version.owner_id_snapshot,
        version.created_at
      FROM public.content_versions AS version
      WHERE version.system_id_snapshot = controller.system_id_snapshot
        AND version.content_type_snapshot = 'feature'
        AND version.slug_snapshot = dependency_slug
        AND version.created_at <= controller.created_at
        AND (
          (controller.source_snapshot = 'srd' AND version.scope_snapshot = 'platform')
          OR (controller.source_snapshot = 'homebrew' AND (
            version.owner_id_snapshot = controller.owner_id_snapshot
            OR version.scope_snapshot = 'platform'
          ))
        )
        AND private.character_can_access_content_version(
          target_character_id, version.content_id, version.version
        )
      ORDER BY (version.owner_id_snapshot IS NOT DISTINCT FROM controller.owner_id_snapshot) DESC,
        version.created_at DESC, version.version DESC
      LIMIT 4097
    LOOP
      domain_size := domain_size + 1;
      IF domain_size > 4096 THEN
        RAISE EXCEPTION 'First class feature candidate domain bound exceeded'
          USING ERRCODE = '54000';
      END IF;
      IF domain_size = 1 THEN
        selected_candidate := candidate;
      ELSIF candidate.content_id IS DISTINCT FROM selected_candidate.content_id
        AND (candidate.owner_id_snapshot IS NOT DISTINCT FROM controller.owner_id_snapshot)
          = (selected_candidate.owner_id_snapshot IS NOT DISTINCT FROM controller.owner_id_snapshot)
        AND candidate.created_at IS NOT DISTINCT FROM selected_candidate.created_at
        AND candidate.version = selected_candidate.version
      THEN
        top_feature_tie := true;
      END IF;
    END LOOP;
    IF domain_size = 0 THEN
      RAISE EXCEPTION 'First class feature dependency is unavailable'
        USING ERRCODE = '23503';
    END IF;
    IF top_feature_tie THEN
      RAISE EXCEPTION 'First class feature dependency rank is non-total'
        USING ERRCODE = '23514';
    END IF;
    feature_grants := feature_grants || jsonb_build_array(jsonb_build_object(
      'feature_slug', dependency_slug,
      'feature_content_id', selected_candidate.content_id,
      'feature_version', selected_candidate.version,
      'unlock_level', dependency_level,
      'source_ordinal', (request_entry.value->>'source_ordinal')::integer
    ));
    IF dependency_level <= 1 THEN
      active_feature_refs := active_feature_refs || jsonb_build_array(jsonb_build_object(
        'feature_slug', dependency_slug,
        'content_id', selected_candidate.content_id,
        'content_version', selected_candidate.version,
        'context', jsonb_build_object(
          'source', 'class_feature', 'controller_type', 'class',
          'controller_slug', controller.slug_snapshot,
          'feature_slug', dependency_slug, 'feature_level', dependency_level
        )
      ));
    END IF;
    version_key := selected_candidate.content_id::text || ':' || selected_candidate.version::text;
    IF NOT version_keys ? version_key THEN
      IF jsonb_array_length(versions) >= 4096 THEN
        RAISE EXCEPTION 'First class exact version bound exceeded' USING ERRCODE = '54000';
      END IF;
      SELECT to_jsonb(snapshot) INTO version_snapshot
      FROM public.content_versions AS snapshot
      WHERE snapshot.content_id = selected_candidate.content_id
        AND snapshot.version = selected_candidate.version;
      versions := versions || jsonb_build_array(version_snapshot);
      version_keys := version_keys || jsonb_build_object(version_key, true);
      IF octet_length(versions::text) > 4194304 THEN
        RAISE EXCEPTION 'First class dependency snapshots exceed byte bound' USING ERRCODE = '54000';
      END IF;
    END IF;
  END LOOP;

  FOR request_entry IN
    SELECT key, value FROM jsonb_each(spell_requests)
    ORDER BY (value->>'source_ordinal')::integer
  LOOP
    dependency_slug := request_entry.key;
    dependency_level := (request_entry.value->>'unlock_level')::integer;
    domain_size := 0;
    FOR candidate IN
      SELECT version.content_id, version.version, version.name_snapshot
      FROM public.content_versions AS version
      WHERE version.system_id_snapshot = controller.system_id_snapshot
        AND version.content_type_snapshot = 'spell'
        AND version.slug_snapshot = dependency_slug
        AND version.created_at <= controller.created_at
        AND (
          (controller.source_snapshot = 'srd' AND version.source_snapshot = 'srd'
            AND version.scope_snapshot = 'platform')
          OR (controller.source_snapshot = 'homebrew'
            AND private.character_can_access_content_version(
              target_character_id, version.content_id, version.version
            ))
        )
      ORDER BY (version.owner_id_snapshot IS NOT DISTINCT FROM controller.owner_id_snapshot) DESC,
        (version.scope_snapshot = 'platform') DESC, version.created_at DESC,
        version.version DESC, version.content_id ASC
      LIMIT 4097
    LOOP
      domain_size := domain_size + 1;
      IF domain_size > 4096 THEN
        RAISE EXCEPTION 'First class spell candidate domain bound exceeded'
          USING ERRCODE = '54000';
      END IF;
      IF domain_size = 1 THEN
        selected_candidate := candidate;
      END IF;
    END LOOP;
    IF domain_size = 0 THEN
      RAISE EXCEPTION 'First class spell dependency is unavailable' USING ERRCODE = '23503';
    END IF;
    IF private.character_can_access_content_version(
      target_character_id, selected_candidate.content_id, selected_candidate.version
    ) IS NOT TRUE THEN
      RAISE EXCEPTION 'First class spell dependency is inaccessible' USING ERRCODE = '23503';
    END IF;
    spell_grants := spell_grants || jsonb_build_array(jsonb_build_object(
      'spell_slug', dependency_slug,
      'spell_content_id', selected_candidate.content_id,
      'spell_version', selected_candidate.version,
      'spell_name', selected_candidate.name_snapshot,
      'unlock_level', dependency_level,
      'source_ordinal', (request_entry.value->>'source_ordinal')::integer
    ));
    IF dependency_level <= 1 THEN
      -- The canonical projection groups by (spell_content_id, class_slug),
      -- not slug or exact version. At first level every active unlock is 1;
      -- multiple grant slugs for one content id would need allocated grant
      -- UUIDs to break that tie. Refuse rather than invent a representative.
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(active_spells) AS active(value)
        WHERE active.value->>'content_id' = selected_candidate.content_id::text
      ) THEN
        RAISE EXCEPTION 'First class active spell representative requires allocated identity'
          USING ERRCODE = '23514';
      END IF;
      active_spells := active_spells || jsonb_build_array(jsonb_build_object(
        'spell_slug', dependency_slug,
        'content_id', selected_candidate.content_id,
        'content_version', selected_candidate.version,
        'name', selected_candidate.name_snapshot,
        'class_slug', controller.slug_snapshot,
        'is_known', false, 'is_prepared', true, 'always_prepared', true,
        'in_spellbook', false, 'source', 'feature', 'custom_data', NULL
      ));
    END IF;
    version_key := selected_candidate.content_id::text || ':' || selected_candidate.version::text;
    IF NOT version_keys ? version_key THEN
      IF jsonb_array_length(versions) >= 4096 THEN
        RAISE EXCEPTION 'First class exact version bound exceeded' USING ERRCODE = '54000';
      END IF;
      SELECT to_jsonb(snapshot) INTO version_snapshot
      FROM public.content_versions AS snapshot
      WHERE snapshot.content_id = selected_candidate.content_id
        AND snapshot.version = selected_candidate.version;
      versions := versions || jsonb_build_array(version_snapshot);
      version_keys := version_keys || jsonb_build_object(version_key, true);
      IF octet_length(versions::text) > 4194304 THEN
        RAISE EXCEPTION 'First class dependency snapshots exceed byte bound' USING ERRCODE = '54000';
      END IF;
    END IF;
  END LOOP;

  result := jsonb_build_object(
    'descriptor_version', 1, 'character_id', target_character_id,
    'system_id', target_system_id, 'class_slug', controller.slug_snapshot,
    'controller', to_jsonb(controller),
    'feature_grants', feature_grants, 'spell_grants', spell_grants,
    'active_feature_refs', active_feature_refs, 'active_spells', active_spells,
    'versions', versions
  );
  IF octet_length(result::text) > 4194304 THEN
    RAISE EXCEPTION 'First class dependency descriptor exceeds byte bound'
      USING ERRCODE = '54000';
  END IF;
  RETURN result;
END;
$$;

ALTER FUNCTION private.resolve_first_class_dependencies_v1(uuid, uuid, integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.resolve_first_class_dependencies_v1(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
