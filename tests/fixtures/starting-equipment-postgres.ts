/** Synthetic dependencies for executing the unchanged equipment stage.
 * This is deliberately not a Supabase migration-chain replay. Baseline content
 * helpers and child schemas are narrowed to the scenarios under test; no feature
 * grant-generation trigger, extension, server, credential or network is used.
 */
export const equipmentFixtureSql = `
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
create table public.game_systems (id uuid primary key, status text not null);
create table public.campaigns (id uuid primary key, owner_id uuid not null, system_id uuid not null);
create table public.campaign_members (campaign_id uuid, user_id uuid, primary key(campaign_id,user_id));
create table public.characters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  system_id uuid not null references public.game_systems(id), name text not null,
  campaign_id uuid references public.campaigns(id), visibility text default 'private',
  archived boolean default false, level integer default 1, base_stats jsonb default '{}',
  choices jsonb default '{}', state jsonb default '{}', narrative jsonb default '{}',
  narrative_rich jsonb default '{}', primary_color text
);
alter table public.characters enable row level security;
create policy character_owner on public.characters for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.content_versions (
  content_id uuid, version integer, system_id_snapshot uuid not null,
  content_type_snapshot text not null, slug_snapshot text not null,
  name_snapshot text not null, scope_snapshot text not null, owner_id_snapshot uuid,
  primary key(content_id,version)
);
create table public.content_shares (content_id uuid, campaign_id uuid);
create table public.character_content_refs (
  id uuid primary key default gen_random_uuid(), character_id uuid not null references public.characters(id),
  content_id uuid not null, content_version integer not null, context jsonb,
  choice_source text, feature_grant_id uuid,
  foreign key(content_id,content_version) references public.content_versions(content_id,version)
);
create table public.character_feature_grants (
  id uuid primary key default gen_random_uuid(), character_id uuid,
  controller_ref_id uuid, controller_type text, controller_slug text,
  feature_slug text, feature_content_id uuid, feature_version integer, unlock_level integer
);
create table public.character_inventory (
  id uuid primary key default gen_random_uuid(), character_id uuid not null references public.characters(id),
  content_id uuid, content_version integer, name text not null, content_type text not null,
  quantity integer not null default 1 check(quantity >= 0), sort_order integer default 0,
  equipped boolean default false, attuned boolean default false, notes text, custom_data jsonb
);
alter table public.character_inventory enable row level security;
create policy inventory_owner on public.character_inventory for all to authenticated
using (exists(select 1 from public.characters c where c.id=character_id and c.user_id=auth.uid()))
with check (exists(select 1 from public.characters c where c.id=character_id and c.user_id=auth.uid()));
create table public.character_spells (
  id uuid primary key default gen_random_uuid(), character_id uuid, content_id uuid,
  content_version integer, name text, class_slug text, is_known boolean,
  is_prepared boolean, always_prepared boolean, in_spellbook boolean, source text, custom_data jsonb
);
create table public.character_dm_notes (character_id uuid primary key, content jsonb);
create table public.character_timeline_events (
  id uuid primary key default gen_random_uuid(), character_id uuid, created_by uuid,
  title text, date_label text, description jsonb, visibility text, sort_order integer
);
create table public.npcs (
  id uuid primary key default gen_random_uuid(), character_id uuid, created_by uuid,
  name text, description jsonb, relationship text, visibility text, portrait_url text, metadata jsonb
);
grant select,insert,update,delete on all tables in schema public to service_role;
grant select,insert,update,delete on public.characters,public.character_inventory to authenticated;
grant select on public.game_systems to authenticated;
-- Synthetic restrictive dependencies used by the real copy function. Campaign
-- membership and immutable-version access are represented; other baseline
-- guards/triggers still require the full disposable Supabase acceptance target.
create function private.can_assign_character_to_campaign(target uuid, system uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.campaigns c where c.id=target and c.system_id=system
    and (c.owner_id=auth.uid() or exists(select 1 from public.campaign_members m where m.campaign_id=c.id and m.user_id=auth.uid())));
$$;
create function private.can_use_content_version(target uuid, content uuid, revision integer)
returns boolean language sql stable as $$
  select exists(select 1 from public.characters c join public.content_versions v
    on v.content_id=content and v.version=revision and v.system_id_snapshot=c.system_id
    where c.id=target and c.user_id=auth.uid() and (v.scope_snapshot='platform' or v.owner_id_snapshot=auth.uid()
      or (v.scope_snapshot='shared' and exists(select 1 from public.content_shares s where s.content_id=content and s.campaign_id=c.campaign_id)
        and exists(select 1 from public.campaigns p where p.id=c.campaign_id
          and (p.owner_id=auth.uid() or exists(select 1 from public.campaign_members m where m.campaign_id=p.id and m.user_id=auth.uid()))))));
$$;
create function private.is_character_feature_grant_active(target uuid)
returns boolean language sql stable as $$ select exists(select 1 from public.character_feature_grants where id=target); $$;
`;
