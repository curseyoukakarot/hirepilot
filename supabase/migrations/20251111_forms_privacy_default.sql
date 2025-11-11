-- Ensure forms created are private by default
alter table public.forms alter column is_public set default false;


