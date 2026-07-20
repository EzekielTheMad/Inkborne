-- Freeze class/subclass-granted spells at the exact versions visible when the
-- pinned controller is selected. Character level changes only activate or
-- deactivate rows backed by this immutable manifest.

CREATE TABLE public.character_spell_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL
    REFERENCES public.characters(id) ON DELETE CASCADE,
  controller_ref_id uuid NOT NULL,
  controller_type text NOT NULL
    CHECK (controller_type IN ('class', 'subclass')),
  controller_slug text NOT NULL,
  class_slug text NOT NULL,
  spell_slug text NOT NULL,
  spell_content_id uuid NOT NULL,
  spell_version integer NOT NULL CHECK (spell_version >= 1),
  spell_name text NOT NULL,
  unlock_level integer NOT NULL CHECK (unlock_level BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_spell_grants_spell_version_fkey
    FOREIGN KEY (spell_content_id, spell_version)
    REFERENCES public.content_versions(content_id, version)
    ON DELETE RESTRICT,
  CONSTRAINT character_spell_grants_controller_ref_fkey
    FOREIGN KEY (controller_ref_id, character_id)
    REFERENCES public.character_content_refs(id, character_id)
    ON DELETE CASCADE,
  CONSTRAINT character_spell_grants_controller_spell_unique
    UNIQUE (controller_ref_id, spell_slug),
  CONSTRAINT character_spell_grants_identity_unique
    UNIQUE (
      id,
      character_id,
      spell_content_id,
      spell_version,
      class_slug
    )
);

CREATE INDEX idx_character_spell_grants_character_id
  ON public.character_spell_grants(character_id);

CREATE INDEX idx_character_spell_grants_spell_version
  ON public.character_spell_grants(spell_content_id, spell_version);

