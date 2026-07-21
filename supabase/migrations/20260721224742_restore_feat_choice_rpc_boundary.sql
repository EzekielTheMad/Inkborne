-- Restore the transaction-local guard after a successful mutation. PostgREST
-- normally gives an RPC its own transaction, but callers using a larger SQL
-- transaction must not inherit the privileged mutation boundary.
CREATE OR REPLACE FUNCTION public.set_character_asi_choice(
  target_character_id uuid,
  target_feature_slug text,
  choice_mode text,
  ability_allocations jsonb DEFAULT NULL,
  target_feat_id uuid DEFAULT NULL,
  target_feat_version integer DEFAULT NULL
)
RETURNS TABLE (
  saved_feature_slug text,
  saved_choice jsonb,
  saved_choices jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  locked_character public.characters%ROWTYPE;
  target_grant public.character_feature_grants%ROWTYPE;
  matching_grant_ids uuid[];
  choice_source_value text;
  normalized_allocations jsonb;
  selected_feat public.content_definitions%ROWTYPE;
  prerequisite record;
  resolved_scores jsonb;
  allocation record;
  next_choice jsonb;
  next_asi_choices jsonb;
  next_choices jsonb;
  previous_rpc_setting text := pg_catalog.current_setting(
    'inkborne.asi_choice_rpc',
    true
  );
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_character_id IS NULL
    OR target_feature_slug IS NULL
    OR pg_catalog.btrim(target_feature_slug) = ''
    OR pg_catalog.char_length(target_feature_slug) > 200
    OR choice_mode IS NULL
    OR choice_mode NOT IN ('asi', 'feat')
  THEN
    RAISE EXCEPTION 'A character, ASI feature, and supported choice mode are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT character.*
  INTO locked_character
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.array_agg(grant_row.id ORDER BY grant_row.id)
  INTO matching_grant_ids
  FROM public.character_feature_grants AS grant_row
  JOIN public.content_versions AS feature
    ON feature.content_id = grant_row.feature_content_id
   AND feature.version = grant_row.feature_version
  WHERE grant_row.character_id = target_character_id
    AND grant_row.feature_slug = target_feature_slug
    AND feature.data_snapshot->>'feature_type' = 'asi'
    AND private.is_character_feature_grant_active(grant_row.id);

  IF COALESCE(pg_catalog.cardinality(matching_grant_ids), 0) <> 1 THEN
    RAISE EXCEPTION 'The earned ASI feature is missing or ambiguous'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT grant_row.*
  INTO target_grant
  FROM public.character_feature_grants AS grant_row
  JOIN public.character_content_refs AS controller_ref
    ON controller_ref.id = grant_row.controller_ref_id
  WHERE grant_row.id = matching_grant_ids[1]
  FOR KEY SHARE OF grant_row, controller_ref;

  IF NOT FOUND OR private.is_character_feature_grant_active(target_grant.id) IS NOT TRUE THEN
    RAISE EXCEPTION 'The earned ASI feature is no longer active'
      USING ERRCODE = 'P0001';
  END IF;

  choice_source_value := 'choice:asi:' || target_grant.id::text;

  IF choice_mode = 'asi' THEN
    IF target_feat_id IS NOT NULL OR target_feat_version IS NOT NULL
      OR pg_catalog.jsonb_typeof(ability_allocations) <> 'array'
      OR pg_catalog.jsonb_array_length(ability_allocations) NOT IN (1, 2)
    THEN
      RAISE EXCEPTION 'Choose one +2 ability or two distinct +1 abilities'
        USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(ability_allocations) AS item(value)
      WHERE pg_catalog.jsonb_typeof(item.value) <> 'object'
        OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(item.value)) <> 2
        OR item.value->>'ability' NOT IN (
          'strength', 'dexterity', 'constitution',
          'intelligence', 'wisdom', 'charisma'
        )
        OR pg_catalog.jsonb_typeof(item.value->'amount') <> 'number'
        OR CASE
          WHEN pg_catalog.jsonb_typeof(item.value->'amount') = 'number'
            THEN (item.value->>'amount')::numeric NOT IN (1, 2)
          ELSE true
        END
    ) THEN
      RAISE EXCEPTION 'Ability allocations contain unsupported values'
        USING ERRCODE = '22023';
    END IF;

    normalized_allocations := (
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'ability', item.value->>'ability',
          'amount', (item.value->>'amount')::integer
        )
        ORDER BY item.ordinality
      )
      FROM pg_catalog.jsonb_array_elements(ability_allocations)
        WITH ORDINALITY AS item(value, ordinality)
    );

    IF (
      pg_catalog.jsonb_array_length(normalized_allocations) = 1
      AND (normalized_allocations->0->>'amount')::integer <> 2
    ) OR (
      pg_catalog.jsonb_array_length(normalized_allocations) = 2
      AND (
        (normalized_allocations->0->>'amount')::integer <> 1
        OR (normalized_allocations->1->>'amount')::integer <> 1
        OR normalized_allocations->0->>'ability'
          = normalized_allocations->1->>'ability'
      )
    ) THEN
      RAISE EXCEPTION 'Choose one +2 ability or two distinct +1 abilities'
        USING ERRCODE = '22023';
    END IF;

    resolved_scores := private.character_ability_scores(
      target_character_id,
      NULL,
      target_feature_slug,
      choice_source_value
    );
    FOR allocation IN
      SELECT item.value
      FROM pg_catalog.jsonb_array_elements(normalized_allocations) AS item(value)
    LOOP
      IF COALESCE((resolved_scores->>(allocation.value->>'ability'))::numeric, 0)
        + (allocation.value->>'amount')::integer > 20
      THEN
        RAISE EXCEPTION 'An Ability Score Improvement cannot raise a score above 20'
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    next_choice := pg_catalog.jsonb_build_object(
      'mode', 'asi',
      'allocations', normalized_allocations
    );
  ELSE
    IF ability_allocations IS NOT NULL
      OR target_feat_id IS NULL
      OR target_feat_version IS NULL
      OR target_feat_version < 1
    THEN
      RAISE EXCEPTION 'A feat and exact positive version are required'
        USING ERRCODE = '22023';
    END IF;

    SELECT definition.*
    INTO selected_feat
    FROM public.content_definitions AS definition
    WHERE definition.id = target_feat_id
      AND definition.system_id = locked_character.system_id
      AND definition.content_type = 'feat'
      AND definition.is_retired = false
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected feat is unavailable'
        USING ERRCODE = 'P0001';
    END IF;

    IF selected_feat.version IS DISTINCT FROM target_feat_version THEN
      RAISE EXCEPTION 'The selected feat changed; choose its current version'
        USING ERRCODE = '40001';
    END IF;

    IF private.can_use_content_version(
      target_character_id,
      selected_feat.id,
      selected_feat.version
    ) IS NOT TRUE THEN
      RAISE EXCEPTION 'The selected feat is not available to this character'
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_each(
        CASE
          WHEN pg_catalog.jsonb_typeof(locked_character.choices->'asi_choices') = 'object'
            THEN locked_character.choices->'asi_choices'
          ELSE '{}'::jsonb
        END
      ) AS existing(key, value)
      WHERE existing.key <> target_feature_slug
        AND existing.value->>'mode' = 'feat'
        AND existing.value->>'featId' = selected_feat.id::text
    ) OR EXISTS (
      SELECT 1
      FROM public.character_content_refs AS existing_ref
      WHERE existing_ref.character_id = target_character_id
        AND existing_ref.content_id = selected_feat.id
        AND existing_ref.choice_source LIKE 'choice:asi:%'
        AND existing_ref.choice_source <> choice_source_value
    ) THEN
      RAISE EXCEPTION 'That feat is already selected for another ASI'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT status.*
    INTO prerequisite
    FROM private.feat_prerequisite_status(
      target_character_id,
      selected_feat.data,
      selected_feat.id,
      choice_source_value
    ) AS status;

    IF prerequisite.prerequisite_met IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(
        prerequisite.prerequisite_reason,
        'The feat prerequisite is not met'
      ) USING ERRCODE = 'P0001';
    END IF;

    next_choice := pg_catalog.jsonb_build_object(
      'mode', 'feat',
      'featId', selected_feat.id,
      'featVersion', selected_feat.version,
      'featName', selected_feat.name
    );
  END IF;

  next_asi_choices := CASE
    WHEN pg_catalog.jsonb_typeof(locked_character.choices->'asi_choices') = 'object'
      THEN locked_character.choices->'asi_choices'
    ELSE '{}'::jsonb
  END || pg_catalog.jsonb_build_object(target_feature_slug, next_choice);

  next_choices := pg_catalog.jsonb_set(
    CASE
      WHEN pg_catalog.jsonb_typeof(locked_character.choices) = 'object'
        THEN locked_character.choices
      ELSE '{}'::jsonb
    END,
    '{asi_choices}',
    next_asi_choices,
    true
  );

  PERFORM pg_catalog.set_config('inkborne.asi_choice_rpc', 'on', true);
  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = target_character_id
    AND ref.choice_source = choice_source_value;

  UPDATE public.characters AS character
  SET choices = next_choices
  WHERE character.id = target_character_id
  RETURNING character.choices INTO saved_choices;

  IF choice_mode = 'feat' THEN
    INSERT INTO public.character_content_refs (
      character_id,
      content_id,
      content_version,
      context,
      choice_source,
      feature_grant_id
    ) VALUES (
      target_character_id,
      selected_feat.id,
      selected_feat.version,
      pg_catalog.jsonb_build_object(
        'source', 'asi_feat',
        'feature_slug', target_grant.feature_slug,
        'feature_grant_id', target_grant.id,
        'feature_level', target_grant.unlock_level,
        'controller_type', target_grant.controller_type,
        'controller_slug', target_grant.controller_slug
      ),
      choice_source_value,
      NULL
    );
  END IF;

  saved_feature_slug := target_feature_slug;
  saved_choice := next_choice;

  PERFORM pg_catalog.set_config(
    'inkborne.asi_choice_rpc',
    COALESCE(previous_rpc_setting, 'off'),
    true
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_character_asi_choice(
  uuid, text, text, jsonb, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_character_asi_choice(
  uuid, text, text, jsonb, uuid, integer
) TO authenticated;
