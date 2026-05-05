-- HirePilot v2 — Goals + Decisions
-- Goals are REX-driven outcomes. Decisions are pending approvals REX held back.

-- ====================================================================
-- goals
-- ====================================================================
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  prompt text,                                          -- original natural-language input
  plan jsonb,                                           -- structured plan: steps[], assigned_agents[]
  status text NOT NULL DEFAULT 'planning' CHECK (status IN (
    'planning','awaiting_approval','running','paused','completed','failed','cancelled'
  )),
  trust_level text NOT NULL DEFAULT 'suggest' CHECK (trust_level IN ('manual','suggest','autopilot')),
  recurring boolean NOT NULL DEFAULT false,
  schedule_cron text,
  parent_goal_id uuid REFERENCES goals(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,          -- {progress_pct, eta_seconds, agents_used, credits_used, ...}
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_workspace_status ON goals(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id) WHERE parent_goal_id IS NOT NULL;

COMMENT ON TABLE goals IS 'REX-driven outcomes. Each goal has a plan, status, and execution trail.';

-- ====================================================================
-- decisions
-- ====================================================================
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'reply_draft','scale_recommendation','guardrail_override','offer_send','pipeline_move','submittal_send','custom'
  )),
  context jsonb NOT NULL,                               -- the original trigger (lead, message, etc.)
  payload jsonb NOT NULL,                               -- proposed action (draft text, plan, etc.)
  reason text,                                          -- "why I held it" copy for the UI
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','approved','edited','rejected','snoozed','graduated'
  )),
  assigned_to uuid REFERENCES users(id),
  resolution jsonb,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  graduated_rule jsonb,                                 -- if user graduated to auto-handle, store the rule here
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_workspace_status ON decisions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_decisions_assigned ON decisions(assigned_to) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_decisions_goal ON decisions(goal_id);
CREATE INDEX IF NOT EXISTS idx_decisions_snoozed ON decisions(snoozed_until) WHERE status = 'snoozed';

COMMENT ON TABLE decisions IS 'Pending approvals REX held back. Resolved → approved/edited/rejected/graduated.';

-- ====================================================================
-- updated_at trigger for goals
-- ====================================================================
CREATE OR REPLACE FUNCTION goals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS goals_updated_at_trigger ON goals;
CREATE TRIGGER goals_updated_at_trigger
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION goals_set_updated_at();

-- ====================================================================
-- RLS
-- ====================================================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- goals — workspace members can see all; only owner+admin can manage cross-user
DROP POLICY IF EXISTS "Workspace members can read goals" ON goals;
CREATE POLICY "Workspace members can read goals"
  ON goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = goals.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage own goals" ON goals;
CREATE POLICY "Workspace members can manage own goals"
  ON goals FOR ALL
  TO authenticated
  USING (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = goals.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = goals.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  );

-- decisions — same pattern, with assigned_to and admin override
DROP POLICY IF EXISTS "Workspace members can read decisions" ON decisions;
CREATE POLICY "Workspace members can read decisions"
  ON decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = decisions.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Assignee or admin can resolve decisions" ON decisions;
CREATE POLICY "Assignee or admin can resolve decisions"
  ON decisions FOR ALL
  TO authenticated
  USING (
    assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = decisions.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = decisions.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  );
