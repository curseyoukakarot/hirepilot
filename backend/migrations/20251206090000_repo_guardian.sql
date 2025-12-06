-- Repo Guardian: health checks
CREATE TABLE IF NOT EXISTS public.repo_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_by text NOT NULL CHECK (triggered_by IN ('system', 'user')),
  triggered_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  branch text NOT NULL,
  tests_status text NOT NULL CHECK (tests_status IN ('pass', 'fail', 'warn')),
  lint_status text NOT NULL CHECK (lint_status IN ('pass', 'fail', 'warn')),
  build_status text NOT NULL CHECK (build_status IN ('pass', 'fail', 'warn')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  summary text NULL,
  logs_tests text NULL,
  logs_lint text NULL,
  logs_build text NULL
);

CREATE INDEX IF NOT EXISTS repo_health_checks_created_at_idx
  ON public.repo_health_checks (created_at DESC);

-- Repo Guardian: grouped errors
CREATE TABLE IF NOT EXISTS public.repo_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  error_signature text NOT NULL,
  error_message text NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixing', 'resolved')),
  last_context_route text NULL,
  stack_trace text NULL,
  context_json jsonb NULL,
  last_health_check_id uuid NULL REFERENCES public.repo_health_checks(id) ON DELETE SET NULL,
  last_explanation text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS repo_errors_error_signature_key
  ON public.repo_errors (error_signature);

-- Repo Guardian: synthetic scenarios
CREATE TABLE IF NOT EXISTS public.repo_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NULL,
  type text NOT NULL CHECK (type IN ('plan_permissions', 'leads_candidates', 'teams_sharing', 'integrations', 'other')),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.repo_scenario_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scenario_id uuid NOT NULL REFERENCES public.repo_scenarios(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  status text NOT NULL DEFAULT 'never_run' CHECK (status IN ('pass', 'fail', 'never_run', 'running')),
  failing_step text NULL,
  logs text NULL
);

CREATE INDEX IF NOT EXISTS repo_scenario_runs_scenario_id_created_at_idx
  ON public.repo_scenario_runs (scenario_id, created_at DESC);

-- Repo Guardian: integrity sweeps
CREATE TABLE IF NOT EXISTS public.repo_integrity_sweeps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.repo_integrity_sweep_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sweep_id uuid NOT NULL REFERENCES public.repo_integrity_sweeps(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  status text NOT NULL DEFAULT 'never_run' CHECK (status IN ('clean', 'violations', 'never_run', 'running')),
  violation_summary text NULL,
  raw_report text NULL,
  violation_count integer NULL
);

CREATE INDEX IF NOT EXISTS repo_integrity_sweep_runs_sweep_id_created_at_idx
  ON public.repo_integrity_sweep_runs (sweep_id, created_at DESC);

-- Repo Guardian: agent conversations & messages
CREATE TABLE IF NOT EXISTS public.repo_agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  title text NULL,
  related_error_id uuid NULL REFERENCES public.repo_errors(id) ON DELETE SET NULL,
  related_health_check_id uuid NULL REFERENCES public.repo_health_checks(id) ON DELETE SET NULL,
  related_scenario_run_id uuid NULL REFERENCES public.repo_scenario_runs(id) ON DELETE SET NULL,
  related_sweep_run_id uuid NULL REFERENCES public.repo_integrity_sweep_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.repo_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  conversation_id uuid NOT NULL REFERENCES public.repo_agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent', 'system')),
  content text NOT NULL
);

CREATE INDEX IF NOT EXISTS repo_agent_messages_conversation_id_created_at_idx
  ON public.repo_agent_messages (conversation_id, created_at DESC);

-- Repo Guardian: configuration
CREATE TABLE IF NOT EXISTS public.repo_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slack_enabled boolean NOT NULL DEFAULT false,
  slack_channel text NULL,
  slack_webhook_url text NULL,
  email_enabled boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT '{}',
  nightly_check_enabled boolean NOT NULL DEFAULT false,
  nightly_check_time_utc text NOT NULL DEFAULT '02:00',
  error_alert_threshold integer NOT NULL DEFAULT 5
);

CREATE UNIQUE INDEX IF NOT EXISTS repo_agent_settings_singleton_idx
  ON public.repo_agent_settings ((true));

-- Restrict Repo Guardian tables to SUPER ADMIN role
DO $$
DECLARE
  tbl text;
  policy_name text;
  role_check text := '(current_setting(''request.jwt.claims'', true)::json ->> ''role'') = ''super_admin''';
BEGIN
  FOR tbl IN SELECT UNNEST(ARRAY[
    'repo_health_checks',
    'repo_errors',
    'repo_scenarios',
    'repo_scenario_runs',
    'repo_integrity_sweeps',
    'repo_integrity_sweep_runs',
    'repo_agent_conversations',
    'repo_agent_messages',
    'repo_agent_settings'
  ])
  LOOP
    policy_name := tbl || '_super_admin_access';

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s);',
      policy_name,
      tbl,
      role_check,
      role_check
    );
  END LOOP;
END
$$;

