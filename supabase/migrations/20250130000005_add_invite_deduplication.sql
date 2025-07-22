-- LinkedIn Invite Deduplication System
-- Prevents re-sending invitations to the same LinkedIn profiles

-- Invite status enum for tracking different states
CREATE TYPE invite_status AS ENUM (
  'sent',           -- Invitation was sent successfully
  'accepted',       -- Invitation was accepted by recipient
  'declined',       -- Invitation was declined by recipient
  'withdrawn',      -- User withdrew the invitation
  'expired',        -- Invitation expired without response
  'blocked',        -- Profile blocked further invitations
  'error'           -- Error occurred during sending
);

-- LinkedIn Sent Invites Table
-- Core deduplication table tracking all sent invitations
CREATE TABLE linkedin_sent_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and Target
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_url TEXT NOT NULL,
  
  -- Normalized Profile Data
  profile_slug TEXT GENERATED ALWAYS AS (
    LOWER(TRIM(REPLACE(REPLACE(REPLACE(profile_url, 'https://www.linkedin.com/in/', ''), 'https://linkedin.com/in/', ''), '/', '')))
  ) STORED,
  
  -- Invite Details
  date_sent TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status invite_status DEFAULT 'sent' NOT NULL,
  message_content TEXT, -- The message that was sent
  
  -- Context
  campaign_id UUID, -- If sent as part of a campaign
  job_id UUID,       -- Reference to puppet_jobs
  source TEXT,       -- 'manual', 'campaign', 'bulk_import', etc.
  
  -- Tracking
  accepted_date TIMESTAMPTZ,
  response_date TIMESTAMPTZ,
  last_status_check TIMESTAMPTZ,
  
  -- LinkedIn Response Data
  linkedin_invite_id TEXT, -- LinkedIn's internal invite ID if available
  connection_degree INTEGER, -- 1st, 2nd, 3rd degree before invite
  mutual_connections INTEGER, -- Number of mutual connections
  
  -- Metadata
  user_agent TEXT,
  ip_address INET,
  proxy_used TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one invite per user per profile
  UNIQUE(user_id, profile_slug)
);

-- LinkedIn Profile Cache
-- Caches profile information to avoid repeated lookups
CREATE TABLE linkedin_profile_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile Identity
  profile_url TEXT UNIQUE NOT NULL,
  profile_slug TEXT GENERATED ALWAYS AS (
    LOWER(TRIM(REPLACE(REPLACE(REPLACE(profile_url, 'https://www.linkedin.com/in/', ''), 'https://linkedin.com/in/', ''), '/', '')))
  ) STORED,
  
  -- Profile Data
  full_name TEXT,
  headline TEXT,
  company TEXT,
  location TEXT,
  industry TEXT,
  profile_image_url TEXT,
  
  -- Connection Status
  is_connected BOOLEAN DEFAULT FALSE,
  connection_date TIMESTAMPTZ,
  connection_source TEXT, -- How the connection was made
  
  -- Profile Metadata
  premium_account BOOLEAN,
  open_to_work BOOLEAN,
  hiring BOOLEAN,
  influencer BOOLEAN,
  
  -- Outreach History
  total_invites_sent INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  
  -- Status Flags
  is_accessible BOOLEAN DEFAULT TRUE, -- Profile is public/accessible
  is_blocked BOOLEAN DEFAULT FALSE,   -- Profile has blocked invitations
  is_premium_required BOOLEAN DEFAULT FALSE, -- Requires Premium to message
  
  -- Cache Management
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  update_count INTEGER DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invite Deduplication Rules
-- Configurable rules for when to allow/block repeat invitations
CREATE TABLE invite_deduplication_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule Configuration
  rule_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 5, -- Higher number = higher priority
  
  -- Time-based Rules
  min_days_between_invites INTEGER DEFAULT 90, -- Minimum days before re-invite
  max_invites_per_profile INTEGER DEFAULT 1,   -- Max invites to same profile
  cooldown_after_decline_days INTEGER DEFAULT 180, -- Wait after decline
  cooldown_after_expire_days INTEGER DEFAULT 60,   -- Wait after expiry
  
  -- Status-based Rules
  allow_reinvite_after_withdraw BOOLEAN DEFAULT TRUE,
  allow_reinvite_after_expire BOOLEAN DEFAULT TRUE,
  allow_reinvite_after_decline BOOLEAN DEFAULT FALSE,
  block_after_multiple_declines BOOLEAN DEFAULT TRUE,
  
  -- Context Rules
  respect_campaign_rules BOOLEAN DEFAULT TRUE,
  different_message_required BOOLEAN DEFAULT TRUE,
  admin_override_allowed BOOLEAN DEFAULT TRUE,
  
  -- User Type Rules
  applies_to_user_types TEXT[], -- 'free', 'premium', 'enterprise'
  applies_to_sources TEXT[],    -- 'manual', 'campaign', 'bulk'
  
  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invite Deduplication Log
