-- Add enriched_leads column to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS enriched_leads INTEGER DEFAULT 0;

-- Add total_leads column to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_enriched_leads ON campaigns(enriched_leads);
CREATE INDEX IF NOT EXISTS idx_campaigns_total_leads ON campaigns(total_leads); 