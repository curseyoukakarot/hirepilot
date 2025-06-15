-- Create enum for candidate status
CREATE TYPE candidate_status AS ENUM (
  'sourced',
  'contacted',
  'interviewed',
  'offered',
  'hired',
  'rejected'
);

-- Create candidates table
CREATE TABLE candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  user_id UUID REFERENCES auth.users(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status candidate_status DEFAULT 'sourced',
  enrichment_data JSONB,
  resume_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create job_requisitions table
CREATE TABLE job_requisitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  department TEXT,
  location TEXT,
  salary_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create candidate_jobs junction table
CREATE TABLE candidate_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
  status candidate_status DEFAULT 'sourced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- Create candidate_activities table
CREATE TABLE candidate_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
  status candidate_status,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create campaigns table
CREATE TABLE campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES job_requisitions(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  linkedin_filters JSONB DEFAULT '{
    "keywords": [],
    "locations": [],
    "current_companies": [],
    "past_companies": [],
    "schools": [],
    "years_of_experience": null,
    "job_titles": []
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidate_jobs_candidate_id ON candidate_jobs(candidate_id);
CREATE INDEX idx_candidate_jobs_job_id ON candidate_jobs(job_id);
CREATE INDEX idx_candidate_activities_candidate_id ON candidate_activities(candidate_id);

-- Create RLS policies
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_activities ENABLE ROW LEVEL SECURITY;

-- Candidates policies
CREATE POLICY "Users can view their own candidates"
  ON candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own candidates"
  ON candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidates"
  ON candidates FOR UPDATE
  USING (auth.uid() = user_id);

-- Job requisitions policies
CREATE POLICY "Users can view their own job requisitions"
  ON job_requisitions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job requisitions"
  ON job_requisitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job requisitions"
  ON job_requisitions FOR UPDATE
  USING (auth.uid() = user_id);

-- Candidate jobs policies
CREATE POLICY "Users can view their own candidate jobs"
  ON candidate_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_jobs.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own candidate jobs"
  ON candidate_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_jobs.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

-- Candidate activities policies
CREATE POLICY "Users can view their own candidate activities"
  ON candidate_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_activities.candidate_id
      AND candidates.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own candidate activities"
  ON candidate_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates
      WHERE candidates.id = candidate_activities.candidate_id
      AND candidates.user_id = auth.uid()
    )
  ); 