-- Enrichment Jobs Queue Table
-- This table manages background enrichment jobs for leads

CREATE TABLE IF NOT EXISTS enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,
    user_id UUID NOT NULL,
    profile_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 5, -- 1-10, higher number = higher priority
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    enrichment_source TEXT, -- Which service successfully enriched (decodo, hunter, skrapp, apollo)
    enrichment_data JSONB, -- Store the enriched data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_user_id ON enrichment_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_lead_id ON enrichment_jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_created_at ON enrichment_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_priority_status ON enrichment_jobs(priority DESC, status, created_at);

-- Add foreign key constraints (assuming leads and users tables exist)
-- ALTER TABLE enrichment_jobs ADD CONSTRAINT fk_enrichment_jobs_lead_id 
--     FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
-- ALTER TABLE enrichment_jobs ADD CONSTRAINT fk_enrichment_jobs_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrichment_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_enrichment_jobs_updated_at
    BEFORE UPDATE ON enrichment_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_enrichment_jobs_updated_at();

-- Add credit fields to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS scraping_credits INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrichment_credits INTEGER DEFAULT 0;

-- Create indexes for credit fields
CREATE INDEX IF NOT EXISTS idx_users_scraping_credits ON users(scraping_credits);
CREATE INDEX IF NOT EXISTS idx_users_enrichment_credits ON users(enrichment_credits); 