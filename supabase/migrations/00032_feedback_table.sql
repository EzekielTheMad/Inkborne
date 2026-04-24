-- Alpha feedback table. Authenticated users INSERT their own feedback via the
-- in-app widget. Each user SELECTs only their own rows. Admin access (list all,
-- update status) is handled server-side via a service-role client gated by the
-- ADMIN_USER_IDS env var — no RLS policy grants cross-user reads.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag text check (tag is null or tag in ('bug', 'feature', 'question', 'other')),
  text text not null check (length(text) > 0),
  page_url text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved', 'wontfix')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create index idx_feedback_user_id on public.feedback(user_id);
create index idx_feedback_status on public.feedback(status);
create index idx_feedback_created_at on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Authenticated users insert their own feedback.
create policy "Users insert own feedback"
  on public.feedback for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users read their own feedback (to confirm submission, see their own history).
create policy "Users read own feedback"
  on public.feedback for select
  to authenticated
  using (user_id = auth.uid());

-- No UPDATE or DELETE policy for authenticated users — status transitions and
-- admin_notes are admin-only, performed via service-role client in the
-- /admin/feedback route, which checks the user ID against ADMIN_USER_IDS.

grant insert, select on public.feedback to authenticated;
