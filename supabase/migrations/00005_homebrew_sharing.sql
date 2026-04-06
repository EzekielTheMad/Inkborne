create table public.custom_content_types (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id),
  owner_id uuid not null references public.profiles(id),
  slug text not null,
  name text not null,
  description text not null default '',
  allow_multiple boolean not null default false,
  entry_conditions jsonb not null default '[]',
  has_progression boolean not null default false,
  scope text not null default 'personal' check (scope in ('personal', 'shared')),
  version integer not null default 1,
  unique(system_id, slug, owner_id)
);

alter table public.custom_content_types enable row level security;

create table public.content_shares (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  shared_at timestamptz not null default now(),
  unique(content_id, campaign_id)
);

alter table public.content_shares enable row level security;

create table public.content_type_shares (
  id uuid primary key default gen_random_uuid(),
  content_type_id uuid not null references public.custom_content_types(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  shared_by uuid not null references public.profiles(id),
  shared_at timestamptz not null default now(),
  unique(content_type_id, campaign_id)
);

alter table public.content_type_shares enable row level security;
