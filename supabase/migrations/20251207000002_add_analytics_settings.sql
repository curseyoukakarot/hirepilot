BEGIN;

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS share_analytics boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_admin_view_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_admin_view_user_id uuid,
  ADD COLUMN IF NOT EXISTS analytics_team_pool boolean DEFAULT false;

UPDATE team_settings
  SET share_analytics = COALESCE(share_analytics, false),
      analytics_admin_view_enabled = COALESCE(analytics_admin_view_enabled, false),
      analytics_team_pool = COALESCE(analytics_team_pool, false)
  WHERE share_analytics IS NULL
     OR analytics_admin_view_enabled IS NULL
     OR analytics_team_pool IS NULL;

COMMIT;

