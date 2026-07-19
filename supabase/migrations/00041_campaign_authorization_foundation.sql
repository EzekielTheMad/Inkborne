-- Campaign authorization foundation.
--
-- Repairs membership bootstrap/self-join gaps, aligns character child-table
-- reads with sheet visibility, and creates the private/shared campaign wiki
-- boundary. See docs/specs/2026-07-19-campaign-foundation-design.md.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Harden existing functions flagged by the hosted Security Advisor. The auth
-- trigger remains callable only by Supabase's auth administrator; the state
-- patch RPC remains available only to signed-in clients and the service role.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

ALTER FUNCTION public.patch_character_state(uuid, jsonb) SET search_path = '';
REVOKE ALL ON FUNCTION public.patch_character_state(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_character_state(uuid, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS helpers. These live outside the exposed public schema and run as the
-- migration owner so policies do not recursively evaluate membership RLS.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_campaign_owner(target_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.campaigns AS campaign
      WHERE campaign.id = target_campaign_id
        AND campaign.owner_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION private.is_campaign_member(target_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.campaign_members AS member
      WHERE member.campaign_id = target_campaign_id
        AND member.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION private.can_access_campaign(target_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.campaigns AS campaign
        WHERE campaign.id = target_campaign_id
          AND campaign.owner_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaign_members AS member
        WHERE member.campaign_id = target_campaign_id
          AND member.user_id = (SELECT auth.uid())
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_assign_character_to_campaign(
  target_campaign_id uuid,
  target_system_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.campaigns AS campaign
      WHERE campaign.id = target_campaign_id
        AND campaign.system_id = target_system_id
        AND (
          campaign.owner_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.campaign_members AS member
            WHERE member.campaign_id = campaign.id
              AND member.user_id = (SELECT auth.uid())
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_view_character(target_character_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.characters AS character
      WHERE character.id = target_character_id
        AND (
          character.user_id = (SELECT auth.uid())
          OR (
            character.campaign_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.campaigns AS campaign
              WHERE campaign.id = character.campaign_id
                AND campaign.owner_id = (SELECT auth.uid())
            )
          )
          OR (
            character.archived = false
            AND character.visibility = 'public'
          )
          OR (
            character.archived = false
            AND character.visibility = 'campaign'
            AND character.campaign_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.campaign_members AS member
              WHERE member.campaign_id = character.campaign_id
                AND member.user_id = (SELECT auth.uid())
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.is_campaign_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_campaign_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_campaign(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_assign_character_to_campaign(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_character(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_campaign_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_campaign_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_assign_character_to_campaign(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_character(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id
  ON public.campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_system_id
  ON public.campaigns(system_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id
  ON public.campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_user_id
  ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_system_id
  ON public.characters(system_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign_id
  ON public.characters(campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_character_content_refs_content_id
  ON public.character_content_refs(content_id);
CREATE INDEX IF NOT EXISTS idx_character_rolls_user_id
  ON public.character_rolls(user_id);

-- ---------------------------------------------------------------------------
-- Campaign identity and owner membership.
-- ---------------------------------------------------------------------------

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.campaigns
  ALTER COLUMN invite_code SET DEFAULT encode(gen_random_bytes(12), 'hex');

INSERT INTO public.campaign_members (campaign_id, user_id, role)
SELECT campaign.id, campaign.owner_id, 'dm'
FROM public.campaigns AS campaign
ON CONFLICT (campaign_id, user_id)
DO UPDATE SET role = 'dm';

CREATE OR REPLACE FUNCTION private.add_campaign_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'dm')
  ON CONFLICT (campaign_id, user_id)
  DO UPDATE SET role = 'dm';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.protect_campaign_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Campaign ownership can only change through a transfer workflow';
  END IF;
  IF NEW.system_id IS DISTINCT FROM OLD.system_id THEN
    RAISE EXCEPTION 'Campaign game system is immutable';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.add_campaign_owner_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.protect_campaign_identity() FROM PUBLIC;

DROP TRIGGER IF EXISTS add_campaign_owner_membership ON public.campaigns;
CREATE TRIGGER add_campaign_owner_membership
AFTER INSERT ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION private.add_campaign_owner_membership();

DROP TRIGGER IF EXISTS protect_campaign_identity ON public.campaigns;
CREATE TRIGGER protect_campaign_identity
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION private.protect_campaign_identity();

-- ---------------------------------------------------------------------------
-- Campaign and membership policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Campaign visible to members" ON public.campaigns;
DROP POLICY IF EXISTS "Owner can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Owner can update campaigns" ON public.campaigns;

CREATE POLICY "Campaign visible to authorized users"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (private.can_access_campaign(id));

CREATE POLICY "Owner can create campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Owner can update campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "Owner can delete campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can view campaign membership" ON public.campaign_members;
DROP POLICY IF EXISTS "Campaign owner can manage members" ON public.campaign_members;
DROP POLICY IF EXISTS "Members can remove themselves" ON public.campaign_members;

CREATE POLICY "Campaign roster visible to authorized users"
  ON public.campaign_members FOR SELECT
  TO authenticated
  USING (private.can_access_campaign(campaign_id));

CREATE POLICY "Campaign owner can add players"
  ON public.campaign_members FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_campaign_owner(campaign_id)
    AND role = 'player'
  );

CREATE POLICY "Owner can remove players and players can leave"
  ON public.campaign_members FOR DELETE
  TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      AND NOT private.is_campaign_owner(campaign_id)
    )
    OR (
      private.is_campaign_owner(campaign_id)
      AND user_id <> (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Character visibility and assignment. DMs can read but never satisfy the
-- owner-only mutation predicate for a player character.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owner can view own characters" ON public.characters;
DROP POLICY IF EXISTS "Public characters visible to all" ON public.characters;
DROP POLICY IF EXISTS "Campaign characters visible to campaign members" ON public.characters;
DROP POLICY IF EXISTS "Private characters visible to campaign DM" ON public.characters;
DROP POLICY IF EXISTS "Owner can insert characters" ON public.characters;
DROP POLICY IF EXISTS "Owner can update characters" ON public.characters;

CREATE POLICY "Authorized users can view characters"
  ON public.characters FOR SELECT
  TO authenticated
  USING (private.can_view_character(id));

CREATE POLICY "Owner can insert characters"
  ON public.characters FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      campaign_id IS NULL
      OR private.can_assign_character_to_campaign(campaign_id, system_id)
    )
  );

CREATE POLICY "Owner can update characters"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      campaign_id IS NULL
      OR private.can_assign_character_to_campaign(campaign_id, system_id)
    )
  );

DROP POLICY IF EXISTS "Owner can view character content refs"
  ON public.character_content_refs;
DROP POLICY IF EXISTS "Campaign DM can view character content refs"
  ON public.character_content_refs;

CREATE POLICY "Authorized viewers can view character content refs"
  ON public.character_content_refs FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

CREATE POLICY "Authorized viewers can view inventory"
  ON public.character_inventory FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

CREATE POLICY "Authorized viewers can view spells"
  ON public.character_spells FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

DROP POLICY IF EXISTS "Owner can view rolls" ON public.character_rolls;
CREATE POLICY "Authorized viewers can view rolls"
  ON public.character_rolls FOR SELECT
  TO authenticated
  USING (private.can_view_character(character_id));

-- ---------------------------------------------------------------------------
-- Campaign wiki pages. Public publishing is intentionally not represented in
-- this table's visibility enum; it will be a separate, explicitly filtered
-- read model.
-- ---------------------------------------------------------------------------

CREATE TABLE public.campaign_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.campaign_pages(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid DEFAULT auth.uid()
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  content jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'campaign'
    CHECK (visibility IN ('campaign', 'dm_only')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, slug)
);

CREATE INDEX idx_campaign_pages_campaign_parent
  ON public.campaign_pages(campaign_id, parent_id);
CREATE INDEX idx_campaign_pages_campaign_visibility
  ON public.campaign_pages(campaign_id, visibility);
CREATE INDEX idx_campaign_pages_created_by
  ON public.campaign_pages(created_by);

ALTER TABLE public.campaign_pages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.enforce_campaign_page_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN
      RAISE EXCEPTION 'Campaign pages cannot move between campaigns';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Campaign page creator is immutable';
    END IF;
    NEW.revision = OLD.revision + 1;
  END IF;

  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.campaign_pages AS parent
    WHERE parent.id = NEW.parent_id
      AND parent.campaign_id = NEW.campaign_id
      AND parent.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Campaign page parent must belong to the same campaign';
  END IF;

  NEW.updated_by = (SELECT auth.uid());
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_campaign_page_integrity() FROM PUBLIC;

CREATE TRIGGER enforce_campaign_page_integrity
BEFORE INSERT OR UPDATE ON public.campaign_pages
FOR EACH ROW EXECUTE FUNCTION private.enforce_campaign_page_integrity();

CREATE POLICY "Authorized users can view campaign pages"
  ON public.campaign_pages FOR SELECT
  TO authenticated
  USING (
    private.is_campaign_owner(campaign_id)
    OR created_by = (SELECT auth.uid())
    OR (
      visibility = 'campaign'
      AND private.is_campaign_member(campaign_id)
    )
  );

CREATE POLICY "Campaign members can create pages"
  ON public.campaign_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_access_campaign(campaign_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
  );

CREATE POLICY "Page creators and campaign owner can update pages"
  ON public.campaign_pages FOR UPDATE
  TO authenticated
  USING (
    private.is_campaign_owner(campaign_id)
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    private.can_access_campaign(campaign_id)
    AND (
      private.is_campaign_owner(campaign_id)
      OR created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Page creators and campaign owner can delete pages"
  ON public.campaign_pages FOR DELETE
  TO authenticated
  USING (
    private.is_campaign_owner(campaign_id)
    OR created_by = (SELECT auth.uid())
  );

REVOKE ALL ON public.campaign_pages FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.campaign_pages TO authenticated;

-- ---------------------------------------------------------------------------
-- Invite-code RPCs. Direct player self-insert is intentionally disallowed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_campaign_by_invite_code(
  provided_invite_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  target_campaign_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF provided_invite_code IS NULL OR btrim(provided_invite_code) = '' THEN
    RAISE EXCEPTION 'Invite code is required' USING ERRCODE = '22023';
  END IF;

  SELECT campaign.id
  INTO target_campaign_id
  FROM public.campaigns AS campaign
  WHERE lower(campaign.invite_code) = lower(btrim(provided_invite_code));

  IF target_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (target_campaign_id, actor_id, 'player')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  RETURN target_campaign_id;
END;
$$;

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

  new_invite_code := encode(gen_random_bytes(12), 'hex');
  UPDATE public.campaigns
  SET invite_code = new_invite_code
  WHERE id = target_campaign_id;

  RETURN new_invite_code;
END;
$$;

REVOKE ALL ON FUNCTION public.join_campaign_by_invite_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_campaign_invite_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_campaign_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_campaign_invite_code(uuid) TO authenticated;
