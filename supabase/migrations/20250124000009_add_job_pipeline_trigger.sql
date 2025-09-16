-- Create trigger function to automatically create pipeline when job is inserted
-- This serves as a safety net for any job creation that bypasses the frontend modal

CREATE OR REPLACE FUNCTION public.ensure_pipeline_after_job_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pipeline_id uuid;
BEGIN
  -- Only create pipeline if one doesn't already exist
  IF NEW.pipeline_id IS NULL THEN
    -- Create pipeline
    INSERT INTO public.pipelines (job_id, user_id, name, department)
    VALUES (NEW.id, NEW.user_id, COALESCE(NEW.title, 'Job') || ' Pipeline', NEW.department)
    RETURNING id INTO new_pipeline_id;

    -- Create default stages
    INSERT INTO public.pipeline_stages (pipeline_id, title, position, color)
    VALUES
      (new_pipeline_id, 'Sourced', 1, '#3B82F6'),
      (new_pipeline_id, 'Contacted', 2, '#10B981'),
      (new_pipeline_id, 'Interviewed', 3, '#F59E0B'),
      (new_pipeline_id, 'Offered', 4, '#8B5CF6'),
      (new_pipeline_id, 'Hired', 5, '#059669');

    -- Update the job with the pipeline_id
    UPDATE public.job_requisitions 
    SET pipeline_id = new_pipeline_id 
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_ensure_pipeline_after_job_insert ON public.job_requisitions;

-- Create the trigger
CREATE TRIGGER trg_ensure_pipeline_after_job_insert
  AFTER INSERT ON public.job_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_pipeline_after_job_insert();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.ensure_pipeline_after_job_insert() TO authenticated;
