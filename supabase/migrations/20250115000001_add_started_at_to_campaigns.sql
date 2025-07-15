-- Add started_at column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_started_at ON campaigns(started_at);

-- Add comment to document the column
COMMENT ON COLUMN campaigns.started_at IS 'Timestamp when the campaign was started/launched'; 