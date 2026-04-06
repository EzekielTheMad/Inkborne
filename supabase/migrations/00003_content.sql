create table public.content_definitions (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id) on delete cascade,
  content_type text not null,
  slug text not null,
  name text not null,
  data jsonb not null default '{}',
  effects jsonb not null default '[]',
  source text not null default 'homebrew' check (source in ('srd', 'homebrew')),
  scope text not null default 'personal' check (scope in ('platform', 'personal', 'shared')),
  owner_id uuid references public.profiles(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique(system_id, content_type, slug, owner_id)
);

alter table public.content_definitions enable row level security;

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_definitions(id) on delete cascade,
  version integer not null,
  data_snapshot jsonb not null,
  effects_snapshot jsonb not null default '[]',
  changelog text not null default '',
  created_at timestamptz not null default now(),
  unique(content_id, version)
);

alter table public.content_versions enable row level security;
