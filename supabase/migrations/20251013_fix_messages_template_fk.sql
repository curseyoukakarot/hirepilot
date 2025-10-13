-- Align messages.template_id to reference email_templates(id) instead of legacy templates(id)
begin;

-- 1) Ensure legacy templates are mirrored into email_templates (idempotent)
insert into email_templates (id, user_id, name, subject, content, created_at, updated_at)
select t.id, t.user_id, coalesce(t.name, 'Untitled'), null::text as subject, t.content, t.created_at, t.updated_at
from templates t
where not exists (
  select 1 from email_templates e where e.id = t.id
);

-- 2) Point FK to email_templates
do $$ begin
  if exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='messages' and constraint_name='messages_template_id_fkey'
  ) then
    begin
      alter table public.messages drop constraint messages_template_id_fkey;
    exception when others then null; end;
  end if;
end $$;

alter table public.messages
  add constraint messages_template_id_fkey foreign key (template_id) references public.email_templates(id) on delete set null;

commit;


