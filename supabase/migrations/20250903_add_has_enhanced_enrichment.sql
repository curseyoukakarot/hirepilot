-- Add boolean flag to unlock enhanced enrichment details on leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS has_enhanced_enrichment BOOLEAN DEFAULT FALSE;

-- Helpful index for filtering
CREATE INDEX IF NOT EXISTS idx_leads_has_enhanced_enrichment ON leads(has_enhanced_enrichment);

