BEGIN;

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS allow_team_editing boolean DEFAULT false;

UPDATE team_settings
  SET allow_team_editing = false
  WHERE allow_team_editing IS NULL;

COMMIT;

