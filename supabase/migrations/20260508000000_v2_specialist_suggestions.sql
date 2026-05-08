-- v2 — Specialist Suggestions
--
-- Table backing the HireCatalog "Suggest a specialist" modal. When a user
-- proposes a new agent specialist (a role we haven't built yet), we capture
-- it here so product can review the demand signal and prioritise.
--
-- Multi-tenant: stamped with workspace_id + user_id for context, but no
-- per-row RLS — only super-admins read this table from the admin panel.

create table if not exists public.specialist_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  suggestion text not null,
  context jsonb default '{}'::jsonb,
  status text not null default 'new',  -- new | reviewed | building | shipped | rejected
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text
);

create index if not exists idx_specialist_suggestions_workspace
  on public.specialist_suggestions(workspace_id);
create index if not exists idx_specialist_suggestions_status
  on public.specialist_suggestions(status);
create index if not exists idx_specialist_suggestions_created
  on public.specialist_suggestions(created_at desc);

-- Service-role-only by default; super-admin endpoints can bypass via the
-- supabaseDb client used in routes/v2/specialistSuggestions.ts.
alter table public.specialist_suggestions enable row level security;

drop policy if exists "specialist_suggestions_insert_authenticated"
  on public.specialist_suggestions;
create policy "specialist_suggestions_insert_authenticated"
  on public.specialist_suggestions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Read access via service role only (super-admin panel) — no select policy
-- for authenticated.
