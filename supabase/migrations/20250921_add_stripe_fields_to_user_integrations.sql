-- Add Stripe fields to user_integrations if not present
do $$ begin
  alter table if exists public.user_integrations
    add column if not exists stripe_secret_key text,
    add column if not exists stripe_publishable_key text,
    add column if not exists stripe_connected_account_id text;
exception when others then
  raise notice 'Skipping, table missing or columns exist';
end $$;


