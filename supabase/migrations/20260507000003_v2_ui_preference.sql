-- HirePilot v2 — Per-user UI preference (opt-in v2 rollout).
-- Idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ui_version text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS v2_banner_dismissed_at timestamptz;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_ui_version_check;
ALTER TABLE users
  ADD CONSTRAINT users_ui_version_check
  CHECK (ui_version IN ('legacy', 'v2'));

COMMENT ON COLUMN users.ui_version IS 'Which UI shell the user sees by default. Toggleable in either direction at any time.';
COMMENT ON COLUMN users.v2_banner_dismissed_at IS 'When the user last dismissed the v2 upgrade banner. Drives banner re-show cadence.';
