-- LinkedIn Invite Warm-Up System Migration
-- Progressive daily limit system to prevent LinkedIn account flags

-- Invite tier enum for warm-up progression
CREATE TYPE linkedin_invite_tier AS ENUM (
  'new_user',      -- 5/day (starting tier)
  'warming_up',    -- 7-15/day (progressive tiers)
  'established',   -- 17-19/day (advanced tiers)
  'veteran'        -- 20/day (maximum tier)
);

-- LinkedIn Invite Statistics Table
-- Tracks daily invite counts and tier progression for each user
CREATE TABLE linkedin_invite_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Date tracking
  stat_date DATE DEFAULT CURRENT_DATE NOT NULL,
  
  -- Invite metrics
  count INTEGER DEFAULT 0 CHECK (count >= 0),
  successful_count INTEGER DEFAULT 0 CHECK (successful_count >= 0),
  failed_count INTEGER DEFAULT 0 CHECK (failed_count >= 0),
  
  -- Warm-up tier system
  tier linkedin_invite_tier DEFAULT 'new_user' NOT NULL,
  daily_limit INTEGER DEFAULT 5 CHECK (daily_limit BETWEEN 1 AND 20),
  
  -- Progression tracking
  consecutive_successful_days INTEGER DEFAULT 0 CHECK (consecutive_successful_days >= 0),
  last_tier_upgrade_date DATE,
  
  -- Safety metrics
  security_warnings INTEGER DEFAULT 0 CHECK (security_warnings >= 0),
  account_restrictions INTEGER DEFAULT 0 CHECK (account_restrictions >= 0),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per user per day
  UNIQUE(user_id, stat_date)
);

-- LinkedIn Invite Warm-Up Settings
-- Per-user warm-up configuration and overrides
CREATE TABLE linkedin_warmup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Warm-up configuration
  warmup_enabled BOOLEAN DEFAULT TRUE,
  auto_progression_enabled BOOLEAN DEFAULT TRUE,
  
  -- Manual overrides (admin can set custom limits)
  manual_daily_limit INTEGER CHECK (manual_daily_limit BETWEEN 1 AND 50),
  manual_tier linkedin_invite_tier,
  override_reason TEXT,
  override_set_by UUID, -- Admin user who set the override
  
  -- Safety settings
  pause_on_warnings BOOLEAN DEFAULT TRUE,
  max_daily_failures INTEGER DEFAULT 3 CHECK (max_daily_failures >= 1),
  
  -- Timing controls
  min_delay_between_invites_seconds INTEGER DEFAULT 300 CHECK (min_delay_between_invites_seconds >= 60), -- 5 minutes default
  max_delay_between_invites_seconds INTEGER DEFAULT 1800 CHECK (max_delay_between_invites_seconds >= min_delay_between_invites_seconds), -- 30 minutes default
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Invite Warm-Up History
-- Detailed history of tier changes and progression events
CREATE TABLE linkedin_warmup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('tier_upgrade', 'tier_downgrade', 'manual_override', 'limit_reset', 'security_pause')),
  
  -- Tier changes
  old_tier linkedin_invite_tier,
  new_tier linkedin_invite_tier,
  old_daily_limit INTEGER,
  new_daily_limit INTEGER,
  
  -- Context
  reason TEXT,
  triggered_by TEXT, -- 'auto_progression', 'admin_override', 'security_event'
  admin_user_id UUID, -- If triggered by admin action
  
  -- Metadata
  event_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_linkedin_invite_stats_user_date ON linkedin_invite_stats(user_id, stat_date);
CREATE INDEX idx_linkedin_invite_stats_date ON linkedin_invite_stats(stat_date);
CREATE INDEX idx_linkedin_invite_stats_tier ON linkedin_invite_stats(tier);
CREATE INDEX idx_linkedin_warmup_settings_user ON linkedin_warmup_settings(user_id);
CREATE INDEX idx_linkedin_warmup_history_user ON linkedin_warmup_history(user_id);
CREATE INDEX idx_linkedin_warmup_history_date ON linkedin_warmup_history(event_date);

