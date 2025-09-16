-- Create RPC function to atomically create job with pipeline and default stages
-- This ensures data consistency and prevents partial failures

CREATE OR REPLACE FUNCTION create_job_with_pipeline(
  job_title TEXT,
  job_user UUID,
  job_department TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_job_id UUID;
  new_pipeline_id UUID;
  stage_colors TEXT[] := ARRAY['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#059669'];
  stage_names TEXT[] := ARRAY['Sourced', 'Contacted', 'Interviewed', 'Offered', 'Hired'];
  i INTEGER;
BEGIN
  -- 1. Create the job requisition
  INSERT INTO job_requisitions (
    user_id,
    title,
    department,
    status,
    created_at,
    updated_at
  ) VALUES (
    job_user,
    job_title,
    COALESCE(job_department, ''),
    'open',
    NOW(),
    NOW()
  ) RETURNING id INTO new_job_id;

  -- 2. Create the pipeline
  INSERT INTO pipelines (
    user_id,
    name,
    department,
    job_id,
    created_at,
    updated_at
  ) VALUES (
    job_user,
    job_title || ' Pipeline',
    COALESCE(job_department, ''),
    new_job_id,
    NOW(),
    NOW()
  ) RETURNING id INTO new_pipeline_id;

  -- 3. Update job with pipeline_id
  UPDATE job_requisitions 
  SET pipeline_id = new_pipeline_id
  WHERE id = new_job_id;

  -- 4. Create default stages
  FOR i IN 1..5 LOOP
    INSERT INTO pipeline_stages (
      pipeline_id,
      title,
      color,
      position,
      created_at,
      updated_at
    ) VALUES (
      new_pipeline_id,
      stage_names[i],
      stage_colors[i],
      i,
      NOW(),
      NOW()
    );
  END LOOP;

  -- Return the job ID
  RETURN new_job_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_job_with_pipeline(TEXT, UUID, TEXT) TO authenticated;
