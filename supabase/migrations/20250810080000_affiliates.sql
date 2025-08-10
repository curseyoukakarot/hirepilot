-- affiliates
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  referral_code text not null unique,
  stripe_connect_id text,
  tier text not null default 'starter',
  joined_at timestamptz not null default now(),
  constraint fk_aff_user foreign key (user_id) references auth.users(id) on delete cascade
);

-- clicks (optional analytics)
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  url text,
  utm jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.affiliate_clicks (referral_code, created_at);

-- referrals (a person/company attributed to affiliate)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  lead_email text,
  customer_id text,          -- internal customer id if exists
  stripe_customer_id text,
  plan_type text check (plan_type in ('DIY','DFY')),
  status text not null default 'lead', -- lead|trial|active|cancelled
  first_attributed_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);
create index on public.referrals (affiliate_id);
create index on public.referrals (stripe_customer_id);

-- commissions (payables computed from events)
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  type text not null check (type in ('DIY_ONE_TIME','DFY_RECUR')),
  plan_code text,            -- e.g., diy_starter, diy_pro, diy_team
  period_month date,         -- for DFY recurring months
  amount_cents int not null,
  status text not null default 'pending', -- pending|locked|paid|void
  locked_at timestamptz,
  paid_at timestamptz,
  source_event text,         -- stripe event id
  created_at timestamptz not null default now()
);
create index on public.commissions (affiliate_id, status);
create index on public.commissions (period_month);

-- payouts (batched transfers)
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  total_cents int not null,
  method text not null default 'stripe_connect',
  period_start date not null,
  period_end date not null,
  status text not null default 'initiated', -- initiated|paid|failed
  transfer_id text,         -- Stripe transfer id
  receipt_url text,
  created_at timestamptz not null default now()
);
create index on public.payouts (affiliate_id, status);

-- partner tiers (configurable)
create table if not exists public.partner_tiers (
  key text primary key,            -- starter, pro, elite, legend
  min_referrals int not null,
  perks jsonb not null             -- e.g., {"free_months":2}
);

-- Minimal RLS (adjust as needed)
alter table public.affiliates enable row level security;
create policy "affiliates self" on public.affiliates
  for select using (auth.uid() = user_id);
create policy "affiliates insert self" on public.affiliates
  for insert with check (auth.uid() = user_id);

alter table public.referrals enable row level security;
create policy "referrals by affiliate" on public.referrals
  for select using (exists(
    select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()
  ));

alter table public.commissions enable row level security;
create policy "commissions by affiliate" on public.commissions
  for select using (exists(
    select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()
  ));

alter table public.payouts enable row level security;
create policy "payouts by affiliate" on public.payouts
  for select using (exists(
    select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()
  ));


