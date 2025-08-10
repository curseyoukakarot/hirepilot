-- Partner tiers default rows
insert into public.partner_tiers(key, min_referrals, perks) values
  ('starter', 0, '{"free_months":0}'::jsonb)
on conflict (key) do nothing;

insert into public.partner_tiers(key, min_referrals, perks) values
  ('pro', 3, '{"free_months":0}'::jsonb),
  ('elite', 10, '{"free_months":0}'::jsonb),
  ('legend', 25, '{"free_months":0}'::jsonb)
on conflict (key) do nothing;

-- RPCs for overview
create or replace function public.sum_commissions_cents(p_affiliate_id uuid, p_status text)
returns table(sum bigint)
language sql
stable
as $$
  select coalesce(sum(amount_cents),0)::bigint from public.commissions
  where affiliate_id = p_affiliate_id and status = p_status;
$$;

create or replace function public.sum_commissions_cents_month(p_affiliate_id uuid)
returns table(sum bigint)
language sql
stable
as $$
  select coalesce(sum(amount_cents),0)::bigint from public.commissions
  where affiliate_id = p_affiliate_id
    and date_trunc('month', created_at) = date_trunc('month', now())
    and status in ('locked','paid');
$$;

create or replace function public.next_payout_cents(p_affiliate_id uuid)
returns table(sum bigint)
language sql
stable
as $$
  select coalesce(sum(amount_cents),0)::bigint from public.commissions
  where affiliate_id = p_affiliate_id and status = 'locked';
$$;


