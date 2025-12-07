-- Enhance linkedin_sessions table for remote LinkedIn actions
ALTER TABLE linkedin_sessions
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS cookie_string text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text;

-- Ensure newly added columns are populated
UPDATE linkedin_sessions
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE linkedin_sessions
SET created_at = COALESCE(created_at, updated_at, now())
WHERE created_at IS NULL;

-- Set defaults and primary key on id
ALTER TABLE linkedin_sessions
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE linkedin_sessions
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'linkedin_sessions_pkey'
  ) THEN
    ALTER TABLE linkedin_sessions DROP CONSTRAINT linkedin_sessions_pkey;
  END IF;
END $$;

ALTER TABLE linkedin_sessions
  ADD CONSTRAINT linkedin_sessions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_sessions_user ON linkedin_sessions(user_id);


-- Remote LinkedIn actions settings per user
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS use_remote_linkedin_actions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_linkedin_plan text;

