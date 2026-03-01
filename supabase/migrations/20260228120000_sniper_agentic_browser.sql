-- ==========================================================================
-- Sniper V2: Agentic Browser Provider
-- Adds Browserbase support, extends provider constraints, and creates
-- agent execution logging tables.
-- ==========================================================================

-- 1. Add Browserbase fields to user_linkedin_auth
ALTER TABLE public.user_linkedin_auth
  ADD COLUMN IF NOT EXISTS browserbase_context_id text NULL,
  ADD COLUMN IF NOT EXISTS browserbase_last_auth_at timestamptz NULL;

-- 2. Extend provider constraints on sniper_settings
ALTER TABLE public.sniper_settings
  DROP CONSTRAINT IF EXISTS sniper_settings_provider_check;
ALTER TABLE public.sniper_settings
  ADD CONSTRAINT sniper_settings_provider_check
    CHECK (provider IN ('airtop', 'extension_only', 'agentic_browser'));

-- 3. Extend provider constraints on sniper_jobs
ALTER TABLE public.sniper_jobs
  DROP CONSTRAINT IF EXISTS sniper_jobs_provider_check;
ALTER TABLE public.sniper_jobs
  ADD CONSTRAINT sniper_jobs_provider_check
    CHECK (provider IN ('airtop', 'local_playwright', 'agentic_browser'));

-- 4. Auth sessions table for Browserbase (mirrors sniper_airtop_auth_sessions)
CREATE TABLE IF NOT EXISTS public.sniper_browserbase_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  browserbase_session_id text NOT NULL,
  browserbase_context_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sniper_bb_auth_user
  ON public.sniper_browserbase_auth_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sniper_bb_auth_status
  ON public.sniper_browserbase_auth_sessions(status, created_at DESC);

-- RLS: users can only see their own auth sessions
ALTER TABLE public.sniper_browserbase_auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sniper_bb_auth_own ON public.sniper_browserbase_auth_sessions
  FOR ALL USING (user_id = auth.uid());

-- Service role bypass
CREATE POLICY sniper_bb_auth_service ON public.sniper_browserbase_auth_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Agent execution logs for debugging and cost tracking
CREATE TABLE IF NOT EXISTS public.sniper_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.sniper_jobs(id) ON DELETE SET NULL,
  job_item_id uuid REFERENCES public.sniper_job_items(id) ON DELETE SET NULL,
  workspace_id uuid NOT NULL,
  task_type text NOT NULL,
  steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_steps integer NOT NULL DEFAULT 0,
  llm_tokens_used integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sniper_agent_runs_job
  ON public.sniper_agent_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_sniper_agent_runs_ws
  ON public.sniper_agent_runs(workspace_id, created_at DESC);

-- RLS: workspace-scoped
ALTER TABLE public.sniper_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sniper_agent_runs_service ON public.sniper_agent_runs
  FOR ALL USING (auth.role() = 'service_role');
