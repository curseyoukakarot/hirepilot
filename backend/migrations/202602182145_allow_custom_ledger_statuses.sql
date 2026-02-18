DO $$
DECLARE
  status_constraint_name text;
BEGIN
  SELECT c.conname
  INTO status_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'ignite_ledger_transactions'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '% in %'
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.ignite_ledger_transactions DROP CONSTRAINT IF EXISTS %I',
      status_constraint_name
    );
  END IF;
END
$$;

ALTER TABLE public.ignite_ledger_transactions
  DROP CONSTRAINT IF EXISTS ignite_ledger_transactions_status_not_blank_check,
  ADD CONSTRAINT ignite_ledger_transactions_status_not_blank_check
  CHECK (char_length(trim(status)) > 0);
