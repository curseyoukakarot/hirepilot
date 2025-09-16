-- Add share_id column to job_requisitions table for public job sharing
-- This enables job requisitions to be shared publicly via unique URLs

-- Add share_id column with unique constraint
ALTER TABLE public.job_requisitions 
ADD COLUMN IF NOT EXISTS share_id UUID DEFAULT gen_random_uuid();

-- Create unique index on share_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_requisitions_share_id 
ON public.job_requisitions(share_id);

-- Add RLS policies for public job sharing
-- Allow anonymous users to view jobs that have a share_id
CREATE POLICY "Public can view shared jobs"
ON public.job_requisitions
FOR SELECT
TO anon, authenticated
USING (share_id IS NOT NULL);

-- Allow anonymous users to apply to shared jobs
CREATE POLICY "Public can apply to shared jobs"
ON public.candidates
FOR INSERT
TO anon, authenticated
WITH CHECK (
  job_id IN (
    SELECT id FROM public.job_requisitions 
    WHERE share_id IS NOT NULL
  )
);
