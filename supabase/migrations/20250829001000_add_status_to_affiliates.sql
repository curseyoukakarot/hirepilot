-- Add status column to affiliates to allow disabling access to partner dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'affiliates'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.affiliates
      ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END$$;

-- Optional index for status filtering
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);