-- Detailed log of all deduplication decisions
CREATE TABLE invite_deduplication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_url TEXT NOT NULL,
  profile_slug TEXT,
  
  -- Decision
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked', 'deferred')),
  reason TEXT NOT NULL,
  rule_applied TEXT, -- Which rule caused the decision
  
  -- Request Details
  requested_message TEXT,
  request_source TEXT,
  campaign_id UUID,
  
  -- Previous Invite Info (if exists)
  previous_invite_id UUID REFERENCES linkedin_sent_invites(id),
  previous_invite_date TIMESTAMPTZ,
  previous_invite_status invite_status,
  days_since_last_invite INTEGER,
  
  -- Override Info
  admin_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_linkedin_sent_invites_user_profile ON linkedin_sent_invites(user_id, profile_slug);
CREATE INDEX idx_linkedin_sent_invites_date_sent ON linkedin_sent_invites(date_sent);
CREATE INDEX idx_linkedin_sent_invites_status ON linkedin_sent_invites(status);
CREATE INDEX idx_linkedin_sent_invites_campaign ON linkedin_sent_invites(campaign_id);
CREATE INDEX idx_linkedin_profile_cache_slug ON linkedin_profile_cache(profile_slug);
CREATE INDEX idx_linkedin_profile_cache_updated ON linkedin_profile_cache(last_updated);
CREATE INDEX idx_linkedin_profile_cache_expires ON linkedin_profile_cache(cache_expires_at);
CREATE INDEX idx_invite_deduplication_log_user ON invite_deduplication_log(user_id);
CREATE INDEX idx_invite_deduplication_log_profile ON invite_deduplication_log(profile_slug);
CREATE INDEX idx_invite_deduplication_log_decision ON invite_deduplication_log(decision);

-- View: User Invite History
-- Consolidated view of user's invitation history with profile data
CREATE VIEW user_invite_history AS
SELECT 
  si.user_id,
  si.profile_url,
  si.profile_slug,
  si.date_sent,
  si.status,
  si.message_content,
  si.campaign_id,
  si.source,
  si.accepted_date,
  si.response_date,
  
  -- Profile info from cache
  pc.full_name,
  pc.headline,
  pc.company,
  pc.location,
  pc.is_connected,
  
  -- Calculated fields
  EXTRACT(days FROM (NOW() - si.date_sent)) as days_since_sent,
  CASE 
    WHEN si.status = 'accepted' THEN 'Connected'
    WHEN si.status = 'declined' THEN 'Declined'
    WHEN si.status = 'expired' THEN 'Expired'
    WHEN si.status = 'sent' AND EXTRACT(days FROM (NOW() - si.date_sent)) > 14 THEN 'Pending (Old)'
    WHEN si.status = 'sent' THEN 'Pending'
    ELSE INITCAP(si.status::text)
  END as status_display,
  
  -- Metrics
  si.created_at,
  si.updated_at

FROM linkedin_sent_invites si
LEFT JOIN linkedin_profile_cache pc ON si.profile_slug = pc.profile_slug
ORDER BY si.date_sent DESC;

