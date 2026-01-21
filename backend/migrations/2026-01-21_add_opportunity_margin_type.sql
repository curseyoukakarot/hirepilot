alter table public.opportunities
  add column if not exists margin_type text;

update public.opportunities
  set margin_type = 'currency'
  where margin_type is null;

alter table public.opportunities
  alter column margin_type set default 'currency';
