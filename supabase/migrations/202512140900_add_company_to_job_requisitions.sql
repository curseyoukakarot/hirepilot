-- Add company column to job_requisitions if missing
ALTER TABLE public.job_requisitions
ADD COLUMN IF NOT EXISTS company TEXT;
