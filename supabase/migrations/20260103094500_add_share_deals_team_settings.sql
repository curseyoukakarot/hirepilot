BEGIN;

-- Team-wide pooled Deals visibility toggle (default ON)
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS share_deals boolean DEFAULT true;

UPDATE team_settings
  SET share_deals = true
  WHERE share_deals IS NULL;

COMMIT;


