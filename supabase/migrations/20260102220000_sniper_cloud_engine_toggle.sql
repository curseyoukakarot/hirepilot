-- Sniper v1: Cloud Engine toggle + provider mode
-- OFF => extension-only (no cloud execution)
-- ON  => Airtop cloud execution

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='sniper_settings'
  ) then
    begin
      alter table public.sniper_settings
        add column if not exists cloud_engine_enabled boolean not null default false,
        add column if not exists provider text not null default 'extension_only'
          check (provider in ('airtop','extension_only'));
    exception when others then
      null;
    end;

    -- helpful index for workspace lookups
    begin
      execute 'create index if not exists idx_sniper_settings_workspace on public.sniper_settings(workspace_id)';
    exception when others then
      null;
    end;
  end if;
end $$;


