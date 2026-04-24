-- App error capture for alpha. Self-hosted alternative to Sentry / external
-- monitoring.
--
-- Writes come from:
--   - Client: window "error" + "unhandledrejection" listeners, React error
--     boundary, and manual reporter calls (all go through the auth'd client,
--     RLS enforces user_id = auth.uid())
--   - Server: reportServerError() helper uses the service-role client and can
--     record errors with NULL user_id (e.g. pre-auth failures)
--
-- Reads come from /admin/errors (service-role client, gated by
-- isAdminUserId() env-var check — no RLS policy grants cross-user reads).

create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in (
    'client_unhandled',
    'client_rejection',
    'client_boundary',
    'server_action',
    'server_route',
    'manual'
  )),
  message text not null check (length(message) > 0),
  stack text,
  page_url text,
  user_agent text,
  context jsonb,
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved', 'wontfix', 'duplicate')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create index idx_app_errors_user_id on public.app_errors(user_id);
create index idx_app_errors_status on public.app_errors(status);
create index idx_app_errors_source on public.app_errors(source);
create index idx_app_errors_created_at on public.app_errors(created_at desc);

alter table public.app_errors enable row level security;

-- Authenticated users can log their own errors. user_id must match auth.uid().
create policy "Users log own errors"
  on public.app_errors for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can read their own error history (not exposed in UI today, but useful
-- if we ever add a "your reported errors" view).
create policy "Users read own errors"
  on public.app_errors for select
  to authenticated
  using (user_id = auth.uid());

-- No UPDATE / DELETE for authenticated users. Status transitions and
-- admin_notes are admin-only via service-role client.

grant insert, select on public.app_errors to authenticated;
