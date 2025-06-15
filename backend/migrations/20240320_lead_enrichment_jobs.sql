-- Create lead enrichment jobs table
CREATE TABLE lead_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  user_id UUID REFERENCES users(id),
  apollo_ids TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error TEXT,
  progress INTEGER CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_enrichment_jobs_campaign ON lead_enrichment_jobs(campaign_id);
CREATE INDEX idx_enrichment_jobs_user ON lead_enrichment_jobs(user_id);
CREATE INDEX idx_enrichment_jobs_status ON lead_enrichment_jobs(status);

-- Add job_id reference to campaigns table
ALTER TABLE campaigns
ADD COLUMN enrichment_job_id UUID REFERENCES lead_enrichment_jobs(id);

-- Add function to update job timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to update timestamps
CREATE TRIGGER update_lead_enrichment_jobs_updated_at
  BEFORE UPDATE ON lead_enrichment_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 