BEGIN;

-- Ensure leads table has campaign_id column
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- Add enriched_at column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_enriched_at ON leads(enriched_at);

-- Create view for campaign leads count
CREATE OR REPLACE VIEW campaign_leads_count AS
SELECT 
    c.id as campaign_id,
    COUNT(l.id) as total_leads,
    COUNT(CASE WHEN l.enriched_at IS NOT NULL THEN 1 END) as enriched_leads
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.id
GROUP BY c.id;

COMMIT; 