-- View: Deduplication Status Check
-- Quick view for checking if a profile can be invited
CREATE VIEW invite_deduplication_status AS
SELECT DISTINCT ON (profile_slug)
  profile_slug,
  profile_url,
  user_id,
  status as last_invite_status,
  date_sent as last_invite_date,
  EXTRACT(days FROM (NOW() - date_sent)) as days_since_invite,
  
  -- Eligibility flags based on default rules
  CASE 
    WHEN status = 'sent' AND EXTRACT(days FROM (NOW() - date_sent)) < 14 THEN FALSE
    WHEN status = 'declined' AND EXTRACT(days FROM (NOW() - date_sent)) < 180 THEN FALSE
    WHEN status = 'blocked' THEN FALSE
    WHEN status IN ('accepted', 'withdrawn', 'expired') AND EXTRACT(days FROM (NOW() - date_sent)) < 90 THEN FALSE
    ELSE TRUE
  END as can_reinvite_default,
  
  CASE 
    WHEN status = 'sent' AND EXTRACT(days FROM (NOW() - date_sent)) < 14 THEN 'Recent invitation pending'
    WHEN status = 'declined' AND EXTRACT(days FROM (NOW() - date_sent)) < 180 THEN 'Recently declined'
    WHEN status = 'blocked' THEN 'Profile blocked invitations'
    WHEN status = 'accepted' THEN 'Already connected'
    WHEN status = 'withdrawn' AND EXTRACT(days FROM (NOW() - date_sent)) < 90 THEN 'Recently withdrawn'
    WHEN status = 'expired' AND EXTRACT(days FROM (NOW() - date_sent)) < 90 THEN 'Recently expired'
    ELSE 'Available for invitation'
  END as eligibility_reason

FROM linkedin_sent_invites
ORDER BY profile_slug, date_sent DESC;

-- Function: Check Invite Eligibility
-- Determines if a user can send an invite to a profile
CREATE OR REPLACE FUNCTION check_invite_eligibility(
  p_user_id UUID,
  p_profile_url TEXT,
  p_source TEXT DEFAULT 'manual',
  p_admin_override BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  previous_invite_date TIMESTAMPTZ,
  previous_status invite_status,
  days_since_last INTEGER,
  rule_applied TEXT
) AS $$
DECLARE
  profile_slug_normalized TEXT;
  previous_invite RECORD;
  dedup_rule RECORD;
  decision_reason TEXT;
  is_allowed BOOLEAN := TRUE;
  rule_name TEXT := 'default';
