-- Remove deprecated Sniper experiment tables (no longer used)

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='zoominfo_enrichment_settings') then
    execute 'drop table public.zoominfo_enrichment_settings';
  end if;
exception when others then
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='zoominfo_company_cache') then
    execute 'drop table public.zoominfo_company_cache';
  end if;
exception when others then
end $$;


