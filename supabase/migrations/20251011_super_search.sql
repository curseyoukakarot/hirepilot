-- Super Search foundations: candidate structured tables, FTS MV, and indexes
-- Safe, additive migration. Requires pg_trgm and pgcrypto for gen_random_uuid.

-- Extensions (safe if already present)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- Candidate structured tables (resume-derived)
-- =============================================
CREATE TABLE IF NOT EXISTS candidate_contact (
  candidate_id uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  email        text,
  phone        text,
  linkedin_url text,
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_experience (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company      text,
  title        text,
  start_date   date,
  end_date     date,
  current      boolean DEFAULT false,
  location     text,
  description  text
);

CREATE TABLE IF NOT EXISTS candidate_education (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  school       text,
  degree       text,
  field        text,
  start_year   int,
  end_year     int
);

CREATE TABLE IF NOT EXISTS candidate_skill (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill        text NOT NULL
);

-- Raw parser payload to allow re-parsing later
CREATE TABLE IF NOT EXISTS candidate_resume_raw (
  candidate_id   uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  raw_json       jsonb NOT NULL,
  parser_version text  NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- Optional: normalized tech stack tags recognized from resume text
CREATE TABLE IF NOT EXISTS candidate_tech_stack (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  tech         text NOT NULL
);

-- =============================================
-- Full-text search materialized view for candidates
-- =============================================
-- Note: We avoid referencing optional candidate columns; use first_name/last_name only.
-- Weighted tsvector across name, contact, skills, experience titles/companies, and tech.
CREATE MATERIALIZED VIEW IF NOT EXISTS candidate_search_mv AS
SELECT
  c.id AS candidate_id,
  (
    setweight(to_tsvector('simple', coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(cc.email,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(cc.linkedin_url,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(string_agg(DISTINCT cs.skill, ' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(string_agg(DISTINCT (ce.title || ' ' || coalesce(ce.company,'')), ' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(string_agg(DISTINCT cts.tech, ' '),'')), 'B')
  ) AS document
FROM candidates c
LEFT JOIN candidate_contact cc ON cc.candidate_id = c.id
LEFT JOIN candidate_skill cs ON cs.candidate_id = c.id
LEFT JOIN candidate_experience ce ON ce.candidate_id = c.id
LEFT JOIN candidate_tech_stack cts ON cts.candidate_id = c.id
GROUP BY c.id, cc.email, cc.linkedin_url;

-- Indexes required for fast FTS and concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_search_mv ON candidate_search_mv(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_search_mv_gin ON candidate_search_mv USING gin (document);

-- =============================================
-- Helpful trigram indexes for fuzzy matching
-- =============================================
-- Candidate experience title/company trigram indexes
CREATE INDEX IF NOT EXISTS idx_candidate_experience_title_trgm ON candidate_experience USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_candidate_experience_company_trgm ON candidate_experience USING gin (company gin_trgm_ops);

-- Leads lightweight search: add trigram indexes when columns exist
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'title'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_leads_title_trgm ON leads USING gin (title gin_trgm_ops);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_leads_company_trgm ON leads USING gin (company gin_trgm_ops);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'company_name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_leads_company_name_trgm ON leads USING gin (company_name gin_trgm_ops);
  END IF;
END $$;

-- =============================================
-- Refresh helper
-- =============================================
CREATE OR REPLACE FUNCTION refresh_candidate_search_mv()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY candidate_search_mv;
$$;