-- View: Current User Warm-Up Status
-- Provides a consolidated view of each user's current warm-up status
CREATE VIEW linkedin_user_warmup_status AS
SELECT 
  u.id as user_id,
  u.email,
  
  -- Current stats (today)
  COALESCE(today_stats.count, 0) as today_invites_sent,
  COALESCE(today_stats.daily_limit, 5) as current_daily_limit,
  COALESCE(today_stats.tier, 'new_user'::linkedin_invite_tier) as current_tier,
  
  -- Remaining capacity
  COALESCE(today_stats.daily_limit, 5) - COALESCE(today_stats.count, 0) as remaining_invites_today,
  
  -- Progression metrics
  COALESCE(today_stats.consecutive_successful_days, 0) as consecutive_successful_days,
  today_stats.last_tier_upgrade_date,
  
  -- Safety metrics
  COALESCE(today_stats.security_warnings, 0) as security_warnings_today,
  COALESCE(today_stats.failed_count, 0) as failed_invites_today,
  
  -- Settings
  COALESCE(settings.warmup_enabled, TRUE) as warmup_enabled,
  COALESCE(settings.auto_progression_enabled, TRUE) as auto_progression_enabled,
  settings.manual_daily_limit,
  settings.manual_tier,
  settings.override_reason,
  
  -- Status flags
  CASE 
    WHEN COALESCE(today_stats.count, 0) >= COALESCE(today_stats.daily_limit, 5) THEN TRUE
    ELSE FALSE
  END as daily_limit_reached,
  
  CASE 
    WHEN settings.manual_daily_limit IS NOT NULL THEN TRUE
    ELSE FALSE
  END as has_manual_override,
  
  -- Timing
  today_stats.updated_at as last_invite_time,
  settings.min_delay_between_invites_seconds,
  settings.max_delay_between_invites_seconds
  
FROM auth.users u
LEFT JOIN linkedin_invite_stats today_stats ON (
  u.id = today_stats.user_id 
  AND today_stats.stat_date = CURRENT_DATE
)
LEFT JOIN linkedin_warmup_settings settings ON u.id = settings.user_id
WHERE u.deleted_at IS NULL;

