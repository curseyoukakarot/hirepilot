-- Job activity log
CREATE TABLE IF NOT EXISTS public.job_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_activity_log_job ON public.job_activity_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_created ON public.job_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_type ON public.job_activity_log(type);
