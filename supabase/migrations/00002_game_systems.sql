create table public.game_systems (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  version_label text not null default '',
  schema_definition jsonb not null default '{}',
  expression_context jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

alter table public.game_systems enable row level security;
