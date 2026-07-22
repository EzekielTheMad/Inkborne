-- Preserve the background-only mutation boundary without rejecting ordinary
-- class/race/feat refs whose optional choice_source is NULL. SQL's three-valued
-- boolean comparison made NULL distinct from false in the initial guard.
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
      COALESCE(OLD.choice_source = 'choice:background', false)
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
    new_uses_background_source := COALESCE(
      NEW.choice_source = 'choice:background',
      false
    );
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
