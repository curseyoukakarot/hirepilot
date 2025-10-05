-- Add enrichment_source (skrapp|apollo) preference to user_integrations
ALTER TABLE user_integrations
ADD COLUMN IF NOT EXISTS enrichment_source TEXT CHECK (enrichment_source IN ('skrapp','apollo')) DEFAULT 'apollo';

-- Optional: index for quick reads
CREATE INDEX IF NOT EXISTS idx_user_integrations_enrichment_source ON user_integrations(enrichment_source);


