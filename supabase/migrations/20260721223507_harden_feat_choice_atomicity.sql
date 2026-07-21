-- Close mutation bypasses around atomic ASI feat choices and make feat
-- prerequisite evaluation explicit about the ASI slot being replaced.

-- Any insert/update that creates, changes, or removes either a feat pin or the
-- reserved ASI source must run inside a canonical RPC transaction. Checking
-- OLD as well as NEW prevents converting a protected row into an ordinary one.
CREATE OR REPLACE FUNCTION private.enforce_asi_choice_ref_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_is_protected boolean := false;
  new_is_protected boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_is_protected :=
      OLD.choice_source LIKE 'choice:asi:%'
      OR EXISTS (
        SELECT 1
        FROM public.content_versions AS version
        WHERE version.content_id = OLD.content_id
          AND version.version = OLD.content_version
          AND version.content_type_snapshot = 'feat'
      );
  END IF;

  new_is_protected :=
    NEW.choice_source LIKE 'choice:asi:%'
    OR EXISTS (
      SELECT 1
      FROM public.content_versions AS version
      WHERE version.content_id = NEW.content_id
        AND version.version = NEW.content_version
        AND version.content_type_snapshot = 'feat'
    );

  IF (old_is_protected OR new_is_protected)
    AND COALESCE(
      pg_catalog.current_setting('inkborne.asi_choice_rpc', true),
      'off'
    ) <> 'on'
  THEN
    RAISE EXCEPTION 'Feat refs must be managed by a canonical character choice RPC'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_asi_choice_ref_boundary()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_asi_choice_ref_boundary
  ON public.character_content_refs;
CREATE TRIGGER enforce_asi_choice_ref_boundary
BEFORE INSERT OR UPDATE ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.enforce_asi_choice_ref_boundary();

-- Reject direct replacement of the persisted ASI map. This trigger sorts
-- before prune_inactive_asi_choices_before_choices, so an unrelated class
-- level update can retain the caller's unchanged map and then let the pruning
-- trigger remove entries that are no longer earned.
CREATE OR REPLACE FUNCTION private.enforce_asi_choice_map_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_asi_choices jsonb := OLD.choices->'asi_choices';
  requested_asi_choices jsonb := NEW.choices->'asi_choices';
BEGIN
  IF requested_asi_choices IS DISTINCT FROM old_asi_choices
    AND COALESCE(
      pg_catalog.current_setting('inkborne.asi_choice_rpc', true),
      'off'
    ) <> 'on'
  THEN
    RAISE EXCEPTION 'ASI choices must be managed by set_character_asi_choice'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_asi_choice_map_boundary()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_asi_choice_map_boundary
  ON public.characters;
CREATE TRIGGER enforce_asi_choice_map_boundary
BEFORE UPDATE OF choices ON public.characters
FOR EACH ROW
EXECUTE FUNCTION private.enforce_asi_choice_map_boundary();

