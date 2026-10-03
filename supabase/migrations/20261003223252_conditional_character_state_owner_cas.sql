CREATE FUNCTION public.patch_character_state_if_current(
  character_id uuid,
  expected_state jsonb,
  state_patch jsonb
)
RETURNS TABLE (status text, resulting_state jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  observed_state jsonb;
BEGIN
  IF character_id IS NULL OR expected_state IS NULL OR state_patch IS NULL
    OR jsonb_typeof(expected_state) <> 'object'
    OR jsonb_typeof(state_patch) <> 'object' THEN
    RAISE EXCEPTION 'Character, object snapshot and object patch are required'
      USING ERRCODE = '22023';
  END IF;

  -- Explicit ownership plus existing SELECT/UPDATE RLS; no privilege bypass.
  -- Lock survives through the comparison and merge until transaction completion.
  SELECT coalesce(c.state, '{}'::jsonb)
    INTO observed_state
    FROM public.characters AS c
    WHERE c.id = character_id AND c.user_id = (SELECT auth.uid())
    FOR UPDATE;

  IF NOT FOUND THEN
    -- Inaccessible and missing are indistinguishable; disclose no state.
    RETURN QUERY SELECT 'missing'::text, NULL::jsonb;
    RETURN;
  END IF;

  IF observed_state IS DISTINCT FROM expected_state THEN
    RETURN QUERY SELECT 'conflict'::text, observed_state;
    RETURN;
  END IF;

  UPDATE public.characters AS c
    SET state = observed_state || state_patch
    WHERE c.id = character_id AND c.user_id = (SELECT auth.uid())
    RETURNING c.state INTO observed_state;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'missing'::text, NULL::jsonb;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'applied'::text, observed_state;
END;
$function$;

REVOKE ALL ON FUNCTION public.patch_character_state_if_current(uuid, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_character_state_if_current(uuid, jsonb, jsonb)
  TO authenticated;
