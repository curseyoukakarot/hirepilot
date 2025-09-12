-- Add keywords array to job_requisitions
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_job_requisitions_keywords ON public.job_requisitions USING GIN (keywords);
