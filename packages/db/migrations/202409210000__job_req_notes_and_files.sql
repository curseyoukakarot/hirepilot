-- Helper functions for job requisition access
CREATE OR REPLACE FUNCTION public.fn_is_job_collaborator(job_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_requisition_collaborators c
    WHERE c.job_id = job_uuid
      AND c.user_id = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_is_job_creator(job_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_requisitions r
    WHERE r.id = job_uuid
      AND r.user_id = user_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_collab_role(job_uuid uuid, user_uuid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN r.user_id = user_uuid THEN 'editor'
      ELSE c.role
    END
  FROM public.job_requisitions r
  LEFT JOIN public.job_requisition_collaborators c
    ON c.job_id = r.id AND c.user_id = user_uuid
  WHERE r.id = job_uuid;
$$;

-- Extend job_requisition_notes to link candidates and add supporting indexes
DO $$
BEGIN
  IF to_regclass('public.job_requisition_notes') IS NOT NULL THEN
    ALTER TABLE public.job_requisition_notes
      ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_notes_job ON public.job_requisition_notes(job_id);
    CREATE INDEX IF NOT EXISTS idx_notes_candidate ON public.job_requisition_notes(candidate_id);

    ALTER TABLE public.job_requisition_notes ENABLE ROW LEVEL SECURITY;

    CREATE POLICY job_requisition_notes_read ON public.job_requisition_notes
      FOR SELECT
      USING (public.fn_is_job_collaborator(job_id, auth.uid()));

    CREATE POLICY job_requisition_notes_insert ON public.job_requisition_notes
      FOR INSERT
      WITH CHECK (public.fn_collab_role(job_id, auth.uid()) IN ('commenter','editor'));

    CREATE POLICY job_requisition_notes_update ON public.job_requisition_notes
      FOR UPDATE
      USING (public.fn_collab_role(job_id, auth.uid()) = 'editor')
      WITH CHECK (public.fn_collab_role(job_id, auth.uid()) = 'editor');
  END IF;
END
$$;

-- Activity indexes and policies
DO $$
BEGIN
  IF to_regclass('public.job_requisition_activity') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_activity_job_created ON public.job_requisition_activity(job_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_job_type ON public.job_requisition_activity(job_id, type);

    ALTER TABLE public.job_requisition_activity ENABLE ROW LEVEL SECURITY;

    CREATE POLICY job_requisition_activity_read ON public.job_requisition_activity
      FOR SELECT
      USING (public.fn_is_job_collaborator(job_id, auth.uid()));

    CREATE POLICY job_requisition_activity_insert ON public.job_requisition_activity
      FOR INSERT
      WITH CHECK (public.fn_collab_role(job_id, auth.uid()) IN ('commenter','editor'));
  END IF;
END
$$;

-- Collaborators index and policies
DO $$
BEGIN
  IF to_regclass('public.job_requisition_collaborators') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_collab_job ON public.job_requisition_collaborators(job_id);

    ALTER TABLE public.job_requisition_collaborators ENABLE ROW LEVEL SECURITY;

    CREATE POLICY job_requisition_collaborators_read ON public.job_requisition_collaborators
      FOR SELECT
      USING (public.fn_is_job_collaborator(job_id, auth.uid()));

    CREATE POLICY job_requisition_collaborators_manage ON public.job_requisition_collaborators
      FOR ALL
      USING (
        public.fn_collab_role(job_id, auth.uid()) = 'editor'
        OR public.fn_is_job_creator(job_id, auth.uid())
      )
      WITH CHECK (
        public.fn_collab_role(job_id, auth.uid()) = 'editor'
        OR public.fn_is_job_creator(job_id, auth.uid())
      );
  END IF;
END
$$;

-- Candidate files table and policies
CREATE TABLE IF NOT EXISTS public.candidate_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_requisitions(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  filename text,
  url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.candidate_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_files_read ON public.candidate_files
  FOR SELECT
  USING (public.fn_is_job_collaborator(job_id, auth.uid()));

CREATE POLICY candidate_files_insert ON public.candidate_files
  FOR INSERT
  WITH CHECK (public.fn_collab_role(job_id, auth.uid()) IN ('commenter','editor'));

CREATE POLICY candidate_files_update ON public.candidate_files
  FOR UPDATE
  USING (public.fn_collab_role(job_id, auth.uid()) = 'editor')
  WITH CHECK (public.fn_collab_role(job_id, auth.uid()) = 'editor');

CREATE POLICY candidate_files_delete ON public.candidate_files
  FOR DELETE
  USING (public.fn_collab_role(job_id, auth.uid()) = 'editor');

-- Uniform status column for job_requisitions
ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('draft','open','on_hold','filled','archived'))
    DEFAULT 'draft';

-- Validation queries
-- \d+ public.job_requisition_notes
-- SELECT to_regclass('public.idx_notes_candidate');
-- SELECT to_regclass('public.idx_activity_job_created');
-- SELECT to_regclass('public.idx_collab_job');
-- SELECT to_regclass('public.idx_activity_job_type');
-- SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='candidate_files');

