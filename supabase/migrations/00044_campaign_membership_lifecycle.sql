-- Membership removal is a narrow administrative operation that also detaches
-- affected characters. This prevents a character from retaining a campaign
-- reference after its player is no longer a campaign member.

CREATE OR REPLACE FUNCTION public.leave_campaign(target_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF private.is_campaign_owner(target_campaign_id) THEN
    RAISE EXCEPTION 'Campaign owners cannot leave their own campaign'
      USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_campaign_member(target_campaign_id) THEN
    RAISE EXCEPTION 'Campaign membership not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.characters
  SET campaign_id = NULL
  WHERE campaign_id = target_campaign_id
    AND user_id = actor_id;

  DELETE FROM public.campaign_members
  WHERE campaign_id = target_campaign_id
    AND user_id = actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_campaign_member(
  target_campaign_id uuid,
  target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL OR NOT private.is_campaign_owner(target_campaign_id) THEN
    RAISE EXCEPTION 'Only the campaign owner can remove members'
      USING ERRCODE = '42501';
  END IF;

  IF target_user_id = actor_id THEN
    RAISE EXCEPTION 'Campaign owners cannot remove themselves'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.characters
  SET campaign_id = NULL
  WHERE campaign_id = target_campaign_id
    AND user_id = target_user_id;

  DELETE FROM public.campaign_members
  WHERE campaign_id = target_campaign_id
    AND user_id = target_user_id
    AND role = 'player';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign member not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_campaign(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_campaign_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_campaign_member(uuid, uuid) TO authenticated;
