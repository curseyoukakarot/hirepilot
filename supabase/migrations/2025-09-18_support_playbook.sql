create table if not exists public.support_playbook (
  id uuid primary key default uuid_generate_v4(),
  tag text not null, -- e.g., campaign, pipeline, linkedin, collaboration, enrichment
  title text,
  suggestion text not null,
  weight int default 1,
  created_at timestamptz default now()
);

create index if not exists idx_support_playbook_tag on public.support_playbook(tag);

-- Seed a few core suggestions
insert into public.support_playbook (tag, title, suggestion, weight) values
('campaign', 'Compare channels', 'Link multiple campaigns to the same Job REQ to compare Apollo vs LinkedIn performance side by side.', 2),
('pipeline', 'Keep stages fresh', 'Drag candidates across stages weekly and use notes to capture feedback so staleness is obvious.', 1),
('linkedin', '3-step sequence', 'Try a 3-step LinkedIn + email follow-up for passive candidates to boost replies.', 1),
('collaboration', 'Invite hiring manager', 'Invite your hiring manager as a guest collaborator so they can leave feedback directly on candidates.', 2),
('enrichment', 'Credit-savvy enrichment', 'Batch enrich just the top candidates first to keep credit usage tight, then expand.', 1)
on conflict do nothing;


