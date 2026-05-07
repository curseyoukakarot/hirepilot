-- HirePilot v2 — REX activity log
-- One row per meaningful event REX/specialists do in a workspace.
-- Drives:
--   - Today page activity timeline
--   - Per-agent "Right now" status line on Team page
--   - "Last action" on agent cards
--
-- Keep it append-only (no updates after insert). Read paths order by created_at DESC.

CREATE TABLE IF NOT EXISTS rex_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),                    -- the human who triggered this (nullable for autonomous)
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,  -- which specialist did it (NULL = REX itself)
  agent_role text,                                       -- denormalized for fast filtering
  event_type text NOT NULL CHECK (event_type IN (
    'skill_executed','skill_held','skill_failed',
    'goal_planned','goal_started','goal_step_done','goal_completed','goal_failed',
    'decision_resolved','agent_hired','agent_fired','agent_trust_changed'
  )),
  goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  decision_id uuid REFERENCES decisions(id) ON DELETE SET NULL,
  skill_id text REFERENCES skills_catalog(id),
  summary text NOT NULL,                                 -- 1-line human-readable: "Drafted reply for Marcus"
  detail jsonb,                                          -- structured payload for rich UIs
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rex_activity_workspace_recent
  ON rex_activity_log (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rex_activity_agent
  ON rex_activity_log (agent_id, created_at DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rex_activity_goal
  ON rex_activity_log (goal_id) WHERE goal_id IS NOT NULL;

COMMENT ON TABLE rex_activity_log IS 'Append-only stream of REX/specialist events surfaced on Today + Team.';

ALTER TABLE rex_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read rex_activity_log" ON rex_activity_log;
CREATE POLICY "Workspace members can read rex_activity_log"
  ON rex_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = rex_activity_log.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Writes are server-only via service role.
