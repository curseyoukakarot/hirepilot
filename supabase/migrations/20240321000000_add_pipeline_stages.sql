-- Create pipeline_stages table
CREATE TABLE pipeline_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add pipeline_id to job_requisitions table
ALTER TABLE job_requisitions
ADD COLUMN pipeline_id UUID DEFAULT uuid_generate_v4();

-- Create indexes
CREATE INDEX idx_pipeline_stages_job_id ON pipeline_stages(job_id);
CREATE INDEX idx_pipeline_stages_position ON pipeline_stages(position);

-- Enable RLS
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view pipeline stages for their jobs"
  ON pipeline_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_requisitions
      WHERE job_requisitions.id = pipeline_stages.job_id
      AND job_requisitions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pipeline stages for their jobs"
  ON pipeline_stages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_requisitions
      WHERE job_requisitions.id = pipeline_stages.job_id
      AND job_requisitions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update pipeline stages for their jobs"
  ON pipeline_stages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_requisitions
      WHERE job_requisitions.id = pipeline_stages.job_id
      AND job_requisitions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete pipeline stages for their jobs"
  ON pipeline_stages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM job_requisitions
      WHERE job_requisitions.id = pipeline_stages.job_id
      AND job_requisitions.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for pipeline_stages
CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 