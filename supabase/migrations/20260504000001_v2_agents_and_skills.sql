-- HirePilot v2 — Agents + Skills system
-- Adds: skills_catalog, agents, agent_skills.
-- REX is implicit (always present) — only specialist agents get rows.

-- ====================================================================
-- skills_catalog — admin-managed catalog of available capabilities
-- ====================================================================
CREATE TABLE IF NOT EXISTS skills_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'sourcing','engagement','scheduling','closing','research','reporting'
  )),
  integration_id text,                          -- 'linkedin' | 'apollo' | 'hunter' | 'skrapp' | 'sendgrid' | 'browserbase' | 'gmail' | 'outlook' | 'github' | 'twitter' | 'google_calendar' | null
  agent_role text NOT NULL CHECK (agent_role IN (
    'sourcer','recruiter','coordinator','researcher','business_dev','closer','account_manager','reference_checker'
  )),
  default_installed boolean NOT NULL DEFAULT true,
  icon text,
  schedule_capable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_catalog_role ON skills_catalog(agent_role);
CREATE INDEX IF NOT EXISTS idx_skills_catalog_category ON skills_catalog(category);

COMMENT ON TABLE skills_catalog IS 'Admin-managed list of Skills available to install on specialist agents.';

-- ====================================================================
-- agents — workspace's hired specialists (REX is NOT a row here)
-- ====================================================================
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'sourcer','recruiter','coordinator','researcher','business_dev','closer','account_manager','reference_checker'
  )),
  display_name text,
  trust_level text NOT NULL DEFAULT 'suggest' CHECK (trust_level IN ('manual','suggest','autopilot')),
  paused boolean NOT NULL DEFAULT false,
  hired_by uuid REFERENCES users(id) ON DELETE SET NULL,
  hired_at timestamptz NOT NULL DEFAULT now(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT agents_workspace_role_unique UNIQUE (workspace_id, role)
);

CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_role ON agents(workspace_id, role);

COMMENT ON TABLE agents IS 'Hired specialist agents per workspace. REX is implicit (always present, not stored).';

-- ====================================================================
-- agent_skills — many-to-many: which Skills are installed on which agent
-- ====================================================================
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES skills_catalog(id),
  enabled boolean NOT NULL DEFAULT true,
  schedule_cron text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  PRIMARY KEY (agent_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_skill ON agent_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_scheduled ON agent_skills(schedule_cron) WHERE schedule_cron IS NOT NULL;

COMMENT ON TABLE agent_skills IS 'Skills installed on a specific agent. Schedules + config live here.';

-- ====================================================================
-- RLS
-- ====================================================================
ALTER TABLE skills_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

-- skills_catalog is global / public-read
DROP POLICY IF EXISTS "Anyone authenticated can read skills_catalog" ON skills_catalog;
CREATE POLICY "Anyone authenticated can read skills_catalog"
  ON skills_catalog FOR SELECT
  TO authenticated
  USING (true);

-- agents — workspace members can SELECT; only admin/owner can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Workspace members can read agents" ON agents;
CREATE POLICY "Workspace members can read agents"
  ON agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = agents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Workspace admins can manage agents" ON agents;
CREATE POLICY "Workspace admins can manage agents"
  ON agents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = agents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = agents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  );

-- agent_skills — same pattern via the parent agent
DROP POLICY IF EXISTS "Workspace members can read agent_skills" ON agent_skills;
CREATE POLICY "Workspace members can read agent_skills"
  ON agent_skills FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
      WHERE a.id = agent_skills.agent_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Workspace admins can manage agent_skills" ON agent_skills;
CREATE POLICY "Workspace admins can manage agent_skills"
  ON agent_skills FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
      WHERE a.id = agent_skills.agent_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
      WHERE a.id = agent_skills.agent_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner','admin')
    )
  );