CREATE OR REPLACE FUNCTION private.materialize_spell_grants_for_ref(
  target_ref_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controller record;
  manifest_entry record;
  spell_value jsonb;
  dependency_slug text;
  dependency_level integer;
  resolved_spell record;
BEGIN
  SELECT
    ref.id AS ref_id,
    ref.character_id,
    version.content_id,
    version.version,
    version.content_type_snapshot,
    version.slug_snapshot,
    version.system_id_snapshot,
    version.source_snapshot,
    version.owner_id_snapshot,
    version.data_snapshot,
    version.created_at
  INTO controller
  FROM public.character_content_refs AS ref
  JOIN public.content_versions AS version
    ON version.content_id = ref.content_id
   AND version.version = ref.content_version
  WHERE ref.id = target_ref_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.character_spell_grants
  WHERE controller_ref_id = target_ref_id;

  IF controller.content_type_snapshot NOT IN ('class', 'subclass')
    OR controller.data_snapshot->'spellcastingExtra' IS NULL
  THEN
    RETURN;
  END IF;

  IF jsonb_typeof(controller.data_snapshot->'spellcastingExtra') <> 'array' THEN
    RAISE EXCEPTION 'Pinned % % has a malformed spell grant manifest',
      controller.content_type_snapshot,
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  IF controller.content_type_snapshot = 'subclass'
    AND btrim(COALESCE(controller.data_snapshot->>'parent_class', '')) = ''
  THEN
    RAISE EXCEPTION 'Pinned subclass % has no parent class for spell grants',
      controller.slug_snapshot
      USING ERRCODE = '22023';
  END IF;

  FOR manifest_entry IN
    SELECT value, ordinality
    FROM jsonb_array_elements(
      controller.data_snapshot->'spellcastingExtra'
    ) WITH ORDINALITY
  LOOP
    IF jsonb_typeof(manifest_entry.value) = 'object' THEN
      IF COALESCE(manifest_entry.value->>'level', '') !~ '^[0-9]+$'
        OR jsonb_typeof(manifest_entry.value->'spells') <> 'array'
      THEN
        RAISE EXCEPTION 'Pinned % % has a malformed spell grant tier',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;
      dependency_level := (manifest_entry.value->>'level')::integer;
      FOR spell_value IN
        SELECT value
        FROM jsonb_array_elements(manifest_entry.value->'spells')
      LOOP
        IF jsonb_typeof(spell_value) <> 'string' THEN
          RAISE EXCEPTION 'Pinned % % contains a non-text spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;
        dependency_slug := btrim(spell_value #>> '{}');

        IF dependency_level < 1 OR dependency_level > 20
          OR dependency_slug = ''
        THEN
          RAISE EXCEPTION 'Pinned % % contains an invalid spell grant',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;

        SELECT candidate.content_id, candidate.version, candidate.name_snapshot
        INTO resolved_spell
        FROM public.content_versions AS candidate
        WHERE candidate.system_id_snapshot = controller.system_id_snapshot
          AND candidate.content_type_snapshot = 'spell'
          AND candidate.slug_snapshot = dependency_slug
          AND candidate.created_at <= controller.created_at
          AND (
            (
              controller.source_snapshot = 'srd'
              AND candidate.source_snapshot = 'srd'
              AND candidate.scope_snapshot = 'platform'
            )
            OR (
              controller.source_snapshot = 'homebrew'
              AND private.character_can_access_content_version(
                controller.character_id,
                candidate.content_id,
                candidate.version
              )
            )
          )
        ORDER BY
          (
            candidate.owner_id_snapshot IS NOT DISTINCT FROM
            controller.owner_id_snapshot
          ) DESC,
          (candidate.scope_snapshot = 'platform') DESC,
          candidate.created_at DESC,
          candidate.version DESC,
          candidate.content_id
        LIMIT 1;

        IF NOT FOUND OR private.character_can_access_content_version(
          controller.character_id,
          resolved_spell.content_id,
          resolved_spell.version
        ) IS NOT TRUE THEN
          RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
            dependency_slug,
            controller.content_type_snapshot,
            controller.slug_snapshot,
            controller.version
            USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.character_spell_grants (
          character_id,
          controller_ref_id,
          controller_type,
          controller_slug,
          class_slug,
          spell_slug,
          spell_content_id,
          spell_version,
          spell_name,
          unlock_level
        ) VALUES (
          controller.character_id,
          controller.ref_id,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          CASE
            WHEN controller.content_type_snapshot = 'class'
              THEN controller.slug_snapshot
            ELSE controller.data_snapshot->>'parent_class'
          END,
          dependency_slug,
          resolved_spell.content_id,
          resolved_spell.version,
          resolved_spell.name_snapshot,
          dependency_level
        )
        ON CONFLICT (controller_ref_id, spell_slug)
        DO UPDATE SET
          spell_content_id = EXCLUDED.spell_content_id,
          spell_version = EXCLUDED.spell_version,
          spell_name = EXCLUDED.spell_name,
          unlock_level = LEAST(
            public.character_spell_grants.unlock_level,
            EXCLUDED.unlock_level
          );
      END LOOP;
    ELSIF jsonb_typeof(manifest_entry.value) = 'array' THEN
      dependency_level := manifest_entry.ordinality::integer;
      FOR spell_value IN
        SELECT value FROM jsonb_array_elements(manifest_entry.value)
      LOOP
        IF jsonb_typeof(spell_value) <> 'string' THEN
          RAISE EXCEPTION 'Pinned % % contains a non-text spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;
        dependency_slug := btrim(spell_value #>> '{}');

        IF dependency_slug = '' THEN
          RAISE EXCEPTION 'Pinned % % contains an empty spell slug',
            controller.content_type_snapshot,
            controller.slug_snapshot
            USING ERRCODE = '22023';
        END IF;

        SELECT candidate.content_id, candidate.version, candidate.name_snapshot
        INTO resolved_spell
        FROM public.content_versions AS candidate
        WHERE candidate.system_id_snapshot = controller.system_id_snapshot
          AND candidate.content_type_snapshot = 'spell'
          AND candidate.slug_snapshot = dependency_slug
          AND candidate.created_at <= controller.created_at
          AND (
            (
              controller.source_snapshot = 'srd'
              AND candidate.source_snapshot = 'srd'
              AND candidate.scope_snapshot = 'platform'
            )
            OR (
              controller.source_snapshot = 'homebrew'
              AND private.character_can_access_content_version(
                controller.character_id,
                candidate.content_id,
                candidate.version
              )
            )
          )
        ORDER BY
          (
            candidate.owner_id_snapshot IS NOT DISTINCT FROM
            controller.owner_id_snapshot
          ) DESC,
          (candidate.scope_snapshot = 'platform') DESC,
          candidate.created_at DESC,
          candidate.version DESC,
          candidate.content_id
        LIMIT 1;

        IF NOT FOUND OR private.character_can_access_content_version(
          controller.character_id,
          resolved_spell.content_id,
          resolved_spell.version
        ) IS NOT TRUE THEN
          RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
            dependency_slug,
            controller.content_type_snapshot,
            controller.slug_snapshot,
            controller.version
            USING ERRCODE = '23503';
        END IF;

        INSERT INTO public.character_spell_grants (
          character_id, controller_ref_id, controller_type, controller_slug,
          class_slug, spell_slug, spell_content_id, spell_version, spell_name,
          unlock_level
        ) VALUES (
          controller.character_id,
          controller.ref_id,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          CASE
            WHEN controller.content_type_snapshot = 'class'
              THEN controller.slug_snapshot
            ELSE controller.data_snapshot->>'parent_class'
          END,
          dependency_slug,
          resolved_spell.content_id,
          resolved_spell.version,
          resolved_spell.name_snapshot,
          dependency_level
        )
        ON CONFLICT (controller_ref_id, spell_slug)
        DO UPDATE SET
          spell_content_id = EXCLUDED.spell_content_id,
          spell_version = EXCLUDED.spell_version,
          spell_name = EXCLUDED.spell_name,
          unlock_level = LEAST(
            public.character_spell_grants.unlock_level,
            EXCLUDED.unlock_level
          );
      END LOOP;
    ELSIF jsonb_typeof(manifest_entry.value) = 'string' THEN
      dependency_level := manifest_entry.ordinality::integer;
      dependency_slug := btrim(manifest_entry.value #>> '{}');

      IF dependency_slug = '' THEN
        RAISE EXCEPTION 'Pinned % % contains an empty spell slug',
          controller.content_type_snapshot,
          controller.slug_snapshot
          USING ERRCODE = '22023';
      END IF;

      SELECT candidate.content_id, candidate.version, candidate.name_snapshot
      INTO resolved_spell
      FROM public.content_versions AS candidate
      WHERE candidate.system_id_snapshot = controller.system_id_snapshot
        AND candidate.content_type_snapshot = 'spell'
        AND candidate.slug_snapshot = dependency_slug
        AND candidate.created_at <= controller.created_at
        AND (
          (
            controller.source_snapshot = 'srd'
            AND candidate.source_snapshot = 'srd'
            AND candidate.scope_snapshot = 'platform'
          )
          OR (
            controller.source_snapshot = 'homebrew'
            AND private.character_can_access_content_version(
              controller.character_id,
              candidate.content_id,
              candidate.version
            )
          )
        )
      ORDER BY
        (
          candidate.owner_id_snapshot IS NOT DISTINCT FROM
          controller.owner_id_snapshot
        ) DESC,
        (candidate.scope_snapshot = 'platform') DESC,
        candidate.created_at DESC,
        candidate.version DESC,
        candidate.content_id
      LIMIT 1;

      IF NOT FOUND OR private.character_can_access_content_version(
        controller.character_id,
        resolved_spell.content_id,
        resolved_spell.version
      ) IS NOT TRUE THEN
        RAISE EXCEPTION 'Spell % cannot be resolved for pinned % % v%',
          dependency_slug,
          controller.content_type_snapshot,
          controller.slug_snapshot,
          controller.version
          USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.character_spell_grants (
        character_id, controller_ref_id, controller_type, controller_slug,
        class_slug, spell_slug, spell_content_id, spell_version, spell_name,
        unlock_level
      ) VALUES (
        controller.character_id,
        controller.ref_id,
        controller.content_type_snapshot,
        controller.slug_snapshot,
        CASE
          WHEN controller.content_type_snapshot = 'class'
            THEN controller.slug_snapshot
          ELSE controller.data_snapshot->>'parent_class'
        END,
        dependency_slug,
        resolved_spell.content_id,
        resolved_spell.version,
        resolved_spell.name_snapshot,
        dependency_level
      )
      ON CONFLICT (controller_ref_id, spell_slug)
      DO UPDATE SET
        spell_content_id = EXCLUDED.spell_content_id,
        spell_version = EXCLUDED.spell_version,
        spell_name = EXCLUDED.spell_name,
        unlock_level = LEAST(
          public.character_spell_grants.unlock_level,
          EXCLUDED.unlock_level
        );
    ELSE
      RAISE EXCEPTION 'Pinned % % has a malformed spell grant entry',
        controller.content_type_snapshot,
        controller.slug_snapshot
        USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.materialize_spell_grants_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.materialize_spell_grants_for_ref(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.materialize_spell_grants_for_ref(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.materialize_spell_grants_trigger()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER materialize_spell_grants
AFTER INSERT OR UPDATE OF character_id, content_id, content_version
ON public.character_content_refs
FOR EACH ROW
EXECUTE FUNCTION private.materialize_spell_grants_trigger();

-- One-time baseline uses only the controller snapshots that characters have
-- already pinned. No mutable content_definitions rows participate.
SELECT private.materialize_spell_grants_for_ref(ref.id)
FROM public.character_content_refs AS ref
JOIN public.content_versions AS version
  ON version.content_id = ref.content_id
 AND version.version = ref.content_version
WHERE version.content_type_snapshot IN ('class', 'subclass');

ALTER TABLE public.character_spells
  ADD COLUMN spell_grant_id uuid,
  ADD CONSTRAINT character_spells_spell_grant_character_fkey
    FOREIGN KEY (
      spell_grant_id,
      character_id,
      content_id,
      content_version,
      class_slug
    )
    REFERENCES public.character_spell_grants(
      id,
      character_id,
      spell_content_id,
      spell_version,
      class_slug
    )
    ON DELETE CASCADE,
  ADD CONSTRAINT character_spells_spell_grant_id_key
    UNIQUE (spell_grant_id);

CREATE OR REPLACE FUNCTION private.is_character_spell_grant_active(
  target_grant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.character_spell_grants AS grant_row
    JOIN public.characters AS character
      ON character.id = grant_row.character_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(character.choices->'classes') = 'array'
          THEN character.choices->'classes'
        ELSE '[]'::jsonb
      END
    ) AS class_choice(value)
    WHERE grant_row.id = target_grant_id
      AND COALESCE(class_choice.value->>'level', '') ~ '^[0-9]+$'
      AND (class_choice.value->>'level')::integer >= grant_row.unlock_level
      AND (
        (
          grant_row.controller_type = 'class'
          AND class_choice.value->>'slug' = grant_row.controller_slug
        )
        OR (
          grant_row.controller_type = 'subclass'
          AND class_choice.value->>'slug' = grant_row.class_slug
          AND class_choice.value->>'subclass' = grant_row.controller_slug
        )
      )
  );
$$;

-- Copied characters use the existing copy_character INSERT shape, which does
-- not include spell_grant_id. Link an exact active manifest entry automatically
-- and reject any attempt to forge or mutate derived spell identity fields.
CREATE OR REPLACE FUNCTION private.enforce_character_spell_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  grant_row public.character_spell_grants%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.spell_grant_id IS NOT NULL
    AND NEW.spell_grant_id IS DISTINCT FROM OLD.spell_grant_id
  THEN
    RAISE EXCEPTION 'Derived spell grant identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.source <> 'feature' THEN
    IF NEW.spell_grant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only feature spells may reference a spell grant'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.spell_grant_id IS NULL THEN
    SELECT candidate.* INTO grant_row
    FROM public.character_spell_grants AS candidate
    WHERE candidate.character_id = NEW.character_id
      AND candidate.spell_content_id = NEW.content_id
      AND candidate.spell_version = NEW.content_version
      AND candidate.class_slug = NEW.class_slug
      AND private.is_character_spell_grant_active(candidate.id)
    ORDER BY candidate.unlock_level, candidate.id
    LIMIT 1;

    IF NOT FOUND THEN
      IF TG_OP = 'INSERT' THEN
        RETURN NULL;
      END IF;
      RAISE EXCEPTION 'Feature spell has no matching active pinned grant'
        USING ERRCODE = '23514';
    END IF;
    NEW.spell_grant_id := grant_row.id;
  ELSE
    SELECT candidate.* INTO grant_row
    FROM public.character_spell_grants AS candidate
    WHERE candidate.id = NEW.spell_grant_id
      AND candidate.character_id = NEW.character_id;

    IF NOT FOUND
      OR private.is_character_spell_grant_active(NEW.spell_grant_id) IS NOT TRUE
    THEN
      RAISE EXCEPTION 'Feature spell grant is unavailable or inactive'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.content_id := grant_row.spell_content_id;
  NEW.content_version := grant_row.spell_version;
  NEW.name := grant_row.spell_name;
  NEW.class_slug := grant_row.class_slug;
  NEW.is_prepared := true;
  NEW.always_prepared := true;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.is_character_spell_grant_active(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_character_spell_grant()
  FROM PUBLIC, anon, authenticated;

-- Attach legacy derived rows to the exact pinned grant when possible. Any
-- unmatched legacy row is removed atomically by the first reconciliation.
WITH legacy_matches AS (
  SELECT DISTINCT ON (spell.id)
    spell.id AS spell_id,
    grant_row.id AS grant_id
  FROM public.character_spells AS spell
  JOIN public.character_spell_grants AS grant_row
    ON grant_row.character_id = spell.character_id
   AND grant_row.spell_content_id = spell.content_id
   AND grant_row.spell_version = spell.content_version
   AND grant_row.class_slug = spell.class_slug
  WHERE spell.source = 'feature'
    AND spell.spell_grant_id IS NULL
    AND private.is_character_spell_grant_active(grant_row.id)
  ORDER BY spell.id, grant_row.unlock_level, grant_row.id
)
UPDATE public.character_spells AS spell
SET spell_grant_id = matching.grant_id
FROM legacy_matches AS matching
WHERE spell.id = matching.spell_id;

CREATE TRIGGER enforce_character_spell_grant
BEFORE INSERT OR UPDATE OF
  character_id, content_id, content_version, name, class_slug, source,
  is_prepared, always_prepared, spell_grant_id
ON public.character_spells
FOR EACH ROW
EXECUTE FUNCTION private.enforce_character_spell_grant();

-- Multiple controllers can grant the same logical spell to the same class.
-- The manifest keeps every provenance row, while activation chooses one stable
-- representative for the physical character_spells projection.
CREATE OR REPLACE FUNCTION private.active_character_spell_grant_representatives(
  target_character_id uuid
)
RETURNS SETOF public.character_spell_grants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (grant_row.spell_content_id, grant_row.class_slug)
    grant_row.*
  FROM public.character_spell_grants AS grant_row
  WHERE grant_row.character_id = target_character_id
    AND private.is_character_spell_grant_active(grant_row.id)
  ORDER BY
    grant_row.spell_content_id,
    grant_row.class_slug,
    grant_row.unlock_level,
    grant_row.controller_ref_id,
    grant_row.id;
$$;

REVOKE ALL ON FUNCTION private.active_character_spell_grant_representatives(uuid)
  FROM PUBLIC, anon, authenticated;

-- Authorized read-only viewers (notably the campaign DM) must render the same
-- always-prepared overlay as the owner without gaining any mutation path.
CREATE OR REPLACE FUNCTION public.get_active_character_spell_grants(
  target_character_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_grants_payload jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR private.can_view_character(target_character_id) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'Character not found or unavailable to caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'content_id', active_grant.spell_content_id,
        'content_version', active_grant.spell_version,
        'class_slug', active_grant.class_slug
      )
      ORDER BY active_grant.spell_content_id, active_grant.class_slug
    ),
    '[]'::jsonb
  )
  INTO active_grants_payload
  FROM private.active_character_spell_grant_representatives(
    target_character_id
  ) AS active_grant;

  RETURN active_grants_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_character_spell_grants(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_character_spell_grants(uuid)
  TO authenticated;

-- Reconciliation is one transaction and derives level state from the stored
-- character choices. Callers cannot activate a future-level grant by supplying
-- a fabricated class level. Existing selection/known rows take precedence:
-- their acquisition provenance and stored preparation state are never mutated
-- or deleted merely because the same spell is temporarily granted.
CREATE OR REPLACE FUNCTION public.sync_character_spell_grants(
  target_character_id uuid
)
RETURNS TABLE(inserted integer, deleted integer, active_grants jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  inserted_count integer := 0;
  deleted_count integer := 0;
  active_grants_payload jsonb := '[]'::jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  -- Stabilize the choices snapshot across delete, insert, and overlay payload.
  PERFORM 1
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.character_spells AS spell
  WHERE spell.character_id = target_character_id
    AND spell.source = 'feature'
    AND (
      spell.spell_grant_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM private.active_character_spell_grant_representatives(
          target_character_id
        ) AS active_grant
        WHERE active_grant.id = spell.spell_grant_id
      )
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  INSERT INTO public.character_spells (
    character_id,
    content_id,
    content_version,
    name,
    class_slug,
    is_prepared,
    always_prepared,
    source,
    spell_grant_id
  )
  SELECT
    grant_row.character_id,
    grant_row.spell_content_id,
    grant_row.spell_version,
    grant_row.spell_name,
    grant_row.class_slug,
    true,
    true,
    'feature',
    grant_row.id
  FROM private.active_character_spell_grant_representatives(
    target_character_id
  ) AS grant_row
  WHERE NOT EXISTS (
      SELECT 1
      FROM public.character_spells AS existing
      WHERE existing.character_id = target_character_id
        AND existing.content_id = grant_row.spell_content_id
        AND existing.class_slug = grant_row.class_slug
    )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'content_id', active_grant.spell_content_id,
        'content_version', active_grant.spell_version,
        'class_slug', active_grant.class_slug
      )
      ORDER BY active_grant.spell_content_id, active_grant.class_slug
    ),
    '[]'::jsonb
  )
  INTO active_grants_payload
  FROM private.active_character_spell_grant_representatives(
    target_character_id
  ) AS active_grant;

  RETURN QUERY
  SELECT inserted_count, deleted_count, active_grants_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_character_spell_grants(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_character_spell_grants(uuid)
  TO authenticated;

ALTER TABLE public.character_spell_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view character spell grants"
  ON public.character_spell_grants FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

REVOKE ALL ON public.character_spell_grants
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.character_spell_grants
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_spell_grants
  TO service_role;
