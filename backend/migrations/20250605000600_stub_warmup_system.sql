-- Stub objects for LinkedIn warm-up system so that validateInviteRequest works

-- 1. Basic tables if they don't exist (settings + stats)
CREATE TABLE IF NOT EXISTS linkedin_warmup_settings (
  user_id uuid PRIMARY KEY,
  warmup_enabled boolean DEFAULT true,
  auto_progression_enabled boolean DEFAULT true,
  pause_on_warnings boolean DEFAULT true,
  max_daily_failures int DEFAULT 3,
  min_delay_between_invites_seconds int DEFAULT 300,
  max_delay_between_invites_seconds int DEFAULT 1800,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_invite_stats (
  user_id uuid,
  stat_date date,
  count int DEFAULT 0,
  successful_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  tier text DEFAULT 'new_user',
  daily_limit int DEFAULT 5,
  consecutive_successful_days int DEFAULT 0,
  PRIMARY KEY (user_id, stat_date)
);

-- 2. View expected by InviteWarmupService
CREATE OR REPLACE VIEW linkedin_user_warmup_status AS
SELECT
  u.id                                AS user_id,
  COALESCE(s.count, 0)               AS today_invites_sent,
  COALESCE(s.daily_limit, 5)         AS current_daily_limit,
  COALESCE(s.tier, 'new_user')       AS current_tier,
  GREATEST(0, COALESCE(s.daily_limit, 5) - COALESCE(s.count, 0)) AS remaining_invites_today,
  COALESCE(s.consecutive_successful_days, 0) AS consecutive_successful_days,
  (COALESCE(s.count,0) >= COALESCE(s.daily_limit,5)) AS daily_limit_reached,
  COALESCE(ws.warmup_enabled, true)  AS warmup_enabled,
  COALESCE(ws.auto_progression_enabled, true) AS auto_progression_enabled,
  false                              AS has_manual_override,
  NULL::int                          AS manual_daily_limit,
  0                                  AS security_warnings_today,
  COALESCE(s.failed_count,0)         AS failed_invites_today,
  COALESCE(ws.min_delay_between_invites_seconds, 300)  AS min_delay_between_invites_seconds,
  COALESCE(ws.max_delay_between_invites_seconds, 1800) AS max_delay_between_invites_seconds
FROM users u
LEFT JOIN linkedin_invite_stats s ON s.user_id = u.id AND s.stat_date = CURRENT_DATE
LEFT JOIN linkedin_warmup_settings ws ON ws.user_id = u.id;

-- 3. Stub function to update stats (no-op but returns success)
CREATE OR REPLACE FUNCTION public.update_daily_invite_stats(
  p_user_id uuid,
  p_increment_count int DEFAULT 1,
  p_was_successful boolean DEFAULT true
) RETURNS void AS $$
BEGIN
  -- Upsert minimal stats row just so downstream queries work
  INSERT INTO linkedin_invite_stats (user_id, stat_date, count, successful_count, failed_count)
  VALUES (p_user_id, CURRENT_DATE, p_increment_count, CASE WHEN p_was_successful THEN 1 ELSE 0 END, CASE WHEN p_was_successful THEN 0 ELSE 1 END)
  ON CONFLICT (user_id, stat_date) DO UPDATE
    SET count = linkedin_invite_stats.count + EXCLUDED.count,
        successful_count = linkedin_invite_stats.successful_count + EXCLUDED.successful_count,
        failed_count = linkedin_invite_stats.failed_count + EXCLUDED.failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Permissions for API key
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
-- Views are covered by TABLE grants in most Postgres versions, but grant explicitly for clarity
GRANT SELECT ON linkedin_user_warmup_status TO anon;
GRANT EXECUTE ON FUNCTION update_daily_invite_stats(uuid,int,boolean) TO anon; 