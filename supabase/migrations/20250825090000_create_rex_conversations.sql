-- Conversations (per user)
create table if not exists rex_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages
create table if not exists rex_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references rex_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists t_rex_conversations_touch on rex_conversations;
create trigger t_rex_conversations_touch
before update on rex_conversations
for each row execute function touch_updated_at();

-- Fast list queries
create index if not exists idx_rex_conversations_user_updated
  on rex_conversations (user_id, updated_at desc)
  where archived = false;

create index if not exists idx_rex_messages_conv_created
  on rex_messages (conversation_id, created_at);

-- RLS
alter table rex_conversations enable row level security;
alter table rex_messages enable row level security;

create policy "own convs" on rex_conversations
for select using (auth.uid() = user_id);
create policy "insert own conv" on rex_conversations
for insert with check (auth.uid() = user_id);
create policy "update own conv" on rex_conversations
for update using (auth.uid() = user_id);

create policy "own msgs" on rex_messages
for select using (auth.uid() = user_id);
create policy "insert own msg" on rex_messages
for insert with check (auth.uid() = user_id);