BEGIN
  -- Normalize profile URL to slug
  profile_slug_normalized := LOWER(TRIM(REPLACE(REPLACE(REPLACE(p_profile_url, 'https://www.linkedin.com/in/', ''), 'https://linkedin.com/in/', ''), '/', '')));
  
  -- Get previous invite if exists
  SELECT * INTO previous_invite
  FROM linkedin_sent_invites 
  WHERE user_id = p_user_id AND profile_slug = profile_slug_normalized
  ORDER BY date_sent DESC
  LIMIT 1;
  
  -- If no previous invite, allow
  IF previous_invite.id IS NULL THEN
    RETURN QUERY SELECT TRUE, 'No previous invitation found'::TEXT, NULL::TIMESTAMPTZ, NULL::invite_status, NULL::INTEGER, 'no_previous_invite'::TEXT;
    RETURN;
  END IF;
  
  -- Admin override bypasses all rules
  IF p_admin_override THEN
    RETURN QUERY SELECT TRUE, 'Admin override applied'::TEXT, previous_invite.date_sent, previous_invite.status, EXTRACT(days FROM (NOW() - previous_invite.date_sent))::INTEGER, 'admin_override'::TEXT;
    RETURN;
  END IF;
  
  -- Get applicable deduplication rule
  SELECT * INTO dedup_rule
  FROM invite_deduplication_rules
  WHERE is_active = TRUE
    AND (applies_to_sources IS NULL OR p_source = ANY(applies_to_sources))
  ORDER BY priority DESC
  LIMIT 1;
  
  -- Use default rule if none found
  IF dedup_rule.id IS NULL THEN
    dedup_rule.min_days_between_invites := 90;
    dedup_rule.allow_reinvite_after_decline := FALSE;
    dedup_rule.allow_reinvite_after_expire := TRUE;
    dedup_rule.allow_reinvite_after_withdraw := TRUE;
    rule_name := 'default';
  ELSE
    rule_name := dedup_rule.rule_name;
  END IF;
  
  -- Calculate days since last invite
  DECLARE
    days_since INTEGER := EXTRACT(days FROM (NOW() - previous_invite.date_sent));
  BEGIN
    -- Apply status-specific rules
    CASE previous_invite.status
      WHEN 'sent' THEN
        IF days_since < 14 THEN
          is_allowed := FALSE;
          decision_reason := 'Recent invitation still pending (wait 14 days)';
        END IF;
      WHEN 'declined' THEN
        IF NOT dedup_rule.allow_reinvite_after_decline THEN
          is_allowed := FALSE;
          decision_reason := 'Profile declined previous invitation';
        ELSIF days_since < COALESCE(dedup_rule.cooldown_after_decline_days, 180) THEN
          is_allowed := FALSE;
          decision_reason := format('Recently declined (%s days ago, wait %s days)', days_since, dedup_rule.cooldown_after_decline_days);
        END IF;
      WHEN 'blocked' THEN
        is_allowed := FALSE;
        decision_reason := 'Profile has blocked invitations';
      WHEN 'accepted' THEN
        is_allowed := FALSE;
        decision_reason := 'Already connected to this profile';
      WHEN 'expired' THEN
        IF NOT dedup_rule.allow_reinvite_after_expire THEN
          is_allowed := FALSE;
          decision_reason := 'Previous invitation expired';
        ELSIF days_since < COALESCE(dedup_rule.cooldown_after_expire_days, 60) THEN
          is_allowed := FALSE;
          decision_reason := format('Recently expired (%s days ago, wait %s days)', days_since, dedup_rule.cooldown_after_expire_days);
        END IF;
      WHEN 'withdrawn' THEN
        IF NOT dedup_rule.allow_reinvite_after_withdraw THEN
          is_allowed := FALSE;
          decision_reason := 'Previous invitation was withdrawn';
        ELSIF days_since < dedup_rule.min_days_between_invites THEN
          is_allowed := FALSE;
          decision_reason := format('Recently withdrawn (%s days ago, wait %s days)', days_since, dedup_rule.min_days_between_invites);
        END IF;
      ELSE
        -- General time-based check
        IF days_since < dedup_rule.min_days_between_invites THEN
          is_allowed := FALSE;
          decision_reason := format('Too soon since last invite (%s days ago, wait %s days)', days_since, dedup_rule.min_days_between_invites);
        END IF;
    END CASE;
    
    -- If allowed, set success reason
    IF is_allowed THEN
      decision_reason := format('Eligible for invitation (%s days since last %s)', days_since, previous_invite.status);
    END IF;
    
    -- Return result
    RETURN QUERY SELECT is_allowed, decision_reason, previous_invite.date_sent, previous_invite.status, days_since, rule_name;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function: Record Sent Invite
-- Records a successful invitation in the deduplication table
CREATE OR REPLACE FUNCTION record_sent_invite(
  p_user_id UUID,
  p_profile_url TEXT,
  p_message_content TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
  invite_id UUID;
  profile_slug_normalized TEXT;
BEGIN
  -- Normalize profile URL to slug
  profile_slug_normalized := LOWER(TRIM(REPLACE(REPLACE(REPLACE(p_profile_url, 'https://www.linkedin.com/in/', ''), 'https://linkedin.com/in/', ''), '/', '')));
  
  -- Insert the sent invite record
  INSERT INTO linkedin_sent_invites (
    user_id,
    profile_url,
    message_content,
    campaign_id,
    job_id,
    source,
    status,
    date_sent
  ) VALUES (
    p_user_id,
    p_profile_url,
    p_message_content,
    p_campaign_id,
    p_job_id,
    p_source,
    'sent',
    NOW()
  )
  ON CONFLICT (user_id, profile_slug) DO UPDATE SET
    message_content = EXCLUDED.message_content,
    campaign_id = EXCLUDED.campaign_id,
    job_id = EXCLUDED.job_id,
    source = EXCLUDED.source,
    status = 'sent',
    date_sent = NOW(),
    updated_at = NOW()
  RETURNING id INTO invite_id;
  
  -- Update profile cache total invites
  INSERT INTO linkedin_profile_cache (profile_url, total_invites_sent, last_contacted_at)
  VALUES (p_profile_url, 1, NOW())
  ON CONFLICT (profile_url) DO UPDATE SET
    total_invites_sent = linkedin_profile_cache.total_invites_sent + 1,
    last_contacted_at = NOW(),
    last_updated = NOW();
  
  RETURN invite_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update Invite Status
-- Updates the status of an existing invitation
CREATE OR REPLACE FUNCTION update_invite_status(
  p_user_id UUID,
  p_profile_url TEXT,
  p_new_status invite_status,
  p_response_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
  profile_slug_normalized TEXT;
  updated_count INTEGER;
BEGIN
  -- Normalize profile URL to slug
  profile_slug_normalized := LOWER(TRIM(REPLACE(REPLACE(REPLACE(p_profile_url, 'https://www.linkedin.com/in/', ''), 'https://linkedin.com/in/', ''), '/', '')));
  
  -- Update the invite status
  UPDATE linkedin_sent_invites 
  SET 
    status = p_new_status,
    response_date = p_response_date,
    accepted_date = CASE WHEN p_new_status = 'accepted' THEN p_response_date ELSE accepted_date END,
    last_status_check = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id AND profile_slug = profile_slug_normalized;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Update profile cache if invite was accepted
  IF p_new_status = 'accepted' THEN
    UPDATE linkedin_profile_cache
    SET 
      is_connected = TRUE,
      connection_date = p_response_date,
      connection_source = 'linkedin_invite',
      last_updated = NOW()
    WHERE profile_slug = profile_slug_normalized;
  END IF;
  
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE linkedin_sent_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profile_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_deduplication_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_deduplication_log ENABLE ROW LEVEL SECURITY;

-- Users can only access their own invite data
CREATE POLICY "Users can view own sent invites" ON linkedin_sent_invites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view cached profiles they've interacted with" ON linkedin_profile_cache
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM linkedin_sent_invites WHERE user_id = auth.uid() AND profile_slug = linkedin_profile_cache.profile_slug)
  );

