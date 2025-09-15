-- Quick Fix: Add stage column to candidate_jobs table
-- Run this if you get "column stage does not exist" error

-- Add stage column to candidate_jobs if it doesn't exist
ALTER TABLE candidate_jobs 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Applied';

-- Update existing records to have a stage value
UPDATE candidate_jobs 
SET stage = COALESCE(stage, 'Applied') 
WHERE stage IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'candidate_jobs' 
AND column_name = 'stage';

-- Show sample data
SELECT id, candidate_id, job_id, status, stage, updated_at
FROM candidate_jobs 
LIMIT 5;
