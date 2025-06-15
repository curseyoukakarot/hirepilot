BEGIN;

-- Add missing columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS job_description TEXT,
ADD COLUMN IF NOT EXISTS lead_source_type TEXT CHECK (lead_source_type IN ('linkedin', 'apollo', 'csv')),
ADD COLUMN IF NOT EXISTS keywords TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update status check constraint
DO $$ 
BEGIN
  ALTER TABLE campaigns 
    DROP CONSTRAINT IF EXISTS campaigns_status_check;
  
  ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check 
    CHECK (status IN ('draft', 'enriching', 'active', 'paused', 'completed', 'failed'));
END $$;

COMMIT; 