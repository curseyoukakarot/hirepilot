begin;

create table if not exists public.ignite_docusign_envelopes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.ignite_proposals(id) on delete cascade,
  share_link_id uuid null references public.ignite_share_links(id) on delete set null,
  selected_option_id uuid null references public.ignite_proposal_options(id) on delete set null,
  envelope_id text not null,
  status text not null default 'created' check (
    status in ('created', 'sent', 'delivered', 'completed', 'declined', 'voided', 'error')
  ),
  recipient_name text null,
  recipient_email text null,
  recipient_title text null,
  agreement_payload_json jsonb not null default '{}'::jsonb,
  signer_payload_json jsonb not null default '{}'::jsonb,
  docusign_payload_json jsonb not null default '{}'::jsonb,
  sent_by uuid null references auth.users(id) on delete set null,
  sent_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ignite_docusign_envelopes_proposal
  on public.ignite_docusign_envelopes(proposal_id, created_at desc);
create index if not exists idx_ignite_docusign_envelopes_envelope_id
  on public.ignite_docusign_envelopes(envelope_id);
create index if not exists idx_ignite_docusign_envelopes_status
  on public.ignite_docusign_envelopes(status, created_at desc);

drop trigger if exists trg_ignite_docusign_envelopes_updated_at on public.ignite_docusign_envelopes;
create trigger trg_ignite_docusign_envelopes_updated_at
before update on public.ignite_docusign_envelopes
for each row execute procedure public.set_updated_at();

alter table public.ignite_docusign_envelopes enable row level security;

drop policy if exists ignite_docusign_envelopes_select on public.ignite_docusign_envelopes;
create policy ignite_docusign_envelopes_select on public.ignite_docusign_envelopes
  for select using (public.ignite_can_access_proposal(proposal_id));

drop policy if exists ignite_docusign_envelopes_team_write on public.ignite_docusign_envelopes;
create policy ignite_docusign_envelopes_team_write on public.ignite_docusign_envelopes
  for all
  using (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  )
  with check (
    public.ignite_is_team_member()
    and public.ignite_can_access_proposal(proposal_id)
  );

commit;
