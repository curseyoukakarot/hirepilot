-- Add campaign-level kill switch for auto outreach
-- Idempotent for repeated deploys

ALTER TABLE campaign_configs
  ADD COLUMN IF NOT EXISTS auto_outreach_enabled BOOLEAN DEFAULT TRUE;

-- Backfill nulls to true (safe default: preserve existing behavior)
UPDATE campaign_configs
SET auto_outreach_enabled = TRUE
WHERE auto_outreach_enabled IS NULL;

