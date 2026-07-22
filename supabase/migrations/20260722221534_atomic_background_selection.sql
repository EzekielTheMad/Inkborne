-- Make a character's background choice and exact content-version pin one
-- authorization boundary. Legacy split browser writes could leave choices and
-- refs out of sync; normalize those rows before reserving the canonical source.

-- Release any non-background row that already occupies the reserved source
-- without deleting the user's unrelated content pin.
UPDATE public.character_content_refs AS ref
SET choice_source = NULL
WHERE ref.choice_source = 'choice:background'
  AND NOT EXISTS (
    SELECT 1
    FROM public.content_versions AS version
    WHERE version.content_id = ref.content_id
      AND version.version = ref.content_version
      AND version.content_type_snapshot = 'background'
  );

-- Backfill legacy slug-only choices only when exactly one accessible current
-- definition matches. Ambiguous identities are cleared below for reselection.
INSERT INTO public.character_content_refs (
  character_id,
  content_id,
  content_version,
  context,
  choice_source,
  feature_grant_id
)
SELECT
  character.id,
  candidate.id,
  candidate.version,
  pg_catalog.jsonb_build_object('source', 'background'),
  'choice:background',
  NULL
FROM public.characters AS character
CROSS JOIN LATERAL (
  SELECT
    definition.id,
    definition.version,
    pg_catalog.count(*) OVER () AS candidate_count
  FROM public.content_definitions AS definition
  JOIN public.content_versions AS version
    ON version.content_id = definition.id
   AND version.version = definition.version
   AND version.system_id_snapshot = character.system_id
   AND version.content_type_snapshot = 'background'
  WHERE definition.system_id = character.system_id
    AND definition.content_type = 'background'
    AND definition.slug = character.choices->>'background'
    AND definition.is_retired = false
    AND private.character_can_access_content_version(
      character.id,
      definition.id,
      definition.version
    )
  ORDER BY
    CASE WHEN definition.scope = 'platform' THEN 0 ELSE 1 END,
    definition.id
  LIMIT 1
) AS candidate
WHERE pg_catalog.jsonb_typeof(character.choices) = 'object'
  AND candidate.candidate_count = 1
  AND pg_catalog.btrim(COALESCE(character.choices->>'background', '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.character_content_refs AS existing
    JOIN public.content_versions AS version
      ON version.content_id = existing.content_id
     AND version.version = existing.content_version
     AND version.content_type_snapshot = 'background'
    WHERE existing.character_id = character.id
  );

-- Keep one deterministic exact pin per character, preferring the ref whose
-- frozen slug matches the stored choice and otherwise the newest legacy ref.
WITH ranked_background_refs AS (
  SELECT
    ref.id,
    pg_catalog.row_number() OVER (
      PARTITION BY ref.character_id
      ORDER BY
        CASE
          WHEN version.slug_snapshot = character.choices->>'background' THEN 0
          ELSE 1
        END,
        ref.created_at DESC,
        ref.id DESC
    ) AS position
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
   AND version.content_type_snapshot = 'background'
  JOIN public.characters AS character
    ON character.id = ref.character_id
)
DELETE FROM public.character_content_refs AS ref
USING ranked_background_refs AS ranked
WHERE ref.id = ranked.id
  AND ranked.position > 1;

UPDATE public.character_content_refs AS ref
SET
  choice_source = 'choice:background',
  context = pg_catalog.jsonb_build_object('source', 'background'),
  feature_grant_id = NULL
FROM public.content_versions AS version
WHERE version.content_id = ref.content_id
  AND version.version = ref.content_version
  AND version.content_type_snapshot = 'background';

-- The exact frozen ref is authoritative if a legacy slug disagrees.
UPDATE public.characters AS character
SET choices = pg_catalog.jsonb_set(
  CASE
    WHEN pg_catalog.jsonb_typeof(character.choices) = 'object'
      THEN character.choices
    ELSE '{}'::jsonb
  END,
  '{background}',
  pg_catalog.to_jsonb(version.slug_snapshot),
  true
)
FROM public.character_content_refs AS ref
JOIN public.content_versions AS version
  ON version.content_id = ref.content_id
 AND version.version = ref.content_version
 AND version.content_type_snapshot = 'background'
WHERE ref.character_id = character.id
  AND ref.choice_source = 'choice:background'
  AND character.choices->>'background' IS DISTINCT FROM version.slug_snapshot;

-- A remaining slug without an accessible exact ref cannot safely affect the
-- sheet. Preserve narrative prose and equipment, but remove the stale identity.
UPDATE public.characters AS character
SET choices = character.choices - 'background'
WHERE character.choices ? 'background'
  AND NOT EXISTS (
    SELECT 1
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
     AND version.content_type_snapshot = 'background'
    WHERE ref.character_id = character.id
  );

CREATE OR REPLACE FUNCTION private.enforce_background_ref_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_is_background boolean := false;
  new_is_background boolean := false;
  new_uses_background_source boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_is_background :=
      OLD.choice_source = 'choice:background'
      OR EXISTS (
        SELECT 1
        FROM public.content_versions AS version
        WHERE version.content_id = OLD.content_id
          AND version.version = OLD.content_version
          AND version.content_type_snapshot = 'background'
      );
  END IF;

  -- Character deletion cascades are not a background-choice mutation.
  IF TG_OP = 'DELETE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = OLD.character_id
    )
  THEN
    RETURN OLD;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_uses_background_source := NEW.choice_source = 'choice:background';
    new_is_background := EXISTS (
      SELECT 1
      FROM public.content_versions AS version
      WHERE version.content_id = NEW.content_id
        AND version.version = NEW.content_version
        AND version.content_type_snapshot = 'background'
    );
  END IF;

  IF new_is_background IS DISTINCT FROM new_uses_background_source THEN
    RAISE EXCEPTION 'The reserved background source must match a background snapshot'
      USING ERRCODE = '23514';
  END IF;

  IF new_is_background THEN
    IF NEW.choice_source IS DISTINCT FROM 'choice:background'
      OR NEW.context IS DISTINCT FROM
        pg_catalog.jsonb_build_object('source', 'background')
      OR NEW.feature_grant_id IS NOT NULL
    THEN
      RAISE EXCEPTION 'Background ref metadata is noncanonical'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (old_is_background OR new_is_background)
    AND COALESCE(
      pg_catalog.current_setting('inkborne.background_choice_rpc', true),
      'off'
    ) <> 'on'
  THEN
    RAISE EXCEPTION 'Background refs must be managed by set_character_background'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_background_ref_boundary()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_background_ref_boundary
  ON public.character_content_refs;
