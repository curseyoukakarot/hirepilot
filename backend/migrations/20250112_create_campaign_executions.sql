-- Create campaign_executions table for tracking PhantomBuster executions via Zapier
-- This table is used by the new Zapier integration to track LinkedIn campaign executions

CREATE TABLE IF NOT EXISTS campaign_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phantombuster_execution_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'running', 'completed', 'failed')),
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_executions_campaign_id ON campaign_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_user_id ON campaign_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_phantombuster_id ON campaign_executions(phantombuster_execution_id);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_status ON campaign_executions(status);

-- Add unique constraint to prevent duplicate executions
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_executions_unique_phantom_id 
ON campaign_executions(phantombuster_execution_id);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_campaign_executions_updated_at ON campaign_executions;
CREATE TRIGGER trigger_campaign_executions_updated_at
    BEFORE UPDATE ON campaign_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_executions_updated_at();

-- Add comment to document the table purpose
COMMENT ON TABLE campaign_executions IS 'Tracks PhantomBuster execution status for LinkedIn campaigns via Zapier integration';
COMMENT ON COLUMN campaign_executions.phantombuster_execution_id IS 'The execution ID from PhantomBuster (can be temporary zapier-xxx format)';
COMMENT ON COLUMN campaign_executions.status IS 'Execution status: pending, started, running, completed, failed'; 