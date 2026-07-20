-- Keep shared character prose and its separately protected DM notes consistent.
-- One RPC call gives the application a single Postgres transaction while the
-- function independently enforces character ownership.

CREATE OR REPLACE FUNCTION public.save_character_narrative_rich(
  target_character_id uuid,
  shared_narrative jsonb,
  dm_notes jsonb,
  write_dm_notes boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.characters
  SET narrative_rich = shared_narrative
  WHERE id = target_character_id
    AND user_id = (SELECT auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found or not owned by caller' USING ERRCODE = '42501';
  END IF;

  IF write_dm_notes THEN
    INSERT INTO public.character_dm_notes (character_id, content, updated_at)
    VALUES (target_character_id, dm_notes, now())
    ON CONFLICT (character_id) DO UPDATE
      SET content = EXCLUDED.content,
          updated_at = EXCLUDED.updated_at;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_character_narrative_rich(uuid, jsonb, jsonb, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_character_narrative_rich(uuid, jsonb, jsonb, boolean)
  TO authenticated;
