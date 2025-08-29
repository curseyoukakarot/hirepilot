-- Add provider column to sequence_enrollments to control which email channel a sequence uses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sequence_enrollments'
      AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD COLUMN provider text;
  END IF;
END$$;

-- Optional helpful index when querying by provider
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_provider
  ON public.sequence_enrollments(provider);


