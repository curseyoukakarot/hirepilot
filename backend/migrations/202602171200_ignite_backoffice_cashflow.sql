-- Ignite Backoffice cashflow schema (ledger/accounts/allocations/imports/settings)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.ignite_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ignite_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('operating', 'savings', 'credit')),
  current_balance_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  last_synced_at timestamptz NULL,
  sync_source text NOT NULL DEFAULT 'manual' CHECK (sync_source IN ('manual', 'zapier', 'quickbooks')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ignite_accounts_type_name_unique_idx
  ON public.ignite_accounts (type, name);

CREATE TABLE IF NOT EXISTS public.ignite_event_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL DEFAULT '',
  event_name text NOT NULL DEFAULT '',
  event_date date NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  funding_received_cents bigint NOT NULL DEFAULT 0,
  costs_paid_to_date_cents bigint NOT NULL DEFAULT 0,
  forecast_costs_remaining_cents bigint NOT NULL DEFAULT 0,
  expected_margin_cents bigint NOT NULL DEFAULT 0,
  held_amount_cents bigint NOT NULL DEFAULT 0,
  auto_hold_mode boolean NOT NULL DEFAULT true,
  linked_proposal_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ignite_event_allocations_status_idx
  ON public.ignite_event_allocations (status);

CREATE TABLE IF NOT EXISTS public.ignite_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('invoice', 'payment', 'expense', 'transfer', 'adjustment')),
  status text NOT NULL DEFAULT 'na' CHECK (status IN ('sent', 'past_due', 'paid', 'hold', 'na')),
  account_id uuid NOT NULL REFERENCES public.ignite_accounts(id) ON DELETE RESTRICT,
  inbound_cents bigint NOT NULL DEFAULT 0,
  outbound_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint GENERATED ALWAYS AS (COALESCE(inbound_cents, 0) - COALESCE(outbound_cents, 0)) STORED,
  event_allocation_id uuid NULL REFERENCES public.ignite_event_allocations(id) ON DELETE SET NULL,
  notes text NULL,
  transfer_group_id uuid NULL,
  sort_order integer NULL,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ignite_ledger_transactions_date_created_idx
  ON public.ignite_ledger_transactions (date, created_at);

CREATE INDEX IF NOT EXISTS ignite_ledger_transactions_account_id_idx
  ON public.ignite_ledger_transactions (account_id);

CREATE INDEX IF NOT EXISTS ignite_ledger_transactions_event_allocation_id_idx
  ON public.ignite_ledger_transactions (event_allocation_id);

CREATE INDEX IF NOT EXISTS ignite_ledger_transactions_status_idx
  ON public.ignite_ledger_transactions (status);

CREATE INDEX IF NOT EXISTS ignite_ledger_transactions_ordering_idx
  ON public.ignite_ledger_transactions (date, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.ignite_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL DEFAULT '',
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  rows_total integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ignite_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ignite_import_batches(id) ON DELETE CASCADE,
  ledger_transaction_id uuid NULL REFERENCES public.ignite_ledger_transactions(id) ON DELETE SET NULL,
  row_index integer NULL,
  source_row_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ignite_import_rows_batch_id_idx
  ON public.ignite_import_rows (batch_id);

CREATE INDEX IF NOT EXISTS ignite_import_rows_ledger_transaction_id_idx
  ON public.ignite_import_rows (ledger_transaction_id);

CREATE TABLE IF NOT EXISTS public.ignite_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safe_threshold_cents bigint NOT NULL DEFAULT 5000000,
  warning_threshold_cents bigint NOT NULL DEFAULT 1000000,
  danger_threshold_cents bigint NOT NULL DEFAULT 900000,
  use_net_cash boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ignite_settings (safe_threshold_cents, warning_threshold_cents, danger_threshold_cents, use_net_cash)
SELECT 5000000, 1000000, 900000, true
WHERE NOT EXISTS (SELECT 1 FROM public.ignite_settings);

DROP TRIGGER IF EXISTS ignite_accounts_touch_updated_at ON public.ignite_accounts;
CREATE TRIGGER ignite_accounts_touch_updated_at
BEFORE UPDATE ON public.ignite_accounts
FOR EACH ROW EXECUTE FUNCTION public.ignite_touch_updated_at();

DROP TRIGGER IF EXISTS ignite_event_allocations_touch_updated_at ON public.ignite_event_allocations;
CREATE TRIGGER ignite_event_allocations_touch_updated_at
BEFORE UPDATE ON public.ignite_event_allocations
FOR EACH ROW EXECUTE FUNCTION public.ignite_touch_updated_at();

DROP TRIGGER IF EXISTS ignite_ledger_transactions_touch_updated_at ON public.ignite_ledger_transactions;
CREATE TRIGGER ignite_ledger_transactions_touch_updated_at
BEFORE UPDATE ON public.ignite_ledger_transactions
FOR EACH ROW EXECUTE FUNCTION public.ignite_touch_updated_at();

DROP TRIGGER IF EXISTS ignite_settings_touch_updated_at ON public.ignite_settings;
CREATE TRIGGER ignite_settings_touch_updated_at
BEFORE UPDATE ON public.ignite_settings
FOR EACH ROW EXECUTE FUNCTION public.ignite_touch_updated_at();

CREATE OR REPLACE FUNCTION public.ignite_backoffice_role_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('ignite_admin', 'ignite_team'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('ignite_admin', 'ignite_team'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'account_type') IN ('ignite_admin', 'ignite_team'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('ignite_admin', 'ignite_team'),
    false
  );
$$;

DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'ignite_accounts',
      'ignite_event_allocations',
      'ignite_ledger_transactions',
      'ignite_import_batches',
      'ignite_import_rows',
      'ignite_settings'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    policy_name := tbl || '_ignite_backoffice_access';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.ignite_backoffice_role_allowed()) WITH CHECK (public.ignite_backoffice_role_allowed());',
      policy_name, tbl
    );
  END LOOP;
END
$$;