CREATE POLICY "Users can view own deduplication logs" ON invite_deduplication_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all data
CREATE POLICY "Service role can manage sent invites" ON linkedin_sent_invites
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage profile cache" ON linkedin_profile_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage deduplication rules" ON invite_deduplication_rules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage deduplication logs" ON invite_deduplication_log
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON linkedin_sent_invites TO service_role;
GRANT ALL ON linkedin_profile_cache TO service_role;
GRANT ALL ON invite_deduplication_rules TO service_role;
GRANT ALL ON invite_deduplication_log TO service_role;
GRANT SELECT ON user_invite_history TO service_role;
GRANT SELECT ON invite_deduplication_status TO service_role;

-- Insert default deduplication rule
INSERT INTO invite_deduplication_rules (
  rule_name,
  is_active,
  priority,
  min_days_between_invites,
  max_invites_per_profile,
  cooldown_after_decline_days,
  cooldown_after_expire_days,
  allow_reinvite_after_withdraw,
  allow_reinvite_after_expire,
  allow_reinvite_after_decline,
  block_after_multiple_declines,
  respect_campaign_rules,
  different_message_required,
  admin_override_allowed
) VALUES (
  'Default Deduplication Rule',
  TRUE,
  5,
  90,   -- 90 days minimum between invites
  1,    -- Max 1 invite per profile
  180,  -- 180 days after decline
  60,   -- 60 days after expire
  TRUE, -- Allow after withdraw
  TRUE, -- Allow after expire
  FALSE, -- Don't allow after decline
  TRUE, -- Block after multiple declines
  TRUE, -- Respect campaign rules
  TRUE, -- Different message required
  TRUE  -- Admin override allowed
);

-- Comments
COMMENT ON TABLE linkedin_sent_invites IS 'Core deduplication table tracking all sent LinkedIn invitations';
COMMENT ON TABLE linkedin_profile_cache IS 'Cached LinkedIn profile information to avoid repeated lookups';
COMMENT ON TABLE invite_deduplication_rules IS 'Configurable rules for when to allow/block repeat invitations';
COMMENT ON TABLE invite_deduplication_log IS 'Detailed audit log of all deduplication decisions';
COMMENT ON VIEW user_invite_history IS 'Consolidated view of user invitation history with profile data';
COMMENT ON VIEW invite_deduplication_status IS 'Quick eligibility check for profile invitations';
COMMENT ON FUNCTION check_invite_eligibility IS 'Determines if a user can send an invite to a profile based on rules';
COMMENT ON FUNCTION record_sent_invite IS 'Records a successful invitation in the deduplication system';
COMMENT ON FUNCTION update_invite_status IS 'Updates the status of an existing invitation (accepted, declined, etc)'; 