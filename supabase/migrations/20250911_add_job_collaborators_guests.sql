-- Create job_collaborators (internal users)
CREATE TABLE IF NOT EXISTS public.job_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('Admin', 'Editor', 'View Only')),
  created_at timestamp with time zone DEFAULT now()
);

-- Create job_guest_collaborators
CREATE TABLE IF NOT EXISTS public.job_guest_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text CHECK (role IN ('View Only', 'Commenter', 'View + Comment')),
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_job_collaborators_job ON public.job_collaborators(job_id);
CREATE INDEX IF NOT EXISTS idx_job_guest_collaborators_job ON public.job_guest_collaborators(job_id);
