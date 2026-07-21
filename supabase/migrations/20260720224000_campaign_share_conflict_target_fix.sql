-- Remove the PL/pgSQL output-column ambiguity in the share insert.
-- `content_id` is both a RETURNS TABLE output variable and a table column, so
-- the column-list conflict target is ambiguous inside this function. The
-- named unique constraint is stable and expresses the same idempotent write.

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
  derived_scope text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
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
    AND definition.owner_id = actor_id
    AND definition.source = 'homebrew'
    AND definition.is_retired = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active owned homebrew content was not found'
      USING ERRCODE = '42501';
  END IF;

  IF locked_definition.version IS DISTINCT FROM expected_version THEN
    RAISE EXCEPTION 'Content changed in another session'
      USING ERRCODE = '40001';
  END IF;

  IF enabled THEN
    SELECT campaign.system_id
    INTO campaign_system_id
    FROM public.campaigns AS campaign
    JOIN public.campaign_members AS member
      ON member.campaign_id = campaign.id
     AND member.user_id = actor_id
    WHERE campaign.id = target_campaign_id
    FOR KEY SHARE OF campaign, member;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Campaign membership is required to share content'
        USING ERRCODE = '42501';
    END IF;

    IF campaign_system_id IS DISTINCT FROM locked_definition.system_id THEN
      RAISE EXCEPTION 'Content and campaign game systems must match'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.content_shares (
      content_id,
      campaign_id,
      shared_by
    ) VALUES (
      locked_definition.id,
      target_campaign_id,
      actor_id
    )
    ON CONFLICT ON CONSTRAINT content_shares_content_id_campaign_id_key
    DO NOTHING;
  ELSE
    DELETE FROM public.content_shares AS share
    WHERE share.content_id = locked_definition.id
      AND share.campaign_id = target_campaign_id;
  END IF;

  SELECT count(*)
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
