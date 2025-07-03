-- Add seat tracking and suspension support
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS included_seats INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seat_count INTEGER DEFAULT 1;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false; 