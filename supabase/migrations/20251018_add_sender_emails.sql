-- Add missing sender_emails column for campaign_configs used by sender behavior "specific"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_configs'
      AND column_name = 'sender_emails'
  ) THEN
    ALTER TABLE public.campaign_configs
      ADD COLUMN sender_emails text[] NULL;
  END IF;
END $$;

-- Optional: keep existing null default; no data backfill needed

