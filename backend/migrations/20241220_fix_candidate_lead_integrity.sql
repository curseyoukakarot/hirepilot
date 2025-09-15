-- Fix candidate-lead integrity and add indexes
-- This migration addresses data integrity issues that were causing 404 errors

-- Ensure lead_id column exists on candidates table
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS lead_id uuid;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'candidates_lead_id_fkey'
  ) THEN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES leads(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_candidates_lead_id ON candidates(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_candidate_activities_candidate_id ON candidate_activities(candidate_id);

-- Add index on candidates user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);

-- Add index on leads user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);

-- Add index on lead_activities user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON lead_activities(user_id);

-- Add index on candidate_activities created_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidate_activities_created_by ON candidate_activities(created_by);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_candidates_user_lead ON candidates(user_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_timestamp ON lead_activities(lead_id, activity_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_activities_candidate_created ON candidate_activities(candidate_id, created_at DESC);

-- Check for orphaned records and log them (don't delete automatically)
-- This will help identify data integrity issues
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Count orphaned candidates (no matching lead)
  SELECT COUNT(*) INTO orphan_count
  FROM candidates c
  LEFT JOIN leads l ON l.id = c.lead_id
  WHERE c.lead_id IS NOT NULL AND l.id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned candidates with invalid lead_id references', orphan_count;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN candidates.lead_id IS 'Foreign key reference to leads table. Can be NULL for candidates not linked to a lead.';
COMMENT ON INDEX idx_candidates_lead_id IS 'Index for fast lookups of candidates by lead_id';
COMMENT ON INDEX idx_lead_activities_lead_id IS 'Index for fast lookups of lead activities by lead_id';
COMMENT ON INDEX idx_candidate_activities_candidate_id IS 'Index for fast lookups of candidate activities by candidate_id';
