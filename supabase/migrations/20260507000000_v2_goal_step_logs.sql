-- HirePilot v2 — Goal step execution traces
-- Each row records one Skill invocation triggered by a goal's plan.
-- Drives the Goals page "Live execution" console + per-agent "Right now" line.

CREATE TABLE IF NOT EXISTS goal_step_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  step_index int NOT NULL,                              -- index into goals.plan.steps
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  skill_id text REFERENCES skills_catalog(id),
  status text NOT NULL CHECK (status IN ('running','done','held','failed','skipped')),
  input jsonb,                                           -- payload sent to the Skill
  output jsonb,                                          -- result data (or null when held/failed)
  decision_id uuid REFERENCES decisions(id) ON DELETE SET NULL,  -- if guardrails held the action
  error text,                                            -- when status='failed'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms int
);

CREATE INDEX IF NOT EXISTS idx_goal_step_logs_goal ON goal_step_logs(goal_id, step_index);
CREATE INDEX IF NOT EXISTS idx_goal_step_logs_agent ON goal_step_logs(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goal_step_logs_workspace ON goal_step_logs(workspace_id);

COMMENT ON TABLE goal_step_logs IS 'One row per Skill invocation triggered by a goal''s plan execution.';

ALTER TABLE goal_step_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read goal_step_logs" ON goal_step_logs;
CREATE POLICY "Workspace members can read goal_step_logs"
  ON goal_step_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = goal_step_logs.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Writes are server-only via service role (no INSERT/UPDATE policy for authenticated users).
