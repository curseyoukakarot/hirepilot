-- HirePilot v2 — Team settings extension
-- Adds workspace identity, team color, trust ladder defaults.
-- Additive only. Existing share_leads / share_candidates / share_deals / share_deals_members / share_analytics columns preserved.

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS workspace_name text,
  ADD COLUMN IF NOT EXISTS team_color text DEFAULT 'indigo',
  ADD COLUMN IF NOT EXISTS default_trust_level text DEFAULT 'suggest',
  ADD COLUMN IF NOT EXISTS autopilot_score_threshold int DEFAULT 90,
  ADD COLUMN IF NOT EXISTS autopilot_max_spend_per_run_cents int DEFAULT 5000;

-- Constrain team_color to the 8-swatch palette
ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_team_color_check;
ALTER TABLE team_settings
  ADD CONSTRAINT team_settings_team_color_check
  CHECK (team_color IN ('indigo','emerald','amber','rose','teal','slate','violet','sky'));

-- Constrain default_trust_level
ALTER TABLE team_settings DROP CONSTRAINT IF EXISTS team_settings_default_trust_level_check;
ALTER TABLE team_settings
  ADD CONSTRAINT team_settings_default_trust_level_check
  CHECK (default_trust_level IN ('manual','suggest','autopilot'));

-- Backfill workspace_name for existing rows (use team name if available, else null and let UI prompt)
UPDATE team_settings ts
SET workspace_name = COALESCE(t.name, 'My HirePilot')
FROM teams t
WHERE ts.team_id = t.id AND ts.workspace_name IS NULL;

COMMENT ON COLUMN team_settings.workspace_name IS 'Display name shown in sidebar header + briefings. Editable by Owner/Admin.';
COMMENT ON COLUMN team_settings.team_color IS 'One of 8 swatches. Drives sidebar tint + team-initial badge gradient.';
COMMENT ON COLUMN team_settings.default_trust_level IS 'Default REX posture for new specialists/goals in this workspace.';
COMMENT ON COLUMN team_settings.autopilot_score_threshold IS 'Score above which REX auto-sends without confirmation in autopilot mode.';
COMMENT ON COLUMN team_settings.autopilot_max_spend_per_run_cents IS 'Cap on auto-spend per single REX run in autopilot mode (cents).';
