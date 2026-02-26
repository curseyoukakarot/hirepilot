-- task_email_events: lightweight dedupe for task notification emails
-- Prevents duplicate sends on rapid updates (5-min window per task/event/recipient)

begin;

create table if not exists public.task_email_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null check (event_type in ('assigned', 'comment', 'completed')),
  recipient_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_email_events_task_id on public.task_email_events(task_id);
create index if not exists idx_task_email_events_created_at on public.task_email_events(created_at);

-- Unique constraint: one email per task/event/recipient per minute (UTC)
-- Use AT TIME ZONE 'UTC' so the expression is immutable for indexing
create unique index if not exists idx_task_email_events_dedupe
  on public.task_email_events (task_id, event_type, recipient_email, date_trunc('minute', created_at AT TIME ZONE 'UTC'));

-- RLS: service role only (backend inserts, no user access)
alter table public.task_email_events enable row level security;

-- No policies: table is backend-only, service role bypasses RLS
-- If needed for debugging, add a policy for super_admins

commit;