-- When a slot source is supplied it is the sole exclusion boundary. Excluding
-- the candidate content id as well could incorrectly remove another legitimate
-- pin of that content from the prerequisite calculation.
CREATE OR REPLACE FUNCTION private.feat_prerequisite_status(
  target_character_id uuid,
  feat_data jsonb,
  excluded_content_id uuid DEFAULT NULL,
  excluded_choice_source text DEFAULT NULL
)
RETURNS TABLE (prerequisite_met boolean, prerequisite_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  prerequisites jsonb := feat_data->'prerequisites';
  prerequisite jsonb;
  ability_slug text;
  ability_label text;
  required_score numeric;
  current_score numeric;
  scores jsonb;
BEGIN
  IF prerequisites IS NULL OR prerequisites = '[]'::jsonb THEN
    RETURN QUERY SELECT true, NULL::text;
    RETURN;
  END IF;

  IF pg_catalog.jsonb_typeof(prerequisites) <> 'array'
    OR pg_catalog.jsonb_array_length(prerequisites) <> 1
  THEN
    RETURN QUERY SELECT false, 'This feat uses an unsupported prerequisite.'::text;
    RETURN;
  END IF;

  prerequisite := prerequisites->0;
  IF pg_catalog.jsonb_typeof(prerequisite) <> 'object'
    OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(prerequisite)) <> 3
    OR prerequisite->>'stat' NOT IN (
      'strength', 'dexterity', 'constitution',
      'intelligence', 'wisdom', 'charisma'
    )
    OR prerequisite->>'op' <> 'gte'
    OR pg_catalog.jsonb_typeof(prerequisite->'value') <> 'number'
  THEN
    RETURN QUERY SELECT false, 'This feat uses an unsupported prerequisite.'::text;
    RETURN;
  END IF;

  ability_slug := prerequisite->>'stat';
  required_score := (prerequisite->>'value')::numeric;
  IF required_score <> pg_catalog.trunc(required_score)
    OR required_score < 1
    OR required_score > 30
  THEN
    RETURN QUERY SELECT false, 'This feat uses an unsupported prerequisite.'::text;
    RETURN;
  END IF;

  scores := private.character_ability_scores(
    target_character_id,
    CASE
      WHEN excluded_choice_source IS NULL THEN excluded_content_id
      ELSE NULL
    END,
    NULL,
    excluded_choice_source
  );
  current_score := COALESCE((scores->>ability_slug)::numeric, 0);
  ability_label := CASE ability_slug
    WHEN 'strength' THEN 'STR'
    WHEN 'dexterity' THEN 'DEX'
    WHEN 'constitution' THEN 'CON'
    WHEN 'intelligence' THEN 'INT'
    WHEN 'wisdom' THEN 'WIS'
    ELSE 'CHA'
  END;

  IF current_score >= required_score THEN
    RETURN QUERY SELECT
      true,
      pg_catalog.format('%s %s prerequisite met', ability_label, required_score);
  ELSE
    RETURN QUERY SELECT
      false,
      pg_catalog.format(
        '%s %s required (currently %s)',
        ability_label,
        required_score,
        current_score
      );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.feat_prerequisite_status(uuid, jsonb, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- The optional feature slug identifies the ASI occurrence being edited. Its
-- pinned feat effects are excluded from every candidate's prerequisite result.
DROP FUNCTION IF EXISTS public.search_usable_feats_for_character(uuid, text, integer);
CREATE FUNCTION public.search_usable_feats_for_character(
  target_character_id uuid,
  search_query text DEFAULT '',
  result_limit integer DEFAULT 50,
  target_feature_slug text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  version integer,
  source text,
  scope text,
  prerequisite_met boolean,
  prerequisite_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  character_system_id uuid;
  matching_grant_ids uuid[];
  excluded_choice_source text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_character_id IS NULL
    OR pg_catalog.char_length(COALESCE(search_query, '')) > 200
    OR pg_catalog.char_length(COALESCE(target_feature_slug, '')) > 200
  THEN
    RAISE EXCEPTION 'A character and search text up to 200 characters are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT character.system_id
  INTO character_system_id
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character ownership is required to search usable feats'
      USING ERRCODE = '42501';
  END IF;

  IF target_feature_slug IS NOT NULL THEN
    IF pg_catalog.btrim(target_feature_slug) = '' THEN
      RAISE EXCEPTION 'The ASI feature slug cannot be empty'
        USING ERRCODE = '22023';
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

    excluded_choice_source := 'choice:asi:' || matching_grant_ids[1]::text;
  END IF;

  RETURN QUERY
  SELECT
    definition.id,
    definition.name,
    COALESCE(definition.data->>'description', ''),
    definition.version,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.content_import_origins AS origin
        WHERE origin.content_id = definition.id
      ) THEN 'imported'
      WHEN definition.scope = 'platform' OR definition.source = 'srd'
        THEN 'platform'
      ELSE 'homebrew'
    END,
    definition.scope,
    prerequisite.prerequisite_met,
    prerequisite.prerequisite_reason
  FROM public.content_definitions AS definition
  CROSS JOIN LATERAL private.feat_prerequisite_status(
    target_character_id,
    definition.data,
    NULL,
    excluded_choice_source
  ) AS prerequisite
  WHERE definition.system_id = character_system_id
    AND definition.content_type = 'feat'
    AND definition.is_retired = false
    AND private.can_use_content_version(
      target_character_id,
      definition.id,
      definition.version
    )
    AND (
      pg_catalog.btrim(COALESCE(search_query, '')) = ''
      OR pg_catalog.strpos(
        pg_catalog.lower(definition.name),
        pg_catalog.lower(pg_catalog.btrim(search_query))
      ) > 0
    )
  ORDER BY definition.name, definition.id
  LIMIT LEAST(GREATEST(COALESCE(result_limit, 50), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_usable_feats_for_character(uuid, text, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_usable_feats_for_character(uuid, text, integer, text)
  TO authenticated;

-- Copy ordinary refs first so destination feature grants are materialized,
-- then rebuild every ASI feat ref against its destination grant UUID. The
-- destination access preflight remains ahead of all dependent copies, so a
-- campaign that cannot use a selected feat fails the whole transaction.
CREATE OR REPLACE FUNCTION public.copy_character(
  source_character_id uuid,
  target_campaign_id uuid DEFAULT NULL,
  copied_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  source_character public.characters%ROWTYPE;
  new_character_id uuid;
  resolved_name text;
  source_asi_ref record;
  destination_grant public.character_feature_grants%ROWTYPE;
  destination_grant_ids uuid[];
  stored_feat_choice_count integer := 0;
  source_asi_ref_count integer := 0;
  inserted_asi_ref_count integer := 0;
  previous_rpc_setting text := pg_catalog.current_setting(
    'inkborne.asi_choice_rpc',
    true
  );
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT character.* INTO source_character
  FROM public.characters AS character
  WHERE character.id = source_character_id
    AND character.user_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller' USING ERRCODE = '42501';
  END IF;

  resolved_name := pg_catalog.btrim(
    COALESCE(NULLIF(copied_name, ''), source_character.name || ' (Copy)')
  );
  IF pg_catalog.char_length(resolved_name) < 1
    OR pg_catalog.char_length(resolved_name) > 100
  THEN
    RAISE EXCEPTION 'Character name must be between 1 and 100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF target_campaign_id IS NOT NULL
    AND NOT private.can_assign_character_to_campaign(
      target_campaign_id,
      source_character.system_id
    )
  THEN
    RAISE EXCEPTION 'Campaign is unavailable or uses a different game system'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.characters (
    user_id, system_id, campaign_id, name, visibility, archived, level,
    base_stats, choices, state, narrative, narrative_rich, primary_color
  ) VALUES (
    actor_id, source_character.system_id, target_campaign_id, resolved_name,
    'private', false, source_character.level, source_character.base_stats,
    source_character.choices, source_character.state, source_character.narrative,
    source_character.narrative_rich, source_character.primary_color
  ) RETURNING id INTO new_character_id;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT ref.content_id, ref.content_version
      FROM public.character_content_refs AS ref
      WHERE ref.character_id = source_character_id
        AND ref.feature_grant_id IS NULL

      UNION ALL

      SELECT item.content_id, item.content_version
      FROM public.character_inventory AS item
      WHERE item.character_id = source_character_id
        AND item.content_id IS NOT NULL

      UNION ALL

      SELECT spell.content_id, spell.content_version
      FROM public.character_spells AS spell
      WHERE spell.character_id = source_character_id
        AND spell.content_id IS NOT NULL
    ) AS linked
    WHERE private.can_use_content_version(
      new_character_id,
      linked.content_id,
      linked.content_version
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Character contains content unavailable to the target campaign'
      USING ERRCODE = '42501';
  END IF;

  -- Feats currently have one canonical character-link path: an earned ASI
  -- occurrence. Refuse legacy/custom feat refs instead of letting the copy RPC
  -- use its internal boundary flag to bless malformed state on the destination.
  IF EXISTS (
    SELECT 1
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
    WHERE ref.character_id = source_character_id
      AND ref.feature_grant_id IS NULL
      AND version.content_type_snapshot = 'feat'
      AND (
        ref.choice_source IS NULL
        OR ref.choice_source NOT LIKE 'choice:asi:%'
      )
  ) THEN
    RAISE EXCEPTION 'Character contains a noncanonical feat ref that cannot be copied'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.character_dm_notes (character_id, content)
  SELECT new_character_id, note.content
  FROM public.character_dm_notes AS note
  WHERE note.character_id = source_character_id;

  INSERT INTO public.character_timeline_events (
    character_id, created_by, title, date_label, description, visibility,
    sort_order
  ) SELECT
    new_character_id, actor_id, event.title, event.date_label,
    event.description, 'dm_only', event.sort_order
  FROM public.character_timeline_events AS event
  WHERE event.character_id = source_character_id
    AND event.created_by = actor_id;

  SELECT pg_catalog.count(*)::integer
  INTO stored_feat_choice_count
  FROM pg_catalog.jsonb_each(
    CASE
      WHEN pg_catalog.jsonb_typeof(source_character.choices->'asi_choices') = 'object'
        THEN source_character.choices->'asi_choices'
      ELSE '{}'::jsonb
    END
  ) AS choice(key, value)
  WHERE choice.value->>'mode' = 'feat';

  SELECT pg_catalog.count(*)::integer
  INTO source_asi_ref_count
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id
    AND ref.feature_grant_id IS NULL
    AND ref.choice_source LIKE 'choice:asi:%';

  PERFORM pg_catalog.set_config('inkborne.asi_choice_rpc', 'on', true);

  INSERT INTO public.character_content_refs (
    character_id, content_id, content_version, context, choice_source
  ) SELECT
    new_character_id, ref.content_id, ref.content_version, ref.context, ref.choice_source
  FROM public.character_content_refs AS ref
  WHERE ref.character_id = source_character_id
    AND ref.feature_grant_id IS NULL
    AND (
      ref.choice_source IS NULL
      OR ref.choice_source NOT LIKE 'choice:asi:%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.content_versions AS version
      WHERE version.content_id = ref.content_id
        AND version.version = ref.content_version
        AND version.content_type_snapshot = 'feat'
    );

  FOR source_asi_ref IN
    SELECT
      ref.content_id,
      ref.content_version,
      source_grant.controller_type,
      source_grant.controller_slug,
      source_grant.feature_slug,
      source_grant.feature_content_id,
      source_grant.feature_version,
      source_grant.unlock_level,
      source_controller.content_id AS controller_content_id,
      source_controller.content_version AS controller_content_version,
      source_controller.context AS controller_context,
      source_controller.choice_source AS controller_choice_source
    FROM public.character_content_refs AS ref
    JOIN public.character_feature_grants AS source_grant
      ON source_grant.id = CASE
        WHEN pg_catalog.substr(
          ref.choice_source,
          pg_catalog.char_length('choice:asi:') + 1
        ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN pg_catalog.substr(
          ref.choice_source,
          pg_catalog.char_length('choice:asi:') + 1
        )::uuid
        ELSE NULL
      END
     AND source_grant.character_id = source_character_id
    JOIN public.character_content_refs AS source_controller
      ON source_controller.id = source_grant.controller_ref_id
     AND source_controller.character_id = source_character_id
    WHERE ref.character_id = source_character_id
      AND ref.feature_grant_id IS NULL
      AND ref.choice_source LIKE 'choice:asi:%'
      AND pg_catalog.jsonb_extract_path_text(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'mode'
      ) = 'feat'
      AND pg_catalog.jsonb_extract_path_text(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'featId'
      )
        = ref.content_id::text
      AND pg_catalog.jsonb_extract_path(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'featVersion'
      )
        = pg_catalog.to_jsonb(ref.content_version)
  LOOP
    SELECT pg_catalog.array_agg(grant_row.id ORDER BY grant_row.id)
    INTO destination_grant_ids
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS destination_controller
      ON destination_controller.id = grant_row.controller_ref_id
     AND destination_controller.character_id = new_character_id
    WHERE grant_row.character_id = new_character_id
      AND grant_row.controller_type = source_asi_ref.controller_type
      AND grant_row.controller_slug = source_asi_ref.controller_slug
      AND grant_row.feature_slug = source_asi_ref.feature_slug
      AND grant_row.feature_content_id = source_asi_ref.feature_content_id
      AND grant_row.feature_version = source_asi_ref.feature_version
      AND grant_row.unlock_level = source_asi_ref.unlock_level
      AND destination_controller.content_id = source_asi_ref.controller_content_id
      AND destination_controller.content_version = source_asi_ref.controller_content_version
      AND destination_controller.context IS NOT DISTINCT FROM source_asi_ref.controller_context
      AND destination_controller.choice_source IS NOT DISTINCT FROM
        source_asi_ref.controller_choice_source;

    IF COALESCE(pg_catalog.cardinality(destination_grant_ids), 0) <> 1 THEN
      RAISE EXCEPTION 'Copied ASI feat could not be mapped to one destination grant'
        USING ERRCODE = '23514';
    END IF;

    SELECT grant_row.*
    INTO destination_grant
    FROM public.character_feature_grants AS grant_row
    WHERE grant_row.id = destination_grant_ids[1];

    IF private.is_character_feature_grant_active(destination_grant.id) IS NOT TRUE THEN
      RAISE EXCEPTION 'Copied ASI feat maps to an inactive destination grant'
        USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.character_content_refs (
      character_id,
      content_id,
      content_version,
      context,
      choice_source,
      feature_grant_id
    ) VALUES (
      new_character_id,
      source_asi_ref.content_id,
      source_asi_ref.content_version,
      pg_catalog.jsonb_build_object(
        'source', 'asi_feat',
        'feature_slug', destination_grant.feature_slug,
        'feature_grant_id', destination_grant.id,
        'feature_level', destination_grant.unlock_level,
        'controller_type', destination_grant.controller_type,
        'controller_slug', destination_grant.controller_slug
      ),
      'choice:asi:' || destination_grant.id::text,
      NULL
    );

    inserted_asi_ref_count := inserted_asi_ref_count + 1;
  END LOOP;

  IF stored_feat_choice_count <> source_asi_ref_count
    OR source_asi_ref_count <> inserted_asi_ref_count
  THEN
    RAISE EXCEPTION 'Source ASI feat choices and exact pins are inconsistent'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.character_inventory (
    character_id, content_id, content_version, name, content_type, quantity,
    equipped, attuned, sort_order, notes, custom_data
  ) SELECT
    new_character_id, item.content_id, item.content_version, item.name,
    item.content_type, item.quantity, item.equipped, item.attuned,
    item.sort_order, item.notes, item.custom_data
  FROM public.character_inventory AS item
  WHERE item.character_id = source_character_id;

  INSERT INTO public.character_spells (
    character_id, content_id, content_version, name, class_slug, is_known,
    is_prepared, always_prepared, in_spellbook, source, custom_data
  ) SELECT
    new_character_id, spell.content_id, spell.content_version, spell.name,
    spell.class_slug, spell.is_known, spell.is_prepared, spell.always_prepared,
    spell.in_spellbook, spell.source, spell.custom_data
  FROM public.character_spells AS spell
  WHERE spell.character_id = source_character_id;

  INSERT INTO public.npcs (
    character_id, created_by, name, description, relationship, visibility,
    portrait_url, metadata
  ) SELECT
    new_character_id, actor_id, npc.name, npc.description, npc.relationship,
    'dm_only', npc.portrait_url, npc.metadata
  FROM public.npcs AS npc
  WHERE npc.character_id = source_character_id
    AND npc.created_by = actor_id;

  PERFORM pg_catalog.set_config(
    'inkborne.asi_choice_rpc',
    COALESCE(previous_rpc_setting, 'off'),
    true
  );

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text)
  TO authenticated;
