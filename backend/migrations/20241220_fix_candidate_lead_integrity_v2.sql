-- Fix candidate-lead integrity and add indexes (Version 2)
-- This migration first cleans up orphaned data, then adds constraints

-- Step 1: Identify and clean up orphaned candidates
-- First, let's see what we're dealing with
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Count orphaned candidates (no matching lead)
  SELECT COUNT(*) INTO orphan_count
  FROM candidates c
  LEFT JOIN leads l ON l.id = c.lead_id
  WHERE c.lead_id IS NOT NULL AND l.id IS NULL;
  
  RAISE NOTICE 'Found % orphaned candidates with invalid lead_id references', orphan_count;
  
  -- Log the orphaned records for review
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Orphaned candidates:';
    -- Note: Detailed logging removed to avoid complex loop syntax
    -- You can query manually: SELECT c.id, c.lead_id, c.first_name, c.last_name, c.email FROM candidates c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.lead_id IS NOT NULL AND l.id IS NULL;
  END IF;
END $$;

-- Step 2: Clean up orphaned data
-- Option A: Set lead_id to NULL for orphaned candidates (recommended)
UPDATE candidates 
SET lead_id = NULL 
WHERE lead_id IS NOT NULL 
  AND lead_id NOT IN (SELECT id FROM leads);

-- Log how many records were cleaned up
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % orphaned candidate records (set lead_id to NULL)', cleaned_count;
END $$;

-- Step 3: Ensure lead_id column exists on candidates table
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS lead_id uuid;

-- Step 4: Add foreign key constraint (should work now)
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
    
    RAISE NOTICE 'Foreign key constraint added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Step 5: Add indexes for better performance
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

-- Step 6: Verify the cleanup worked
DO $$
DECLARE
  remaining_orphans INTEGER;
BEGIN
  -- Count any remaining orphaned candidates
  SELECT COUNT(*) INTO remaining_orphans
  FROM candidates c
  LEFT JOIN leads l ON l.id = c.lead_id
  WHERE c.lead_id IS NOT NULL AND l.id IS NULL;
  
  IF remaining_orphans = 0 THEN
    RAISE NOTICE '✅ All orphaned records cleaned up successfully';
  ELSE
    RAISE NOTICE '⚠️  % orphaned records still remain - manual cleanup may be needed', remaining_orphans;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN candidates.lead_id IS 'Foreign key reference to leads table. Can be NULL for candidates not linked to a lead.';
COMMENT ON INDEX idx_candidates_lead_id IS 'Index for fast lookups of candidates by lead_id';
COMMENT ON INDEX idx_lead_activities_lead_id IS 'Index for fast lookups of lead activities by lead_id';
COMMENT ON INDEX idx_candidate_activities_candidate_id IS 'Index for fast lookups of candidate activities by candidate_id';

-- Final verification
SELECT 
  'Migration completed successfully' as status,
  (SELECT COUNT(*) FROM candidates WHERE lead_id IS NOT NULL) as candidates_with_lead_id,
  (SELECT COUNT(*) FROM candidates WHERE lead_id IS NULL) as candidates_without_lead_id,
  (SELECT COUNT(*) FROM leads) as total_leads;
