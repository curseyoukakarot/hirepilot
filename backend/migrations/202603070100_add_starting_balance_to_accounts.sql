-- Add starting_balance_cents to ignite_accounts for the hybrid ledger-sync model.
-- current_balance_cents = starting_balance_cents + SUM(net_cents) of paid ledger transactions.
-- When a user manually overrides the balance on the Accounts page, starting_balance_cents
-- is adjusted so that starting + ledger_sum = desired balance.

ALTER TABLE public.ignite_accounts
  ADD COLUMN IF NOT EXISTS starting_balance_cents bigint NOT NULL DEFAULT 0;

-- Back-fill: set starting_balance_cents so that existing balances are preserved.
-- starting_balance_cents = current_balance_cents - (sum of paid ledger net_cents for that account)
UPDATE public.ignite_accounts a
SET starting_balance_cents = a.current_balance_cents - COALESCE(
  (SELECT SUM(t.net_cents)
   FROM public.ignite_ledger_transactions t
   WHERE t.account_id = a.id AND t.status = 'paid'),
  0
);
