-- Feat campaign sharing, character-aware discovery, and atomic ASI choices.
--
-- This migration intentionally keeps every mutating boundary in a narrowly
-- granted RPC. Content definitions remain author-owned; a campaign owner may
-- only revoke an existing share from their own campaign.

CREATE OR REPLACE FUNCTION public.set_content_campaign_share(
  target_content_id uuid,
  target_campaign_id uuid,
  enabled boolean,
  expected_version integer
)
RETURNS TABLE (
  content_id uuid,
  version integer,
  scope text,
  shared_campaign_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  locked_definition public.content_definitions%ROWTYPE;
  campaign_system_id uuid;
  campaign_owner_id uuid;
  derived_scope text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_content_id IS NULL
    OR target_campaign_id IS NULL
    OR enabled IS NULL
    OR expected_version IS NULL
  THEN
    RAISE EXCEPTION 'Content, campaign, enabled state, and expected version are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT definition.*
  INTO locked_definition
  FROM public.content_definitions AS definition
  WHERE definition.id = target_content_id
    AND definition.source = 'homebrew'
    AND definition.content_type IN ('spell', 'feat')
    AND definition.is_retired = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active shareable homebrew content was not found'
      USING ERRCODE = '42501';
  END IF;

  IF locked_definition.version IS DISTINCT FROM expected_version THEN
    RAISE EXCEPTION 'Content changed in another session'
      USING ERRCODE = '40001';
  END IF;

  SELECT campaign.system_id, campaign.owner_id
  INTO campaign_system_id, campaign_owner_id
  FROM public.campaigns AS campaign
  WHERE campaign.id = target_campaign_id
  FOR KEY SHARE;

  IF NOT FOUND
    OR campaign_system_id IS DISTINCT FROM locked_definition.system_id
  THEN
    RAISE EXCEPTION 'Content and campaign game systems must match'
      USING ERRCODE = '42501';
  END IF;

  IF enabled THEN
    IF locked_definition.owner_id IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'Only the content owner can grant campaign access'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.content_import_origins AS origin
      WHERE origin.content_id = locked_definition.id
    ) THEN
      RAISE EXCEPTION 'Imported content is private until a rights workflow is available'
        USING ERRCODE = '42501';
    END IF;

    -- Hold the membership row through commit so the share cannot race a leave
    -- or removal operation.
    PERFORM 1
    FROM public.campaign_members AS member
    WHERE member.campaign_id = target_campaign_id
      AND member.user_id = actor_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Campaign membership is required to share content'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.content_shares (content_id, campaign_id, shared_by)
    VALUES (locked_definition.id, target_campaign_id, actor_id)
    ON CONFLICT ON CONSTRAINT content_shares_content_id_campaign_id_key
    DO NOTHING;
  ELSE
    IF locked_definition.owner_id IS DISTINCT FROM actor_id
      AND campaign_owner_id IS DISTINCT FROM actor_id
    THEN
      RAISE EXCEPTION 'Only the content owner or campaign owner can revoke access'
        USING ERRCODE = '42501';
    END IF;

    IF locked_definition.owner_id IS DISTINCT FROM actor_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.content_shares AS share
        WHERE share.content_id = locked_definition.id
          AND share.campaign_id = target_campaign_id
      )
    THEN
      RAISE EXCEPTION 'The content is not shared to this campaign'
        USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.content_shares AS share
    WHERE share.content_id = locked_definition.id
      AND share.campaign_id = target_campaign_id;
  END IF;

  SELECT pg_catalog.count(*)
  INTO shared_campaign_count
  FROM public.content_shares AS share
  WHERE share.content_id = locked_definition.id;

  derived_scope := CASE
    WHEN shared_campaign_count > 0 THEN 'shared'
    ELSE 'personal'
  END;

  UPDATE public.content_definitions AS definition
  SET scope = derived_scope
  WHERE definition.id = locked_definition.id
  RETURNING definition.id, definition.version, definition.scope
  INTO content_id, version, scope;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_content_campaign_share(uuid, uuid, boolean, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_content_campaign_share(uuid, uuid, boolean, integer)
  TO authenticated;

-- A campaign owner needs a narrow read model to discover the current version
-- required by the revocation RPC. This grants no definition edit capability.
CREATE OR REPLACE FUNCTION public.list_campaign_shared_content_for_owner(
  target_campaign_id uuid
)
RETURNS TABLE (
  content_id uuid,
  name text,
  content_type text,
  version integer,
  owner_id uuid,
  source text,
  scope text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_campaign_id IS NULL THEN
    RAISE EXCEPTION 'A campaign is required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.campaigns AS campaign
    WHERE campaign.id = target_campaign_id
      AND campaign.owner_id = actor_id
  ) THEN
    RAISE EXCEPTION 'Campaign ownership is required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    definition.id,
    definition.name,
    definition.content_type,
    definition.version,
    definition.owner_id,
    definition.source,
    definition.scope
  FROM public.content_shares AS share
  JOIN public.content_definitions AS definition
    ON definition.id = share.content_id
  WHERE share.campaign_id = target_campaign_id
    AND definition.content_type IN ('spell', 'feat')
    AND definition.source = 'homebrew'
    AND definition.scope = 'shared'
    AND definition.is_retired = false
  ORDER BY definition.content_type, definition.name, definition.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_campaign_shared_content_for_owner(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_campaign_shared_content_for_owner(uuid)
  TO authenticated;

-- Resolve only the six 2014 ability scores needed by the currently supported
-- prerequisite shape. The calculation mirrors the character builder: base
-- scores, race/subrace structured scores (without double-counting effects),
-- other additive content effects, and saved ASI allocations.
CREATE OR REPLACE FUNCTION private.character_ability_scores(
  target_character_id uuid,
  excluded_content_id uuid DEFAULT NULL,
  excluded_asi_key text DEFAULT NULL,
  excluded_choice_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH abilities(slug, ordinal) AS (
    VALUES
      ('strength'::text, 0),
      ('dexterity'::text, 1),
      ('constitution'::text, 2),
      ('intelligence'::text, 3),
      ('wisdom'::text, 4),
      ('charisma'::text, 5)
  ),
  character_row AS (
    SELECT character.base_stats, character.choices
    FROM public.characters AS character
    WHERE character.id = target_character_id
  ),
  structured_ref_bonus AS (
    SELECT
      ability.slug,
      pg_catalog.sum((version.data_snapshot->'scores'->>ability.ordinal)::numeric) AS bonus
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
    CROSS JOIN abilities AS ability
    WHERE ref.character_id = target_character_id
      AND (excluded_content_id IS NULL OR ref.content_id <> excluded_content_id)
      AND (
        excluded_choice_source IS NULL
        OR ref.choice_source IS DISTINCT FROM excluded_choice_source
      )
      AND version.content_type_snapshot IN ('race', 'subrace')
      AND pg_catalog.jsonb_typeof(version.data_snapshot->'scores') = 'array'
      AND pg_catalog.jsonb_array_length(version.data_snapshot->'scores') = 6
      AND pg_catalog.jsonb_typeof(version.data_snapshot->'scores'->ability.ordinal) = 'number'
    GROUP BY ability.slug
  ),
  effect_ref_bonus AS (
    SELECT
      effect.value->>'stat' AS slug,
      pg_catalog.sum((effect.value->>'value')::numeric) AS bonus
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(version.effects_snapshot) = 'array'
          THEN version.effects_snapshot
        ELSE '[]'::jsonb
      END
    ) AS effect(value)
    WHERE ref.character_id = target_character_id
      AND (excluded_content_id IS NULL OR ref.content_id <> excluded_content_id)
      AND (
        excluded_choice_source IS NULL
        OR ref.choice_source IS DISTINCT FROM excluded_choice_source
      )
      AND NOT (
        version.content_type_snapshot IN ('race', 'subrace')
        AND pg_catalog.jsonb_typeof(version.data_snapshot->'scores') = 'array'
        AND pg_catalog.jsonb_array_length(version.data_snapshot->'scores') = 6
      )
      AND effect.value->>'type' = 'mechanical'
      AND effect.value->>'op' = 'add'
      AND effect.value->>'stat' IN (
        'strength', 'dexterity', 'constitution',
        'intelligence', 'wisdom', 'charisma'
      )
      AND pg_catalog.jsonb_typeof(effect.value->'value') = 'number'
    GROUP BY effect.value->>'stat'
  ),
  asi_bonus AS (
    SELECT
      allocation.value->>'ability' AS slug,
      pg_catalog.sum((allocation.value->>'amount')::numeric) AS bonus
    FROM character_row
    CROSS JOIN LATERAL pg_catalog.jsonb_each(
      CASE
        WHEN pg_catalog.jsonb_typeof(character_row.choices->'asi_choices') = 'object'
          THEN character_row.choices->'asi_choices'
        ELSE '{}'::jsonb
      END
    ) AS choice(key, value)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(choice.value->'allocations') = 'array'
          THEN choice.value->'allocations'
        ELSE '[]'::jsonb
      END
    ) AS allocation(value)
    WHERE choice.value->>'mode' = 'asi'
      AND (excluded_asi_key IS NULL OR choice.key <> excluded_asi_key)
      AND allocation.value->>'ability' IN (
        'strength', 'dexterity', 'constitution',
        'intelligence', 'wisdom', 'charisma'
      )
      AND pg_catalog.jsonb_typeof(allocation.value->'amount') = 'number'
    GROUP BY allocation.value->>'ability'
  )
  SELECT COALESCE(
    pg_catalog.jsonb_object_agg(
      ability.slug,
      COALESCE(
        CASE
          WHEN pg_catalog.jsonb_typeof(character_row.base_stats->ability.slug) = 'number'
            THEN (character_row.base_stats->>ability.slug)::numeric
          ELSE 0
        END,
        0
      )
      + COALESCE(structured_ref_bonus.bonus, 0)
      + COALESCE(effect_ref_bonus.bonus, 0)
      + COALESCE(asi_bonus.bonus, 0)
    ),
    '{}'::jsonb
  )
  FROM character_row
  CROSS JOIN abilities AS ability
  LEFT JOIN structured_ref_bonus USING (slug)
  LEFT JOIN effect_ref_bonus USING (slug)
  LEFT JOIN asi_bonus USING (slug);
$$;

REVOKE ALL ON FUNCTION private.character_ability_scores(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

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
    excluded_content_id,
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

CREATE OR REPLACE FUNCTION public.search_usable_feats_for_character(
  target_character_id uuid,
  search_query text DEFAULT '',
  result_limit integer DEFAULT 50
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
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_character_id IS NULL
    OR pg_catalog.char_length(COALESCE(search_query, '')) > 200
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
    definition.id,
    NULL
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

REVOKE ALL ON FUNCTION public.search_usable_feats_for_character(uuid, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_usable_feats_for_character(uuid, text, integer)
  TO authenticated;

-- Reserve the ASI ref namespace for the atomic RPC. Ordinary owner-level Data
-- API writes remain available for unrelated builder sources.
CREATE OR REPLACE FUNCTION private.enforce_asi_choice_ref_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.choice_source LIKE 'choice:asi:%'
    AND COALESCE(
      pg_catalog.current_setting('inkborne.asi_choice_rpc', true),
      'off'
    ) <> 'on'
  THEN
    RAISE EXCEPTION 'ASI choice refs must be managed by set_character_asi_choice'
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
BEFORE INSERT OR UPDATE OF choice_source ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.enforce_asi_choice_ref_boundary();

-- Owners may continue deleting ordinary builder refs directly, but an ASI
-- choice pin must stay synchronized with characters.choices through the RPC.
DROP POLICY IF EXISTS "Owner can delete character content refs"
  ON public.character_content_refs;
CREATE POLICY "Owner can delete character content refs"
  ON public.character_content_refs FOR DELETE
  TO authenticated
  USING (
    (
      choice_source IS NULL
      OR choice_source NOT LIKE 'choice:asi:%'
    )
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = character_content_refs.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

-- Remove stale stored ASI choices before a level/subclass update lands. The
-- existing after-update projection cleanup can then observe the new class
-- state and remove both automatic feature refs and ASI feat refs.
CREATE OR REPLACE FUNCTION private.prune_inactive_asi_choices_before_choices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retained_choices jsonb;
BEGIN
  IF pg_catalog.jsonb_typeof(NEW.choices->'asi_choices') <> 'object' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_object_agg(choice.key, choice.value), '{}'::jsonb)
  INTO retained_choices
  FROM pg_catalog.jsonb_each(NEW.choices->'asi_choices') AS choice(key, value)
  WHERE EXISTS (
    SELECT 1
    FROM public.character_feature_grants AS grant_row
    JOIN public.character_content_refs AS controller_ref
      ON controller_ref.id = grant_row.controller_ref_id
     AND controller_ref.character_id = grant_row.character_id
    JOIN public.content_versions AS controller
      ON controller.content_id = controller_ref.content_id
     AND controller.version = controller_ref.content_version
     AND controller.content_type_snapshot = grant_row.controller_type
     AND controller.slug_snapshot = grant_row.controller_slug
    JOIN public.content_versions AS feature
      ON feature.content_id = grant_row.feature_content_id
     AND feature.version = grant_row.feature_version
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE
        WHEN pg_catalog.jsonb_typeof(NEW.choices->'classes') = 'array'
          THEN NEW.choices->'classes'
        ELSE '[]'::jsonb
      END
    ) AS class_choice(value)
    WHERE grant_row.character_id = NEW.id
      AND grant_row.feature_slug = choice.key
      AND feature.data_snapshot->>'feature_type' = 'asi'
      AND COALESCE(class_choice.value->>'level', '') ~ '^[0-9]+$'
      AND (class_choice.value->>'level')::integer >= grant_row.unlock_level
      AND (
        (
          controller.content_type_snapshot = 'class'
          AND class_choice.value->>'slug' = controller.slug_snapshot
        )
        OR (
          controller.content_type_snapshot = 'subclass'
          AND class_choice.value->>'slug' = controller.data_snapshot->>'parent_class'
          AND class_choice.value->>'subclass' = controller.slug_snapshot
        )
      )
  );

  NEW.choices := pg_catalog.jsonb_set(
    NEW.choices,
    '{asi_choices}',
    retained_choices,
    true
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prune_inactive_asi_choices_before_choices()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS prune_inactive_asi_choices_before_choices
  ON public.characters;
CREATE TRIGGER prune_inactive_asi_choices_before_choices
BEFORE UPDATE OF choices ON public.characters
FOR EACH ROW
EXECUTE FUNCTION private.prune_inactive_asi_choices_before_choices();

CREATE OR REPLACE FUNCTION private.prune_inactive_feature_refs_after_choices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = NEW.id
    AND ref.feature_grant_id IS NOT NULL
    AND private.is_character_feature_grant_active(ref.feature_grant_id)
      IS NOT TRUE;

  DELETE FROM public.character_content_refs AS ref
  WHERE ref.character_id = NEW.id
    AND ref.feature_grant_id IS NULL
    AND ref.choice_source LIKE 'choice:asi:%'
    AND NOT EXISTS (
      SELECT 1
      FROM public.character_feature_grants AS grant_row
      JOIN public.content_versions AS feature
        ON feature.content_id = grant_row.feature_content_id
       AND feature.version = grant_row.feature_version
      WHERE ref.choice_source = 'choice:asi:' || grant_row.id::text
        AND grant_row.character_id = NEW.id
        AND feature.data_snapshot->>'feature_type' = 'asi'
        AND NEW.choices->'asi_choices' ? grant_row.feature_slug
        AND private.is_character_feature_grant_active(grant_row.id)
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prune_inactive_feature_refs_after_choices()
  FROM PUBLIC, anon, authenticated, service_role;

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
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_character_asi_choice(
  uuid, text, text, jsonb, uuid, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_character_asi_choice(
  uuid, text, text, jsonb, uuid, integer
) TO authenticated;
