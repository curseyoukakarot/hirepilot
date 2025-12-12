-- Resume drafts to power resume wizard + builder prefill
create table if not exists public.job_resume_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_file_url text not null,
  linkedin_file_url text,
  resume_text text,
  linkedin_text text,
  target_role text,
  primary_title text,
  focus_keywords text[] default '{}'::text[],
  skills text[] default '{}'::text[],
  generated_resume_json jsonb,
  status text not null default 'uploaded' check (status in (
    'uploaded',
    'extracting',
    'ready_to_generate',
    'generating',
    'ready',
    'error'
  )),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create trigger job_resume_drafts_set_updated_at
before update on public.job_resume_drafts
for each row execute function update_updated_at_column();

comment on table public.job_resume_drafts is 'Resume drafts for wizard + builder prefill';

alter table public.job_resume_drafts enable row level security;

-- Allow owners to manage their own drafts
create policy "job_resume_drafts_select_own" on public.job_resume_drafts
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

create policy "job_resume_drafts_insert_own" on public.job_resume_drafts
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "job_resume_drafts_update_own" on public.job_resume_drafts
for update
using (auth.uid() = user_id or auth.role() = 'service_role')
with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy "job_resume_drafts_delete_own" on public.job_resume_drafts
for delete
using (auth.uid() = user_id or auth.role() = 'service_role');

