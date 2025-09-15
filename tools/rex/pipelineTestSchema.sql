-- REX Pipeline Tools Test Schema
-- Run this SQL in Supabase to set up test environment

-- =============================================
-- 1. JOB REQUISITIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS job_requisitions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  department TEXT,
  location TEXT,
  salary_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. CANDIDATES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES job_requisitions(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'sourced',
  enrichment_data JSONB DEFAULT '{}',
  resume_url TEXT,
  notes TEXT,
  linkedin_url TEXT,
  cover_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CANDIDATE JOBS TABLE (Pipeline Stages)
-- =============================================
CREATE TABLE IF NOT EXISTS candidate_jobs (
  id TEXT PRIMARY KEY,
  candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES job_requisitions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sourced', -- Keep original status column
  stage TEXT NOT NULL DEFAULT 'Applied', -- Add stage column for pipeline management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- =============================================
-- 4. PIPELINE STAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT REFERENCES job_requisitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. CREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_jobs_candidate_id ON candidate_jobs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_jobs_job_id ON candidate_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_jobs_stage ON candidate_jobs(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_job_id ON pipeline_stages(job_id);

-- =============================================
-- 6. ADD MISSING COLUMNS TO EXISTING TABLES
-- =============================================

-- Add stage column to candidate_jobs if it doesn't exist
ALTER TABLE candidate_jobs 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Applied';

-- Update existing records to have a stage value
UPDATE candidate_jobs 
SET stage = COALESCE(stage, 'Applied') 
WHERE stage IS NULL;

-- =============================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. CREATE RLS POLICIES
-- =============================================

-- Job requisitions policies
DROP POLICY IF EXISTS "Users can view their own job requisitions" ON job_requisitions;
CREATE POLICY "Users can view their own job requisitions"
  ON job_requisitions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own job requisitions" ON job_requisitions;
CREATE POLICY "Users can insert their own job requisitions"
  ON job_requisitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own job requisitions" ON job_requisitions;
CREATE POLICY "Users can update their own job requisitions"
  ON job_requisitions FOR UPDATE
  USING (auth.uid() = user_id);

-- Candidates policies
DROP POLICY IF EXISTS "Users can view their own candidates" ON candidates;
CREATE POLICY "Users can view their own candidates"
  ON candidates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own candidates" ON candidates;
CREATE POLICY "Users can insert their own candidates"
  ON candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own candidates" ON candidates;
CREATE POLICY "Users can update their own candidates"
  ON candidates FOR UPDATE
  USING (auth.uid() = user_id);

-- Candidate jobs policies
DROP POLICY IF EXISTS "Users can view their own candidate jobs" ON candidate_jobs;
CREATE POLICY "Users can view their own candidate jobs"
  ON candidate_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_jobs.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own candidate jobs" ON candidate_jobs;
CREATE POLICY "Users can insert their own candidate jobs"
  ON candidate_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_jobs.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own candidate jobs" ON candidate_jobs;
CREATE POLICY "Users can update their own candidate jobs"
  ON candidate_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_jobs.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

-- Pipeline stages policies
DROP POLICY IF EXISTS "Users can view pipeline stages for their jobs" ON pipeline_stages;
CREATE POLICY "Users can view pipeline stages for their jobs"
  ON pipeline_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_requisitions
      WHERE job_requisitions.id = pipeline_stages.job_id
      AND job_requisitions.user_id = auth.uid()
    )
  );

-- =============================================
-- 9. INSERT TEST DATA
-- =============================================

-- Insert test job
INSERT INTO job_requisitions (id, title, description, department, location, status)
VALUES (
  'job123',
  'Revenue Ops Role',
  'Senior Revenue Operations Manager responsible for sales analytics and process optimization.',
  'Sales',
  'San Francisco, CA',
  'open'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  department = EXCLUDED.department,
  location = EXCLUDED.location,
  status = EXCLUDED.status;

-- Insert test candidates
INSERT INTO candidates (id, job_id, first_name, last_name, email, phone, status, notes)
VALUES
  ('cand123', 'job123', 'Alice', 'Johnson', 'alice@example.com', '+1-555-0101', 'sourced', 'Strong background in SaaS sales. 5+ years experience.'),
  ('cand124', 'job123', 'Bob', 'Smith', 'bob@example.com', '+1-555-0102', 'sourced', 'Great technical depth. Former Salesforce admin.'),
  ('cand125', 'job123', 'Carol', 'Davis', 'carol@example.com', '+1-555-0103', 'sourced', 'Excellent communication skills. Startup experience.'),
  ('cand126', 'job123', 'David', 'Wilson', 'david@example.com', '+1-555-0104', 'sourced', 'Strong analytical skills. MBA from Stanford.')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- Insert candidate-job stage associations
INSERT INTO candidate_jobs (id, candidate_id, job_id, stage, updated_at)
VALUES
  ('cj123', 'cand123', 'job123', 'Phone Screen', NOW() - INTERVAL '10 days'),
  ('cj124', 'cand124', 'job123', 'Interview', NOW()),
  ('cj125', 'cand125', 'job123', 'Technical Interview', NOW() - INTERVAL '3 days'),
  ('cj126', 'cand126', 'job123', 'Offer', NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET
  stage = EXCLUDED.stage,
  updated_at = EXCLUDED.updated_at;

-- Insert pipeline stages
INSERT INTO pipeline_stages (job_id, title, color, position)
VALUES
  ('job123', 'Applied', '#6B7280', 1),
  ('job123', 'Phone Screen', '#3B82F6', 2),
  ('job123', 'Interview', '#10B981', 3),
  ('job123', 'Technical Interview', '#F59E0B', 4),
  ('job123', 'Offer', '#8B5CF6', 5),
  ('job123', 'Hired', '#059669', 6),
  ('job123', 'Rejected', '#EF4444', 7)
ON CONFLICT DO NOTHING;

-- =============================================
-- 10. VERIFICATION QUERIES
-- =============================================

-- Verify test data
SELECT 
  'Test Data Summary' as info,
  (SELECT COUNT(*) FROM job_requisitions WHERE id = 'job123') as jobs,
  (SELECT COUNT(*) FROM candidates WHERE job_id = 'job123') as candidates,
  (SELECT COUNT(*) FROM candidate_jobs WHERE job_id = 'job123') as candidate_jobs,
  (SELECT COUNT(*) FROM pipeline_stages WHERE job_id = 'job123') as pipeline_stages;

-- Show candidate stages
SELECT 
  c.first_name || ' ' || c.last_name as candidate_name,
  cj.stage,
  cj.updated_at,
  EXTRACT(DAYS FROM NOW() - cj.updated_at) as days_in_stage
FROM candidates c
JOIN candidate_jobs cj ON c.id = cj.candidate_id
WHERE c.job_id = 'job123'
ORDER BY cj.updated_at DESC;

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
SELECT '🎉 REX Pipeline Test Schema Created Successfully!' as status;
