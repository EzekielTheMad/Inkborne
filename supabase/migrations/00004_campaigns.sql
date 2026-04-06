create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.game_systems(id),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text not null default '',
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create table public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('dm', 'player')),
  joined_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

alter table public.campaign_members enable row level security;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  system_id uuid not null references public.game_systems(id),
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  visibility text not null default 'private' check (visibility in ('private', 'campaign', 'public')),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;
