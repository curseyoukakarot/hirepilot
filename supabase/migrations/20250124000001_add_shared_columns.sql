-- Phase 2: Add shared columns to leads and candidates tables
-- This migration adds the shared boolean flag to enable team sharing

BEGIN;

-- Add shared column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS shared boolean DEFAULT false;

-- Add shared column to candidates table  
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS shared boolean DEFAULT false;

-- Add team_id column to leads table (for team sharing queries)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- Add team_id column to candidates table (for team sharing queries)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- Add indexes for better query performance on shared column
CREATE INDEX IF NOT EXISTS idx_leads_shared ON leads(shared);
CREATE INDEX IF NOT EXISTS idx_candidates_shared ON candidates(shared);

-- Add composite indexes for team sharing queries
CREATE INDEX IF NOT EXISTS idx_leads_user_shared ON leads(user_id, shared);
CREATE INDEX IF NOT EXISTS idx_candidates_user_shared ON candidates(user_id, shared);

-- Add indexes for team_id columns
CREATE INDEX IF NOT EXISTS idx_leads_team_id ON leads(team_id);
CREATE INDEX IF NOT EXISTS idx_candidates_team_id ON candidates(team_id);

-- Populate team_id for existing leads and candidates based on their user's team_id
UPDATE leads 
SET team_id = users.team_id 
FROM users 
WHERE leads.user_id = users.id 
AND users.team_id IS NOT NULL;

UPDATE candidates 
SET team_id = users.team_id 
FROM users 
WHERE candidates.user_id = users.id 
AND users.team_id IS NOT NULL;

COMMIT;
