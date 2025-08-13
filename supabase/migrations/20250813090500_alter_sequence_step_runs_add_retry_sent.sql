-- Add retry_count and sent_at to sequence_step_runs if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='sequence_step_runs' AND column_name='retry_count'
  ) THEN
    ALTER TABLE public.sequence_step_runs ADD COLUMN retry_count int NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='sequence_step_runs' AND column_name='sent_at'
  ) THEN
    ALTER TABLE public.sequence_step_runs ADD COLUMN sent_at timestamptz;
  END IF;
END$$;


