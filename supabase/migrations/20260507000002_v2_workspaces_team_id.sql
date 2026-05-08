-- HirePilot v2 — Add workspaces.team_id + backfill
-- Eliminates the user→users.team_id dance every server-side resolver does today.
-- Idempotent: safe to re-run.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS team_id uuid;
CREATE INDEX IF NOT EXISTS idx_workspaces_team_id ON workspaces(team_id);

-- Backfill: for each workspace, look up the owner member's users.team_id.
-- (Owner role is the source of truth for plan/billing in this app.)
UPDATE workspaces w
SET team_id = u.team_id
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE wm.workspace_id = w.id
  AND wm.role = 'owner'
  AND wm.status = 'active'
  AND w.team_id IS NULL
  AND u.team_id IS NOT NULL;

-- Fallback: if no owner has team_id set, fall back to any active member's team_id.
UPDATE workspaces w
SET team_id = u.team_id
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE wm.workspace_id = w.id
  AND wm.status = 'active'
  AND w.team_id IS NULL
  AND u.team_id IS NOT NULL;

COMMENT ON COLUMN workspaces.team_id IS 'Denormalized from users.team_id (owner-first) so resolvers can avoid the workspace_members join.';
