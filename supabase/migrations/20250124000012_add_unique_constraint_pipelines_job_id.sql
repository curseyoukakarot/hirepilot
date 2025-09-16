-- Add unique constraint on pipelines.job_id to ensure only one pipeline per job
-- This prevents duplicate pipelines and enables the reuse + replace pattern

-- Add unique constraint on job_id
ALTER TABLE public.pipelines 
ADD CONSTRAINT unique_pipeline_per_job UNIQUE (job_id);

-- Create index for better performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_pipelines_job_id_unique ON public.pipelines(job_id);
