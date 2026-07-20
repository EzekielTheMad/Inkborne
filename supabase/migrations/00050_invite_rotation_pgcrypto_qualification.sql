-- pgcrypto is installed in the extensions schema. SECURITY DEFINER functions
-- use an empty search_path, so extension functions must be schema-qualified.

ALTER TABLE public.campaigns
  ALTER COLUMN invite_code SET DEFAULT
    pg_catalog.encode(extensions.gen_random_bytes(12), 'hex');

CREATE OR REPLACE FUNCTION public.rotate_campaign_invite_code(
  target_campaign_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_invite_code text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.campaigns AS campaign
    WHERE campaign.id = target_campaign_id
      AND campaign.owner_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only the campaign owner can rotate the invite code'
      USING ERRCODE = '42501';
  END IF;

  new_invite_code := pg_catalog.encode(
    extensions.gen_random_bytes(12),
    'hex'
  );
  UPDATE public.campaigns
  SET invite_code = new_invite_code
  WHERE id = target_campaign_id;

  RETURN new_invite_code;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_campaign_invite_code(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_campaign_invite_code(uuid)
  TO authenticated;
