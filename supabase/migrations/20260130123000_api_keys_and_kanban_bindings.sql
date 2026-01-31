-- API keys + Kanban bindings/invites

create extension if not exists "pgcrypto";

-- Ensure kanban_member_role includes admin
do $$ begin
  if exists (select 1 from pg_type where typname = 'kanban_member_role') then
    begin
      alter type kanban_member_role add value if not exists 'admin';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- API keys table (if missing) and scope support
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  key text not null,
  environment text,
  scopes text[] default array['kanban:read','kanban:write','webhooks:manage']::text[],
  is_active boolean default true,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

alter table public.api_keys add column if not exists scopes text[] default array['kanban:read','kanban:write','webhooks:manage']::text[];
alter table public.api_keys add column if not exists is_active boolean default true;
alter table public.api_keys add column if not exists last_used_at timestamptz;
alter table public.api_keys add column if not exists environment text;

create unique index if not exists uq_api_keys_key on public.api_keys(key);
create index if not exists idx_api_keys_user_id on public.api_keys(user_id);

-- Kanban bindings
create table if not exists public.kanban_bindings (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.kanban_boards(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  mode text default 'mirror',
  group_by text,
  column_map jsonb default '{}'::jsonb,
  sync_direction text default 'bidirectional',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_synced_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_kanban_bindings_board on public.kanban_bindings(board_id);
create index if not exists idx_kanban_bindings_target on public.kanban_bindings(target_type, target_id);

drop trigger if exists trg_kanban_bindings_updated_at on public.kanban_bindings;
create trigger trg_kanban_bindings_updated_at
before update on public.kanban_bindings
for each row execute procedure public.set_updated_at();

-- Kanban invites
do $$ begin
  if not exists (select 1 from pg_type where typname = 'kanban_invite_status') then
    create type kanban_invite_status as enum ('pending', 'accepted', 'revoked');
  end if;
end $$;

create table if not exists public.kanban_board_invites (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.kanban_boards(id) on delete cascade,
  email text not null,
  role kanban_member_role not null default 'viewer',
  status kanban_invite_status not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  accepted_at timestamptz
);

create index if not exists idx_kanban_invites_board on public.kanban_board_invites(board_id);
create index if not exists idx_kanban_invites_email on public.kanban_board_invites(email);
