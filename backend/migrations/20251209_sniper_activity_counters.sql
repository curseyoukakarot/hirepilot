CREATE TABLE IF NOT EXISTS sniper_activity_counters (
  account_id uuid NOT NULL,
  date date NOT NULL,
  linkedin_profile_views_used integer DEFAULT 0,
  linkedin_connection_invites_used integer DEFAULT 0,
  linkedin_messages_used integer DEFAULT 0,
  linkedin_inmails_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (account_id, date)
);

CREATE TRIGGER sniper_activity_counters_set_updated_at
BEFORE UPDATE ON sniper_activity_counters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

