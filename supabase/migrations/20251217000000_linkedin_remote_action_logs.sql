-- Logs for Bright Data Browser remote action test harness

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS linkedin_remote_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','success','failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_remote_action_logs_user_created
  ON linkedin_remote_action_logs(user_id, created_at DESC);