CREATE TRIGGER enforce_background_ref_boundary
BEFORE INSERT OR UPDATE OR DELETE ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.enforce_background_ref_boundary();

CREATE OR REPLACE FUNCTION private.enforce_background_choice_map_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    (
      TG_OP = 'INSERT'
      AND NEW.choices ? 'background'
    )
    OR (
      TG_OP = 'UPDATE'
      AND NEW.choices->'background' IS DISTINCT FROM OLD.choices->'background'
    )
  )
    AND COALESCE(
      pg_catalog.current_setting('inkborne.background_choice_rpc', true),
      'off'
    ) <> 'on'
  THEN
    RAISE EXCEPTION 'Background choices must be managed by set_character_background'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_background_choice_map_boundary()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_background_choice_map_boundary
  ON public.characters;
CREATE TRIGGER enforce_background_choice_map_boundary
BEFORE INSERT OR UPDATE OF choices ON public.characters
FOR EACH ROW
EXECUTE FUNCTION private.enforce_background_choice_map_boundary();

-- Owners may delete unrelated refs directly, but background and ASI pins must
-- remain synchronized with characters.choices through their canonical RPCs.
DROP POLICY IF EXISTS "Owner can delete character content refs"
  ON public.character_content_refs;
CREATE POLICY "Owner can delete character content refs"
  ON public.character_content_refs FOR DELETE TO authenticated
  USING (
    (
      choice_source IS NULL
      OR choice_source NOT LIKE 'choice:asi:%'
    )
    AND choice_source IS DISTINCT FROM 'choice:background'
    AND NOT EXISTS (
      SELECT 1
      FROM public.content_versions AS version
      WHERE version.content_id = character_content_refs.content_id
        AND version.version = character_content_refs.content_version
        AND version.content_type_snapshot = 'background'
    )
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = character_content_refs.character_id
        AND character.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.set_character_background(
  target_character_id uuid,
  target_content_id uuid DEFAULT NULL,
  target_content_version integer DEFAULT NULL
)
RETURNS TABLE (
  saved_choices jsonb,
  selected_content_id uuid,
  selected_content_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  locked_character public.characters%ROWTYPE;
  current_ref record;
  selected_background public.content_definitions%ROWTYPE;
  selected_version public.content_versions%ROWTYPE;
  selection_changed boolean;
  starting_equipment jsonb;
  next_starting_equipment jsonb;
  next_choices jsonb;
  next_resolved_choices jsonb;
  affected_choice_ids text[];
  previous_rpc_setting text := pg_catalog.current_setting(
    'inkborne.background_choice_rpc',
    true
  );
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_character_id IS NULL
    OR (target_content_id IS NULL) <> (target_content_version IS NULL)
    OR (target_content_version IS NOT NULL AND target_content_version < 1)
  THEN
    RAISE EXCEPTION 'A character and a complete exact background identity are required'
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

  SELECT
    ref.id,
    ref.content_id,
    ref.content_version,
    version.slug_snapshot
  INTO current_ref
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
   AND version.content_type_snapshot = 'background'
  WHERE ref.character_id = target_character_id
  FOR UPDATE OF ref;

  IF target_content_id IS NOT NULL THEN
    SELECT definition.*
    INTO selected_background
    FROM public.content_definitions AS definition
    WHERE definition.id = target_content_id
      AND definition.system_id = locked_character.system_id
      AND definition.content_type = 'background'
      AND definition.is_retired = false
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected background is unavailable'
        USING ERRCODE = 'P0001';
    END IF;

    IF selected_background.version IS DISTINCT FROM target_content_version THEN
      RAISE EXCEPTION 'The selected background changed; choose its current version'
        USING ERRCODE = '40001';
    END IF;

    SELECT version.*
    INTO selected_version
    FROM public.content_versions AS version
    WHERE version.content_id = selected_background.id
      AND version.version = selected_background.version
      AND version.system_id_snapshot = locked_character.system_id
      AND version.content_type_snapshot = 'background';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected background version is unavailable'
        USING ERRCODE = 'P0001';
    END IF;

    IF private.can_use_content_version(
      target_character_id,
      selected_background.id,
      selected_background.version
    ) IS NOT TRUE THEN
      RAISE EXCEPTION 'The selected background is not available to this character'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  selection_changed :=
    current_ref.content_id IS DISTINCT FROM target_content_id
    OR current_ref.content_version IS DISTINCT FROM target_content_version;

  IF NOT selection_changed THEN
    saved_choices := locked_character.choices;
    selected_content_id := current_ref.content_id;
    selected_content_version := current_ref.content_version;
    RETURN NEXT;
    RETURN;
  END IF;

  starting_equipment := locked_character.choices->'starting_equipment';
  IF (
    pg_catalog.jsonb_typeof(starting_equipment) = 'string'
    AND pg_catalog.btrim(COALESCE(starting_equipment #>> '{}', '')) <> ''
  )
    OR (
      pg_catalog.jsonb_typeof(starting_equipment) = 'object'
      AND starting_equipment->>'confirmed' = 'true'
    )
  THEN
    RAISE EXCEPTION
      'Background changes are unavailable after starting equipment is confirmed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT effect.value->>'choice_id')
  INTO affected_choice_ids
  FROM (
    SELECT current_ref.content_id AS content_id,
           current_ref.content_version AS content_version
    WHERE current_ref.content_id IS NOT NULL
    UNION
    SELECT target_content_id, target_content_version
    WHERE target_content_id IS NOT NULL
  ) AS selected_versions
  JOIN public.content_versions AS version
    ON version.content_id = selected_versions.content_id
   AND version.version = selected_versions.content_version
  CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
    CASE
      WHEN pg_catalog.jsonb_typeof(version.effects_snapshot) = 'array'
        THEN version.effects_snapshot
      ELSE '[]'::jsonb
    END
  ) AS effect(value)
  WHERE effect.value->>'type' = 'choice'
    AND pg_catalog.btrim(COALESCE(effect.value->>'choice_id', '')) <> '';

  next_choices := CASE
    WHEN pg_catalog.jsonb_typeof(locked_character.choices) = 'object'
      THEN locked_character.choices
    ELSE '{}'::jsonb
  END;
  next_resolved_choices := CASE
    WHEN pg_catalog.jsonb_typeof(next_choices->'resolved_choices') = 'object'
      THEN next_choices->'resolved_choices'
    ELSE '{}'::jsonb
  END;

  IF COALESCE(pg_catalog.cardinality(affected_choice_ids), 0) > 0 THEN
    next_resolved_choices := next_resolved_choices - affected_choice_ids;
  END IF;

  next_choices := next_choices - ARRAY[
    'background',
    'personality_traits',
    'ideals',
    'bonds',
    'flaws'
  ];
  next_choices := pg_catalog.jsonb_set(
    next_choices,
    '{resolved_choices}',
    next_resolved_choices,
    true
  );

  IF pg_catalog.jsonb_typeof(starting_equipment) = 'object' THEN
    next_starting_equipment := starting_equipment;
    next_starting_equipment := pg_catalog.jsonb_set(
      next_starting_equipment,
      '{selections}',
      COALESCE(
        (
          SELECT pg_catalog.jsonb_object_agg(entry.key, entry.value)
          FROM pg_catalog.jsonb_each(
            CASE
              WHEN pg_catalog.jsonb_typeof(starting_equipment->'selections') = 'object'
                THEN starting_equipment->'selections'
              ELSE '{}'::jsonb
            END
          ) AS entry(key, value)
          WHERE entry.key NOT LIKE 'background:%'
        ),
        '{}'::jsonb
      ),
      true
    );
    next_starting_equipment := pg_catalog.jsonb_set(
      next_starting_equipment,
      '{picks}',
      COALESCE(
        (
          SELECT pg_catalog.jsonb_object_agg(entry.key, entry.value)
          FROM pg_catalog.jsonb_each(
            CASE
              WHEN pg_catalog.jsonb_typeof(starting_equipment->'picks') = 'object'
                THEN starting_equipment->'picks'
              ELSE '{}'::jsonb
            END
          ) AS entry(key, value)
          WHERE entry.key NOT LIKE 'background:%'
        ),
        '{}'::jsonb
      ),
      true
    );
    next_choices := pg_catalog.jsonb_set(
      next_choices,
      '{starting_equipment}',
      next_starting_equipment,
      true
    );
  END IF;

  IF target_content_id IS NOT NULL THEN
    next_choices := pg_catalog.jsonb_set(
      next_choices,
      '{background}',
      pg_catalog.to_jsonb(selected_version.slug_snapshot),
      true
    );
  END IF;

  PERFORM pg_catalog.set_config('inkborne.background_choice_rpc', 'on', true);

  DELETE FROM public.character_content_refs AS ref
  USING public.content_versions AS version
  WHERE ref.character_id = target_character_id
    AND version.content_id = ref.content_id
    AND version.version = ref.content_version
    AND version.content_type_snapshot = 'background';

  UPDATE public.characters AS character
  SET choices = next_choices
  WHERE character.id = target_character_id
  RETURNING character.choices INTO saved_choices;

  IF target_content_id IS NOT NULL THEN
    INSERT INTO public.character_content_refs (
      character_id,
      content_id,
      content_version,
      context,
      choice_source,
      feature_grant_id
    ) VALUES (
      target_character_id,
      selected_background.id,
      selected_background.version,
      pg_catalog.jsonb_build_object('source', 'background'),
      'choice:background',
      NULL
    );
  END IF;

  selected_content_id := target_content_id;
  selected_content_version := target_content_version;

  PERFORM pg_catalog.set_config(
    'inkborne.background_choice_rpc',
    COALESCE(previous_rpc_setting, 'off'),
    true
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.set_character_background(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_character_background(uuid, uuid, integer)
  TO authenticated;

-- Preserve the complete copy contract while carrying the new background guard
-- across both the destination character row and its exact ref projection.
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
  previous_asi_rpc_setting text := pg_catalog.current_setting(
    'inkborne.asi_choice_rpc',
    true
  );
  previous_background_rpc_setting text := pg_catalog.current_setting(
    'inkborne.background_choice_rpc',
    true
  );
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT character.* INTO source_character
  FROM public.characters AS character
  WHERE character.id = source_character_id
    AND character.user_id = actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
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

  -- A privileged copy must never bless a malformed legacy background state.
  IF (
    SELECT pg_catalog.count(*)
    FROM public.character_content_refs AS ref
    JOIN public.content_versions AS version
      ON version.content_id = ref.content_id
     AND version.version = ref.content_version
     AND version.content_type_snapshot = 'background'
    WHERE ref.character_id = source_character_id
  ) > 1
    OR EXISTS (
      SELECT 1
      FROM public.character_content_refs AS ref
      JOIN public.content_versions AS version
        ON version.content_id = ref.content_id
       AND version.version = ref.content_version
       AND version.content_type_snapshot = 'background'
      WHERE ref.character_id = source_character_id
        AND (
          ref.choice_source IS DISTINCT FROM 'choice:background'
          OR ref.context IS DISTINCT FROM
            pg_catalog.jsonb_build_object('source', 'background')
          OR ref.feature_grant_id IS NOT NULL
          OR source_character.choices->>'background'
            IS DISTINCT FROM version.slug_snapshot
        )
    )
    OR (
      pg_catalog.btrim(COALESCE(source_character.choices->>'background', '')) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.character_content_refs AS ref
        JOIN public.content_versions AS version
          ON version.content_id = ref.content_id
         AND version.version = ref.content_version
         AND version.content_type_snapshot = 'background'
        WHERE ref.character_id = source_character_id
          AND ref.choice_source = 'choice:background'
          AND version.slug_snapshot = source_character.choices->>'background'
      )
    )
  THEN
    RAISE EXCEPTION 'Character contains a noncanonical background that cannot be copied'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('inkborne.asi_choice_rpc', 'on', true);
  PERFORM pg_catalog.set_config('inkborne.background_choice_rpc', 'on', true);

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
      ) = ref.content_id::text
      AND pg_catalog.jsonb_extract_path(
        source_character.choices,
        'asi_choices',
        source_grant.feature_slug,
        'featVersion'
      ) = pg_catalog.to_jsonb(ref.content_version)
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
    COALESCE(previous_asi_rpc_setting, 'off'),
    true
  );
  PERFORM pg_catalog.set_config(
    'inkborne.background_choice_rpc',
    COALESCE(previous_background_rpc_setting, 'off'),
    true
  );

  RETURN new_character_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_character(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_character(uuid, uuid, text)
  TO authenticated;