-- Function: Calculate Next Tier Daily Limit
-- Determines the daily limit for a given tier
CREATE OR REPLACE FUNCTION get_tier_daily_limit(tier_name linkedin_invite_tier)
RETURNS INTEGER AS $$
BEGIN
  CASE tier_name
    WHEN 'new_user' THEN RETURN 5;
    WHEN 'warming_up' THEN RETURN LEAST(7 + (FLOOR(RANDOM() * 9)), 15); -- 7-15 range
    WHEN 'established' THEN RETURN 17 + (FLOOR(RANDOM() * 3)); -- 17-19 range  
    WHEN 'veteran' THEN RETURN 20;
    ELSE RETURN 5; -- Default to new user
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate Tier Progression
-- Determines if a user should be upgraded to the next tier
CREATE OR REPLACE FUNCTION calculate_tier_progression(
  current_tier linkedin_invite_tier,
  consecutive_days INTEGER,
  security_warnings INTEGER
)
RETURNS linkedin_invite_tier AS $$
BEGIN
  -- Don't upgrade if there have been security issues
  IF security_warnings > 0 THEN
    RETURN current_tier;
  END IF;
  
  -- Progression logic based on consecutive successful days
  CASE current_tier
    WHEN 'new_user' THEN
      IF consecutive_days >= 3 THEN RETURN 'warming_up';
      ELSE RETURN current_tier;
      END IF;
    WHEN 'warming_up' THEN  
      IF consecutive_days >= 7 THEN RETURN 'established';
      ELSE RETURN current_tier;
      END IF;
    WHEN 'established' THEN
      IF consecutive_days >= 14 THEN RETURN 'veteran';
      ELSE RETURN current_tier;
      END IF;
    WHEN 'veteran' THEN
      RETURN 'veteran'; -- Already at max tier
    ELSE
      RETURN 'new_user'; -- Default fallback
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function: Update Daily Invite Stats
-- Updates or creates daily stats record for a user
CREATE OR REPLACE FUNCTION update_daily_invite_stats(
  p_user_id UUID,
  p_increment_count INTEGER DEFAULT 1,
  p_was_successful BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  current_stats RECORD;
  new_tier linkedin_invite_tier;
  new_daily_limit INTEGER;
BEGIN
  -- Get or create today's stats
  INSERT INTO linkedin_invite_stats (user_id, stat_date, count, successful_count, failed_count)
  VALUES (p_user_id, CURRENT_DATE, 0, 0, 0)
  ON CONFLICT (user_id, stat_date) DO NOTHING;
  
  -- Update counts
  IF p_was_successful THEN
    UPDATE linkedin_invite_stats 
    SET 
      count = count + p_increment_count,
      successful_count = successful_count + p_increment_count,
      updated_at = NOW()
    WHERE user_id = p_user_id AND stat_date = CURRENT_DATE;
  ELSE
    UPDATE linkedin_invite_stats 
    SET 
      count = count + p_increment_count,
      failed_count = failed_count + p_increment_count,
      updated_at = NOW()
    WHERE user_id = p_user_id AND stat_date = CURRENT_DATE;
  END IF;
  
  -- Get updated stats for tier calculation
  SELECT * INTO current_stats 
  FROM linkedin_invite_stats 
  WHERE user_id = p_user_id AND stat_date = CURRENT_DATE;
  
  -- Calculate if tier should be upgraded
  SELECT calculate_tier_progression(
    current_stats.tier,
    current_stats.consecutive_successful_days,
    current_stats.security_warnings
  ) INTO new_tier;
  
  -- Update tier if changed
  IF new_tier != current_stats.tier THEN
    SELECT get_tier_daily_limit(new_tier) INTO new_daily_limit;
    
    UPDATE linkedin_invite_stats
    SET 
      tier = new_tier,
      daily_limit = new_daily_limit,
      last_tier_upgrade_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE user_id = p_user_id AND stat_date = CURRENT_DATE;
    
    -- Log the tier change
    INSERT INTO linkedin_warmup_history (
      user_id, event_type, old_tier, new_tier, 
      old_daily_limit, new_daily_limit, reason, triggered_by
    ) VALUES (
      p_user_id, 'tier_upgrade', current_stats.tier, new_tier,
      current_stats.daily_limit, new_daily_limit, 
      'Auto progression after successful invites', 'auto_progression'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE linkedin_invite_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_warmup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_warmup_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own invite stats" ON linkedin_invite_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own warmup settings" ON linkedin_warmup_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own warmup history" ON linkedin_warmup_history
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all data
CREATE POLICY "Service role can manage invite stats" ON linkedin_invite_stats
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage warmup settings" ON linkedin_warmup_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage warmup history" ON linkedin_warmup_history
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON linkedin_invite_stats TO service_role;
GRANT ALL ON linkedin_warmup_settings TO service_role;
GRANT ALL ON linkedin_warmup_history TO service_role;
GRANT SELECT ON linkedin_user_warmup_status TO service_role;

-- Comments
COMMENT ON TABLE linkedin_invite_stats IS 'Daily LinkedIn invite statistics and tier progression tracking';
COMMENT ON TABLE linkedin_warmup_settings IS 'Per-user warm-up configuration and admin overrides';
COMMENT ON TABLE linkedin_warmup_history IS 'Audit log of tier changes and warm-up events';
COMMENT ON VIEW linkedin_user_warmup_status IS 'Consolidated view of user warm-up status and limits';
COMMENT ON FUNCTION get_tier_daily_limit IS 'Returns daily invite limit for a given tier';
COMMENT ON FUNCTION calculate_tier_progression IS 'Determines tier progression based on performance';
COMMENT ON FUNCTION update_daily_invite_stats IS 'Updates daily stats and handles tier progression'; 