-- HirePilot v2 — Seed default agents for existing workspaces
-- Pre-hires the Big 3 (Sourcer, Recruiter, Coordinator) for every workspace.
-- Idempotent via unique (workspace_id, role).

-- Hire Sourcer + Recruiter + Coordinator for every existing workspace
INSERT INTO agents (workspace_id, role, hired_by, trust_level)
SELECT
  w.id AS workspace_id,
  role,
  COALESCE(w.owner_id, (
    SELECT user_id FROM workspace_members
    WHERE workspace_id = w.id AND role = 'owner' AND status = 'active'
    LIMIT 1
  )) AS hired_by,
  COALESCE(ts.default_trust_level, 'suggest') AS trust_level
FROM workspaces w
LEFT JOIN team_settings ts ON ts.team_id = w.id
CROSS JOIN unnest(ARRAY['sourcer','recruiter','coordinator']) AS role
ON CONFLICT (workspace_id, role) DO NOTHING;

-- Auto-install default Skills on each pre-hired agent
INSERT INTO agent_skills (agent_id, skill_id, enabled)
SELECT a.id, sc.id, true
FROM agents a
JOIN skills_catalog sc
  ON sc.agent_role = a.role
 AND sc.default_installed = true
ON CONFLICT (agent_id, skill_id) DO NOTHING;
