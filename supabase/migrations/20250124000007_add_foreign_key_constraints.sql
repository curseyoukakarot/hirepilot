-- Add foreign key constraints for pipeline system
-- This ensures database integrity and proper CASCADE deletes

-- First, create the pipelines table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  department TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add job_id column to pipelines table if it doesn't exist
ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.job_requisitions(id) ON DELETE CASCADE;

-- Add foreign key from pipelines.job_id to job_requisitions.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_pipelines_job_id' 
        AND table_name = 'pipelines'
    ) THEN
        ALTER TABLE public.pipelines 
        ADD CONSTRAINT fk_pipelines_job_id 
        FOREIGN KEY (job_id) REFERENCES public.job_requisitions(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key from pipeline_stages.pipeline_id to pipelines.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_pipeline_stages_pipeline_id' 
        AND table_name = 'pipeline_stages'
    ) THEN
        ALTER TABLE public.pipeline_stages 
        ADD CONSTRAINT fk_pipeline_stages_pipeline_id 
        FOREIGN KEY (pipeline_id) REFERENCES public.pipelines(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pipelines_job_id ON public.pipelines(job_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);