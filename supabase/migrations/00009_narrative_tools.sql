-- ============================================================
-- NARRATIVE TOOLS MIGRATION
-- Adds narrative JSONB columns to characters and creates npcs table
-- ============================================================

-- Add narrative columns to characters
alter table public.characters
  add column if not exists narrative jsonb not null default '{}',
  add column if not exists narrative_rich jsonb not null default '{}';

-- ============================================================
-- NPCS TABLE
-- ============================================================
create table if not exists public.npcs (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  created_by   uuid not null references public.profiles(id),
  name         text not null,
  description  jsonb not null default '{}',
  relationship text,
  visibility   text not null default 'private'
                 check (visibility in ('private', 'dm_only', 'campaign')),
  portrait_url text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists idx_npcs_character_id on public.npcs(character_id);
create index if not exists idx_npcs_created_by on public.npcs(created_by);

-- Enable RLS
alter table public.npcs enable row level security;

-- ============================================================
-- NPC RLS POLICIES
-- ============================================================

-- Creator can view their own NPCs
create policy "Creator can view own NPCs"
  on public.npcs for select
  to authenticated
  using (created_by = auth.uid());

-- Campaign DM can view dm_only and campaign NPCs
create policy "Campaign DM can view dm_only and campaign NPCs"
  on public.npcs for select
  to authenticated
  using (
    visibility in ('dm_only', 'campaign')
    and character_id in (
      select ch.id from public.characters ch
      join public.campaigns c on c.id = ch.campaign_id
      where c.owner_id = auth.uid()
    )
  );

-- Campaign members can view campaign-visibility NPCs
create policy "Campaign members can view campaign NPCs"
  on public.npcs for select
  to authenticated
  using (
    visibility = 'campaign'
    and character_id in (
      select ch.id from public.characters ch
      join public.campaign_members cm on cm.campaign_id = ch.campaign_id
      where cm.user_id = auth.uid()
    )
  );

-- Creator can insert NPCs (only for characters they own)
create policy "Creator can insert NPCs"
  on public.npcs for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Creator can update their own NPCs
create policy "Creator can update own NPCs"
  on public.npcs for update
  to authenticated
  using (created_by = auth.uid());

-- Creator can delete their own NPCs
create policy "Creator can delete own NPCs"
  on public.npcs for delete
  to authenticated
  using (created_by = auth.uid());
