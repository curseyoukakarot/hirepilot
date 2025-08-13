-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Generic updated_at trigger function (idempotent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- message_sequences (the reusable template)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team_id uuid,
  name text NOT NULL,
  description text,
  stop_on_reply boolean NOT NULL DEFAULT true,
  send_window_start time,
  send_window_end time,
  throttle_per_hour int,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add team_id FK only if teams table exists
DO $$
BEGIN
  IF to_regclass('public.teams') IS NOT NULL THEN
    -- Add the FK if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'message_sequences_team_id_fkey'
    ) THEN
      ALTER TABLE public.message_sequences
        ADD CONSTRAINT message_sequences_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_message_sequences_updated_at'
  ) THEN
    CREATE TRIGGER trg_message_sequences_updated_at
    BEFORE UPDATE ON public.message_sequences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- Enable RLS
ALTER TABLE public.message_sequences ENABLE ROW LEVEL SECURITY;

-- RLS: Owner full CRUD
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_sequences' AND policyname = 'message_sequences_owner_all'
  ) THEN
    CREATE POLICY message_sequences_owner_all
      ON public.message_sequences
      FOR ALL
      TO authenticated
      USING (owner_user_id = auth.uid())
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
END$$;

-- Team-scoped policies outline (add when team membership model is available)
-- Example:
-- CREATE POLICY message_sequences_team_read
--   ON public.message_sequences FOR SELECT TO authenticated
--   USING (
--     team_id IS NOT NULL AND EXISTS (
--       SELECT 1 FROM public.team_members tm
--       WHERE tm.team_id = message_sequences.team_id AND tm.user_id = auth.uid()
--     )
--   );

-- ----------------------------------------------------------------------------
-- message_sequence_steps (ordered steps)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.message_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  subject text,
  body text NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  delay_hours int NOT NULL DEFAULT 0,
  send_only_business_days boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_order)
);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_message_sequence_steps_updated_at'
  ) THEN
    CREATE TRIGGER trg_message_sequence_steps_updated_at
    BEFORE UPDATE ON public.message_sequence_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

ALTER TABLE public.message_sequence_steps ENABLE ROW LEVEL SECURITY;

-- RLS: Allow access to steps if user owns the parent sequence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_sequence_steps' AND policyname = 'sequence_steps_owner_rw'
  ) THEN
    CREATE POLICY sequence_steps_owner_rw
      ON public.message_sequence_steps
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.message_sequences s
          WHERE s.id = message_sequence_steps.sequence_id
            AND s.owner_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.message_sequences s
          WHERE s.id = message_sequence_steps.sequence_id
            AND s.owner_user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- sequence_enrollments (lead x sequence)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.message_sequences(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  enrolled_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  current_step_order int NOT NULL DEFAULT 1,
  last_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, lead_id)
);

-- Helpful indexes for status lookups by sequence
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON public.sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON public.sequence_enrollments(status);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sequence_enrollments_updated_at'
  ) THEN
    CREATE TRIGGER trg_sequence_enrollments_updated_at
    BEFORE UPDATE ON public.sequence_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS: Owner of sequence or enrolling user can manage enrollment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sequence_enrollments' AND policyname = 'sequence_enrollments_owner_or_enroller_all'
  ) THEN
    CREATE POLICY sequence_enrollments_owner_or_enroller_all
      ON public.sequence_enrollments
      FOR ALL
      TO authenticated
      USING (
        enrolled_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.message_sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.owner_user_id = auth.uid()
        )
      )
      WITH CHECK (
        enrolled_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.message_sequences s
          WHERE s.id = sequence_enrollments.sequence_id
            AND s.owner_user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- sequence_step_runs (scheduled or executed sends)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequence_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.message_sequences(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.message_sequence_steps(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message_id uuid,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sequence_step_runs_send_at ON public.sequence_step_runs(send_at);
CREATE INDEX IF NOT EXISTS idx_sequence_step_runs_status ON public.sequence_step_runs(status);
CREATE INDEX IF NOT EXISTS idx_sequence_step_runs_enrollment ON public.sequence_step_runs(enrollment_id);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sequence_step_runs_updated_at'
  ) THEN
    CREATE TRIGGER trg_sequence_step_runs_updated_at
    BEFORE UPDATE ON public.sequence_step_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

ALTER TABLE public.sequence_step_runs ENABLE ROW LEVEL SECURITY;

-- RLS: Access step runs if user is enroller or sequence owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sequence_step_runs' AND policyname = 'sequence_step_runs_owner_or_enroller_all'
  ) THEN
    CREATE POLICY sequence_step_runs_owner_or_enroller_all
      ON public.sequence_step_runs
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.sequence_enrollments e
          JOIN public.message_sequences s ON s.id = e.sequence_id
          WHERE e.id = sequence_step_runs.enrollment_id
            AND (e.enrolled_by_user_id = auth.uid() OR s.owner_user_id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.sequence_enrollments e
          JOIN public.message_sequences s ON s.id = e.sequence_id
          WHERE e.id = sequence_step_runs.enrollment_id
            AND (e.enrolled_by_user_id = auth.uid() OR s.owner_user_id = auth.uid())
        )
      );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- Notes on team-scoped RLS
-- ----------------------------------------------------------------------------
-- When team membership tables are present (e.g., public.team_members(user_id, team_id, role)),
-- add SELECT/INSERT/UPDATE policies that allow access for users within the same team_id
-- of the parent sequence. Keep owner policy for overrides.


