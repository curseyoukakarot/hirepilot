BEGIN;

-- When Deals pooling is enabled, allow non-admin team members to see the pooled view.
-- Default ON to preserve existing pooled behavior.
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS share_deals_members boolean DEFAULT true;

UPDATE team_settings
  SET share_deals_members = true
  WHERE share_deals_members IS NULL;

COMMIT;


