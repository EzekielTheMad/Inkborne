-- Extend the existing campaign-scoped homebrew boundary to backgrounds.
-- Background definitions keep the same owner-only edit contract as spells
-- and feats; this migration changes only which validated content types the
-- narrowly granted sharing RPCs accept and expose to campaign owners.

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
    AND definition.content_type IN ('spell', 'feat', 'background')
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
    AND definition.content_type IN ('spell', 'feat', 'background')
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
