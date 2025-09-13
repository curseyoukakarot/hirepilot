-- Phase 1 – Database Setup: Job Share + Apply Flow
-- This migration is written to be idempotent where possible to avoid breaking existing schemas.

-- Ensure uuid extension exists (uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) job_shares table
CREATE TABLE IF NOT EXISTS job_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uuid_link TEXT UNIQUE,
  apply_mode TEXT DEFAULT 'hirepilot' CHECK (apply_mode IN ('hirepilot','external')),
  apply_url TEXT,
  view_count INT DEFAULT 0 NOT NULL,
  apply_clicks INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_job_shares_job_id ON job_shares(job_id);
CREATE INDEX IF NOT EXISTS idx_job_shares_recruiter_id ON job_shares(recruiter_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_shares_uuid_link ON job_shares(uuid_link);

-- Enable RLS and basic ownership policies
ALTER TABLE job_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'job_shares' AND policyname = 'job_shares_select_own_or_public'
  ) THEN
    -- Allow owners to read their rows. Public reads for shared pages should be via backend API using service key.
    CREATE POLICY job_shares_select_own_or_public ON job_shares
      FOR SELECT USING (recruiter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'job_shares' AND policyname = 'job_shares_insert_owner'
  ) THEN
    CREATE POLICY job_shares_insert_owner ON job_shares
      FOR INSERT WITH CHECK (recruiter_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'job_shares' AND policyname = 'job_shares_update_owner'
  ) THEN
    CREATE POLICY job_shares_update_owner ON job_shares
      FOR UPDATE USING (recruiter_id = auth.uid());
  END IF;
END $$;

-- 2) candidates table adjustments to support hosted Apply form
-- Keep existing columns; add only what is missing for the public apply flow.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES job_requisitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_note TEXT;

-- Backfill optional `name` where empty using first/last (best-effort, non-fatal)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidates' AND column_name = 'first_name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidates' AND column_name = 'last_name'
  ) THEN
    UPDATE candidates
      SET name = COALESCE(NULLIF(name, ''), trim(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')))
      WHERE name IS NULL OR name = '';
  END IF;
END $$;


