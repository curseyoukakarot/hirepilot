-- Add response_strategy to sales agent settings (idempotent)
do
$$
begin
  -- Ensure table exists
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' and table_name = 'sales_agent_settings'
  ) then
    create table public.sales_agent_settings (
      user_id uuid primary key,
      response_strategy jsonb null,
      updated_at timestamptz default now()
    );
  end if;

  -- Add column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'sales_agent_settings' and column_name = 'response_strategy'
  ) then
    alter table public.sales_agent_settings add column response_strategy jsonb null;
  end if;
end
$$;

comment on column public.sales_agent_settings.response_strategy is
'JSON strategy: { tone, priority, instructions }';


