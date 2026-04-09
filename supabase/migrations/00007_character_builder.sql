-- ============================================================
-- ALTER CHARACTERS TABLE — Add builder columns
-- ============================================================
alter table public.characters
  add column level integer not null default 1,
  add column base_stats jsonb not null default '{}',
  add column choices jsonb not null default '{}',
  add column state jsonb not null default '{}';

-- ============================================================
-- CHARACTER CONTENT REFS — Tracks content selections per character
-- ============================================================
create table public.character_content_refs (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  content_version integer not null default 1,
  context jsonb not null default '{}',
  choice_source text,
  created_at timestamptz not null default now()
);

alter table public.character_content_refs enable row level security;

create index idx_character_content_refs_character_id
  on public.character_content_refs(character_id);

create index idx_character_content_refs_choice_source
  on public.character_content_refs(choice_source)
  where choice_source is not null;

-- ============================================================
-- RLS POLICIES — character_content_refs
-- ============================================================

-- Select: character owner can view
create policy "Owner can view character content refs"
  on public.character_content_refs for select
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Select: campaign DM can view (if character is in a campaign)
create policy "Campaign DM can view character content refs"
  on public.character_content_refs for select
  to authenticated
  using (
    character_id in (
      select c.id from public.characters c
      join public.campaigns camp on camp.id = c.campaign_id
      where camp.owner_id = auth.uid()
    )
  );

-- Insert: character owner only
create policy "Owner can insert character content refs"
  on public.character_content_refs for insert
  to authenticated
  with check (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Update: character owner only
create policy "Owner can update character content refs"
  on public.character_content_refs for update
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );

-- Delete: character owner only
create policy "Owner can delete character content refs"
  on public.character_content_refs for delete
  to authenticated
  using (
    character_id in (
      select id from public.characters where user_id = auth.uid()
    )
  );
