-- ============================================================
-- PROFILES
-- ============================================================
create policy "Users can view any profile"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- ============================================================
-- GAME SYSTEMS
-- ============================================================
create policy "Published systems visible to all"
  on public.game_systems for select
  to authenticated
  using (status = 'published');

-- ============================================================
-- CONTENT DEFINITIONS
-- ============================================================
create policy "Platform content visible to all"
  on public.content_definitions for select
  to authenticated
  using (scope = 'platform');

create policy "Personal content visible to owner"
  on public.content_definitions for select
  to authenticated
  using (scope = 'personal' and owner_id = auth.uid());

create policy "Shared content visible to owner and campaign members"
  on public.content_definitions for select
  to authenticated
  using (
    scope = 'shared' and (
      owner_id = auth.uid()
      or id in (
        select cs.content_id from public.content_shares cs
        join public.campaign_members cm on cm.campaign_id = cs.campaign_id
        where cm.user_id = auth.uid()
      )
    )
  );

create policy "Owner can insert content"
  on public.content_definitions for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update content"
  on public.content_definitions for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Owner can delete content"
  on public.content_definitions for delete
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CONTENT VERSIONS
-- ============================================================
create policy "Content versions follow parent visibility"
  on public.content_versions for select
  to authenticated
  using (
    content_id in (
      select id from public.content_definitions
    )
  );

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create policy "Campaign visible to members"
  on public.campaigns for select
  to authenticated
  using (
    id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Owner can create campaigns"
  on public.campaigns for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update campaigns"
  on public.campaigns for update
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CAMPAIGN MEMBERS
-- ============================================================
create policy "Members can view campaign membership"
  on public.campaign_members for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Campaign owner can manage members"
  on public.campaign_members for insert
  to authenticated
  with check (
    campaign_id in (
      select id from public.campaigns where owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Members can remove themselves"
  on public.campaign_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or campaign_id in (
      select id from public.campaigns where owner_id = auth.uid()
    )
  );

-- ============================================================
-- CHARACTERS
-- ============================================================
create policy "Owner can view own characters"
  on public.characters for select
  to authenticated
  using (user_id = auth.uid());

create policy "Public characters visible to all"
  on public.characters for select
  to authenticated
  using (visibility = 'public' and archived = false);

create policy "Campaign characters visible to campaign members"
  on public.characters for select
  to authenticated
  using (
    visibility = 'campaign'
    and archived = false
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Private characters visible to campaign DM"
  on public.characters for select
  to authenticated
  using (
    visibility = 'private'
    and campaign_id in (
      select cm.campaign_id from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where c.owner_id = auth.uid()
    )
  );

create policy "Owner can insert characters"
  on public.characters for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Owner can update characters"
  on public.characters for update
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- CUSTOM CONTENT TYPES
-- ============================================================
create policy "Personal custom types visible to owner"
  on public.custom_content_types for select
  to authenticated
  using (scope = 'personal' and owner_id = auth.uid());

create policy "Shared custom types visible to owner and campaign members"
  on public.custom_content_types for select
  to authenticated
  using (
    scope = 'shared' and (
      owner_id = auth.uid()
      or id in (
        select cts.content_type_id from public.content_type_shares cts
        join public.campaign_members cm on cm.campaign_id = cts.campaign_id
        where cm.user_id = auth.uid()
      )
    )
  );

create policy "Owner can insert custom types"
  on public.custom_content_types for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owner can update custom types"
  on public.custom_content_types for update
  to authenticated
  using (owner_id = auth.uid());

-- ============================================================
-- CONTENT SHARES
-- ============================================================
create policy "Shares visible to campaign members"
  on public.content_shares for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Members can share own content"
  on public.content_shares for insert
  to authenticated
  with check (
    shared_by = auth.uid()
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
    and content_id in (
      select id from public.content_definitions
      where owner_id = auth.uid()
    )
  );

create policy "Owner can unshare content"
  on public.content_shares for delete
  to authenticated
  using (shared_by = auth.uid());

-- ============================================================
-- CONTENT TYPE SHARES
-- ============================================================
create policy "Type shares visible to campaign members"
  on public.content_type_shares for select
  to authenticated
  using (
    campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
  );

create policy "Members can share own custom types"
  on public.content_type_shares for insert
  to authenticated
  with check (
    shared_by = auth.uid()
    and campaign_id in (
      select campaign_id from public.campaign_members
      where user_id = auth.uid()
    )
    and content_type_id in (
      select id from public.custom_content_types
      where owner_id = auth.uid()
    )
  );

create policy "Owner can unshare custom types"
  on public.content_type_shares for delete
  to authenticated
  using (shared_by = auth.uid());
