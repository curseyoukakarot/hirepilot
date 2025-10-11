-- Deals Activity Log (clients, decision makers, opportunities)
-- Safe additive migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum type if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE activity_type AS ENUM ('call', 'email', 'meeting', 'note', 'task', 'update');
  END IF;
END $$;

-- Main activities table
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  type activity_type NOT NULL,
  title text,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Optional FK to teams if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='teams'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'activities_org_fk'
        AND conrelid = 'public.activities'::regclass
    ) THEN
      ALTER TABLE public.activities
        ADD CONSTRAINT activities_org_fk
        FOREIGN KEY (org_id)
        REFERENCES public.teams(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Link table to attach an activity to multiple entities
CREATE TABLE IF NOT EXISTS public.activity_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('client','decision_maker','opportunity')),
  entity_id uuid NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_org_created ON public.activities(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON public.activities(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_link_entity ON public.activity_link(entity_type, entity_id);


