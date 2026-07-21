-- Campaign-scoped homebrew sharing and character-aware spell discovery.
--
-- Definitions remain author-owned. Sharing changes only the campaign access
-- rows and the definition's derived scope; the existing content-definition
-- triggers manage version increments and immutable snapshots.

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

  -- Serialize every share/unshare for one definition. The lock also makes the
  -- optimistic-version check and the derived scope update one atomic unit.
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
    -- Lock the membership row through commit so a concurrent leave/remove
    -- cannot make this authorization check stale before the share is created.
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
    -- Owners may always withdraw their own content, including after leaving a
    -- campaign. Ownership was established by the locked definition above.
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

  -- Even when the scope is unchanged, the database-managed version trigger
  -- preserves the existing counter. The first share and final unshare change
  -- scope and therefore produce an immutable new version automatically.
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

-- Sharing mutations must pass through the atomic RPC above. Members retain
-- read access to share metadata under the existing RLS policy.
REVOKE INSERT, UPDATE, DELETE ON public.content_shares
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.content_shares TO authenticated;

-- Members can inspect shares in campaigns they currently belong to. Authors
-- additionally need exact share metadata they created so library counts remain
-- correct and former-campaign shares remain discoverable. `shared_by` is
-- integrity-checked against definition ownership at every write boundary and
-- avoids a recursive content_definitions <-> content_shares RLS dependency.
DROP POLICY IF EXISTS "Shares visible to campaign members"
  ON public.content_shares;
DROP POLICY IF EXISTS "Shares visible to campaign members and content owners"
  ON public.content_shares;
CREATE POLICY "Shares visible to campaign members and content owners"
  ON public.content_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_members AS member
      WHERE member.campaign_id = content_shares.campaign_id
        AND member.user_id = (SELECT auth.uid())
    )
    OR content_shares.shared_by = (SELECT auth.uid())
  );

CREATE OR REPLACE FUNCTION public.list_owned_content_campaign_access(
  target_content_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  shared boolean,
  eligible boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  content_system_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF target_content_id IS NULL THEN
    RAISE EXCEPTION 'Content is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT definition.system_id
  INTO content_system_id
  FROM public.content_definitions AS definition
  WHERE definition.id = target_content_id
    AND definition.owner_id = actor_id
    AND definition.source = 'homebrew'
    AND definition.is_retired = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active owned homebrew content was not found'
      USING ERRCODE = '42501';
  END IF;

  -- Include current memberships (eligible to enable) plus existing shares
  -- (always removable by the content owner), without widening either table's
  -- ordinary RLS visibility.
  RETURN QUERY
  SELECT
    campaign.id,
    campaign.name,
    EXISTS (
      SELECT 1
      FROM public.content_shares AS share
      WHERE share.content_id = target_content_id
        AND share.campaign_id = campaign.id
    ) AS shared,
    EXISTS (
      SELECT 1
      FROM public.campaign_members AS member
      WHERE member.campaign_id = campaign.id
        AND member.user_id = actor_id
    ) AS eligible
  FROM public.campaigns AS campaign
  WHERE campaign.system_id = content_system_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.campaign_members AS member
        WHERE member.campaign_id = campaign.id
          AND member.user_id = actor_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.content_shares AS share
        WHERE share.content_id = target_content_id
          AND share.campaign_id = campaign.id
      )
    )
  ORDER BY campaign.name, campaign.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_owned_content_campaign_access(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_owned_content_campaign_access(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.search_usable_spells_for_character(
  target_character_id uuid,
  search_query text DEFAULT '',
  class_slug text DEFAULT NULL,
  spell_level integer DEFAULT NULL,
  spell_school text DEFAULT NULL,
  ritual_only boolean DEFAULT false,
  concentration_only boolean DEFAULT false,
  result_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  content_type text,
  data jsonb,
  effects jsonb,
  version integer,
  source text,
  system_id uuid,
  scope text,
  owner_id uuid
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
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.char_length(COALESCE(search_query, '')) > 200 THEN
    RAISE EXCEPTION 'Spell search text must not exceed 200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF class_slug IS NOT NULL
    AND pg_catalog.char_length(class_slug) > 100
  THEN
    RAISE EXCEPTION 'Spell class filter must not exceed 100 characters'
      USING ERRCODE = '22023';
  END IF;

  IF spell_school IS NOT NULL
    AND pg_catalog.char_length(spell_school) > 100
  THEN
    RAISE EXCEPTION 'Spell school filter must not exceed 100 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT character.system_id
  INTO character_system_id
  FROM public.characters AS character
  WHERE character.id = target_character_id
    AND character.user_id = actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character ownership is required to search usable spells'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    definition.id,
    definition.name,
    definition.slug,
    definition.content_type,
    definition.data,
    definition.effects,
    definition.version,
    definition.source,
    definition.system_id,
    definition.scope,
    definition.owner_id
  FROM public.content_definitions AS definition
  WHERE definition.system_id = character_system_id
    AND definition.content_type = 'spell'
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
    AND (
      class_slug IS NULL
      OR (definition.data -> 'classes') ? class_slug
    )
    AND (
      spell_level IS NULL
      OR definition.data ->> 'level' = spell_level::text
    )
    AND (
      spell_school IS NULL
      OR definition.data ->> 'school' = spell_school
    )
    AND (
      NOT COALESCE(ritual_only, false)
      OR definition.data @> '{"ritual": true}'::jsonb
    )
    AND (
      NOT COALESCE(concentration_only, false)
      OR definition.data @> '{"concentration": true}'::jsonb
    )
  ORDER BY definition.name, definition.id
  LIMIT LEAST(
    GREATEST(COALESCE(result_limit, 50), 1),
    50
  );
END;
$$;

REVOKE ALL ON FUNCTION public.search_usable_spells_for_character(
  uuid, text, text, integer, text, boolean, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_usable_spells_for_character(
  uuid, text, text, integer, text, boolean, boolean, integer
) TO authenticated;
