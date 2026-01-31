create table if not exists public.kanban_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.kanban_cards(id) on delete cascade,
  body text not null,
  is_completed boolean default false,
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_kanban_checklist_card on public.kanban_checklist_items(card_id);
create index if not exists idx_kanban_checklist_position on public.kanban_checklist_items(card_id, position);

drop trigger if exists trg_kanban_checklist_updated_at on public.kanban_checklist_items;
create trigger trg_kanban_checklist_updated_at
before update on public.kanban_checklist_items
for each row execute procedure public.set_updated_at();

alter table public.kanban_checklist_items enable row level security;

drop policy if exists kanban_checklist_select on public.kanban_checklist_items;
create policy kanban_checklist_select
on public.kanban_checklist_items
for select
using (
  exists (
    select 1
    from public.kanban_cards c
    where c.id = kanban_checklist_items.card_id
      and public.kanban_is_board_member(c.board_id)
  )
);

drop policy if exists kanban_checklist_insert on public.kanban_checklist_items;
create policy kanban_checklist_insert
on public.kanban_checklist_items
for insert
with check (
  exists (
    select 1
    from public.kanban_cards c
    where c.id = kanban_checklist_items.card_id
      and public.kanban_board_role(c.board_id) in ('owner', 'admin', 'editor')
  )
);

drop policy if exists kanban_checklist_update on public.kanban_checklist_items;
create policy kanban_checklist_update
on public.kanban_checklist_items
for update
using (
  exists (
    select 1
    from public.kanban_cards c
    where c.id = kanban_checklist_items.card_id
      and public.kanban_board_role(c.board_id) in ('owner', 'admin', 'editor')
  )
)
with check (
  exists (
    select 1
    from public.kanban_cards c
    where c.id = kanban_checklist_items.card_id
      and public.kanban_board_role(c.board_id) in ('owner', 'admin', 'editor')
  )
);

drop policy if exists kanban_checklist_delete on public.kanban_checklist_items;
create policy kanban_checklist_delete
on public.kanban_checklist_items
for delete
using (
  exists (
    select 1
    from public.kanban_cards c
    where c.id = kanban_checklist_items.card_id
      and public.kanban_board_role(c.board_id) in ('owner', 'admin', 'editor')
  )
);
