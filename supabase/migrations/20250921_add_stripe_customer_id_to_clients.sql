-- Add Stripe customer id to clients for invoicing
do $$ begin
  alter table if exists public.clients
    add column if not exists stripe_customer_id text;
exception when others then
  raise notice 'Skipping clients alteration';
end $$;


