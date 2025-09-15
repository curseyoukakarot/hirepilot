-- Candidate Notes Table
-- This table stores notes/comments for candidates with full collaboration support
-- Each note is stored as a separate row for better history tracking
-- Note: This table already exists in the system, this is just for reference

-- The existing table structure is:
-- CREATE TABLE candidate_notes (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
--   author_id uuid REFERENCES users(id),
--   author_name text,
--   author_avatar_url text,
--   note_text text,
--   created_at timestamp with time zone DEFAULT now(),
--   updated_at timestamp with time zone DEFAULT now()
-- );

-- Add RLS (Row Level Security) policies
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes for candidates they have access to
CREATE POLICY "Users can view candidate notes" ON candidate_notes
  FOR SELECT USING (
    candidate_id IN (
      SELECT c.id FROM candidates c
      JOIN candidate_jobs cj ON c.id = cj.candidate_id
      JOIN job_requisitions jr ON cj.job_id = jr.id
      WHERE jr.user_id = auth.uid()
    )
  );

-- Policy: Users can insert notes for candidates they have access to
CREATE POLICY "Users can insert candidate notes" ON candidate_notes
  FOR INSERT WITH CHECK (
    candidate_id IN (
      SELECT c.id FROM candidates c
      JOIN candidate_jobs cj ON c.id = cj.candidate_id
      JOIN job_requisitions jr ON cj.job_id = jr.id
      WHERE jr.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes" ON candidate_notes
  FOR UPDATE USING (
    author = auth.email() OR
    candidate_id IN (
      SELECT c.id FROM candidates c
      JOIN candidate_jobs cj ON c.id = cj.candidate_id
      JOIN job_requisitions jr ON cj.job_id = jr.id
      WHERE jr.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes" ON candidate_notes
  FOR DELETE USING (
    author = auth.email() OR
    candidate_id IN (
      SELECT c.id FROM candidates c
      JOIN candidate_jobs cj ON c.id = cj.candidate_id
      JOIN job_requisitions jr ON cj.job_id = jr.id
      WHERE jr.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_created_at ON candidate_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_author ON candidate_notes(author);

-- Example seed data (using existing candidate IDs from your system)
INSERT INTO candidate_notes (candidate_id, author, note) VALUES
('960b6019-84bb-403d-b54a-69ae8dd568ff', 'Admin', 'Reached out for initial phone screen'),
('960b6019-84bb-403d-b54a-69ae8dd568ff', 'Guest Collaborator', 'Great technical depth, needs follow-up'),
('960b6019-84bb-403d-b54a-69ae8dd568ff', 'REX Assistant', 'Confirmed availability for Tuesday interview');

-- Add a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_candidate_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_candidate_notes_updated_at
  BEFORE UPDATE ON candidate_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_candidate_notes_updated_at();
