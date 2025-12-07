BEGIN;

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS team_admin_view_pool boolean DEFAULT true;

UPDATE team_settings
  SET team_admin_view_pool = true
  WHERE team_admin_view_pool IS NULL;

COMMIT;

