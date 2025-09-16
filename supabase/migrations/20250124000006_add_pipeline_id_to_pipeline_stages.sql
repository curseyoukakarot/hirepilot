-- Add pipeline_id column to pipeline_stages table
-- This fixes the foreign key constraint violation when creating stages

-- Add pipeline_id column to pipeline_stages
ALTER TABLE public.pipeline_stages 
ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;

-- Create index for pipeline_id
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);

-- Update RLS policies to handle pipeline_id
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view pipeline stages for their jobs" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can insert pipeline stages for their jobs" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update pipeline stages for their jobs" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete pipeline stages for their jobs" ON public.pipeline_stages;

-- Create new policies that handle pipeline_id
CREATE POLICY "Users can view pipeline stages for their pipelines"
  ON public.pipeline_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE public.pipelines.id = public.pipeline_stages.pipeline_id
      AND public.pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pipeline stages for their pipelines"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE public.pipelines.id = public.pipeline_stages.pipeline_id
      AND public.pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update pipeline stages for their pipelines"
  ON public.pipeline_stages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE public.pipelines.id = public.pipeline_stages.pipeline_id
      AND public.pipelines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete pipeline stages for their pipelines"
  ON public.pipeline_stages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE public.pipelines.id = public.pipeline_stages.pipeline_id
      AND public.pipelines.user_id = auth.uid()
    )
  );