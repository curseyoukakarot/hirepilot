-- Super Admin Dashboard Migration (Prompt 7)
-- Add admin controls and monitoring capabilities for Puppet system

-- Add system-wide control flags to a new admin table
CREATE TABLE IF NOT EXISTS puppet_admin_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Emergency Controls
  puppet_shutdown_mode BOOLEAN DEFAULT FALSE,
  shutdown_reason TEXT,
  shutdown_initiated_by UUID REFERENCES auth.users(id),
  shutdown_initiated_at TIMESTAMPTZ,
  
  -- System Settings
  max_concurrent_jobs INTEGER DEFAULT 10,
  global_rate_limit_per_hour INTEGER DEFAULT 100,
  emergency_contact_email TEXT,
  
  -- Maintenance Mode
  maintenance_mode BOOLEAN DEFAULT FALSE,
  maintenance_message TEXT,
  maintenance_scheduled_until TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin controls record
INSERT INTO puppet_admin_controls (
  puppet_shutdown_mode,
  max_concurrent_jobs,
  global_rate_limit_per_hour,
  maintenance_mode
) VALUES (
  FALSE,
  10,
  100,
  FALSE
) ON CONFLICT DO NOTHING;

-- Add admin fields to existing tables for better monitoring
ALTER TABLE puppet_jobs
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS paused_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paused_by_admin_user UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_retry_count INTEGER DEFAULT 0;

ALTER TABLE puppet_user_settings
ADD COLUMN IF NOT EXISTS admin_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_paused_reason TEXT,
ADD COLUMN IF NOT EXISTS admin_paused_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS admin_paused_at TIMESTAMPTZ;

-- Create admin activity log for tracking admin actions
CREATE TABLE IF NOT EXISTS puppet_admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Action Details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'job_retry',
    'job_kill',
    'user_pause',
    'user_unpause',
    'emergency_shutdown',
    'shutdown_disable',
    'maintenance_enable',
    'maintenance_disable',
    'proxy_manage',
    'bulk_action'
  )),
  action_description TEXT NOT NULL,
  
  -- Target Details
  target_job_id UUID REFERENCES puppet_jobs(id),
  target_user_id UUID REFERENCES auth.users(id),
  target_proxy_id UUID REFERENCES puppet_proxies(id),
  
  -- Action Results
  action_successful BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin stats view for dashboard
CREATE OR REPLACE VIEW puppet_admin_dashboard_stats AS
SELECT
  -- Today's Stats
  (SELECT COUNT(*) FROM puppet_jobs 
   WHERE created_at >= CURRENT_DATE) AS jobs_today,
  (SELECT COUNT(*) FROM puppet_jobs 
   WHERE created_at >= CURRENT_DATE AND status = 'completed') AS jobs_completed_today,
  (SELECT COUNT(*) FROM puppet_jobs 
   WHERE created_at >= CURRENT_DATE AND status = 'failed') AS jobs_failed_today,
  (SELECT COUNT(*) FROM puppet_jobs 
   WHERE created_at >= CURRENT_DATE AND status = 'warning') AS jobs_warned_today,
   
  -- This Week's Stats
  (SELECT COUNT(*) FROM puppet_jobs 
   WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) AS jobs_this_week,
  (SELECT SUM(connections_sent) FROM puppet_daily_stats 
   WHERE stat_date >= DATE_TRUNC('week', CURRENT_DATE)::date) AS connections_this_week,
   
  -- Active Users & Jobs
  (SELECT COUNT(*) FROM puppet_jobs WHERE status IN ('pending', 'running')) AS active_jobs,
  (SELECT COUNT(DISTINCT user_id) FROM puppet_user_settings 
   WHERE rex_auto_mode_enabled = true) AS users_with_auto_mode,
  (SELECT COUNT(DISTINCT user_id) FROM puppet_user_settings 
   WHERE admin_paused = true) AS users_paused_by_admin,
   
  -- Proxy Stats
  (SELECT COUNT(*) FROM puppet_proxies WHERE status = 'active') AS active_proxies,
  (SELECT COUNT(*) FROM puppet_proxies WHERE status = 'failed') AS failed_proxies,
  (SELECT COUNT(*) FROM puppet_proxies WHERE status = 'banned') AS banned_proxies,
  
  -- Error Trends
  (SELECT COUNT(*) FROM puppet_daily_stats 
   WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days' AND captcha_detections > 0) AS captcha_incidents_week,
  (SELECT COUNT(*) FROM puppet_daily_stats 
   WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days' AND security_warnings > 0) AS security_incidents_week,
   
  -- System Status
  (SELECT puppet_shutdown_mode FROM puppet_admin_controls LIMIT 1) AS shutdown_mode_active,
  (SELECT maintenance_mode FROM puppet_admin_controls LIMIT 1) AS maintenance_mode_active;

-- Create detailed job view for admin dashboard
CREATE OR REPLACE VIEW puppet_admin_job_details AS
SELECT 
  j.id,
  j.user_id,
  u.email as user_email,
  j.linkedin_profile_url,
  j.message,
  j.status,
  j.priority,
  j.scheduled_at,
  j.started_at,
  j.completed_at,
  j.retry_count,
  j.admin_retry_count,
  j.max_retries,
  j.error_message,
  j.detection_type,
  j.admin_notes,
  j.paused_by_admin,
  j.created_at,
  j.updated_at,
  
  -- User Settings
  us.rex_auto_mode_enabled,
  us.daily_connection_limit,
  us.admin_paused as user_admin_paused,
  us.admin_paused_reason,
  
  -- Proxy Info
  p.proxy_provider,
  p.proxy_endpoint,
  p.proxy_location,
  p.status as proxy_status,
  
  -- Daily Stats
  ds.connections_sent as user_connections_today,
  ds.captcha_detections as user_captcha_today,
  
  -- Execution Time
  CASE 
    WHEN j.started_at IS NOT NULL AND j.completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (j.completed_at - j.started_at))
    ELSE NULL 
  END as execution_time_seconds

FROM puppet_jobs j
LEFT JOIN auth.users u ON j.user_id = u.id
LEFT JOIN puppet_user_settings us ON j.user_id = us.user_id  
LEFT JOIN puppet_proxies p ON us.proxy_id = p.id
LEFT JOIN puppet_daily_stats ds ON j.user_id = ds.user_id AND ds.stat_date = CURRENT_DATE;

-- Create user performance view for admin dashboard
CREATE OR REPLACE VIEW puppet_admin_user_performance AS
SELECT 
  u.id as user_id,
  u.email,
  us.rex_auto_mode_enabled,
  us.daily_connection_limit,
  us.admin_paused,
  us.admin_paused_reason,
  us.automation_consent,
  
  -- Today's Performance
  COALESCE(ds_today.connections_sent, 0) as connections_today,
  COALESCE(ds_today.jobs_completed, 0) as jobs_completed_today,
  COALESCE(ds_today.jobs_failed, 0) as jobs_failed_today,
  COALESCE(ds_today.captcha_detections, 0) as captcha_today,
  
  -- This Week's Performance  
  COALESCE(week_stats.connections_this_week, 0) as connections_this_week,
  COALESCE(week_stats.jobs_this_week, 0) as jobs_this_week,
  
  -- Current Active Jobs
  COALESCE(active_jobs.active_count, 0) as active_jobs_count,
  COALESCE(pending_jobs.pending_count, 0) as pending_jobs_count,
  
  -- Proxy Assignment
  p.proxy_provider,
  p.proxy_location,
  p.status as proxy_status,
  
  -- Last Activity
  us.last_manual_review_at,
  (SELECT MAX(created_at) FROM puppet_jobs WHERE user_id = u.id) as last_job_created

FROM auth.users u
LEFT JOIN puppet_user_settings us ON u.id = us.user_id
LEFT JOIN puppet_proxies p ON us.proxy_id = p.id
LEFT JOIN puppet_daily_stats ds_today ON u.id = ds_today.user_id AND ds_today.stat_date = CURRENT_DATE
LEFT JOIN (
  SELECT user_id, 
         SUM(connections_sent) as connections_this_week,
         SUM(jobs_completed + jobs_failed + jobs_warned) as jobs_this_week
  FROM puppet_daily_stats 
  WHERE stat_date >= DATE_TRUNC('week', CURRENT_DATE)::date
  GROUP BY user_id
) week_stats ON u.id = week_stats.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as active_count
  FROM puppet_jobs 
  WHERE status IN ('running', 'queued')
  GROUP BY user_id
) active_jobs ON u.id = active_jobs.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as pending_count
  FROM puppet_jobs 
  WHERE status = 'pending'
  GROUP BY user_id
) pending_jobs ON u.id = pending_jobs.user_id
WHERE us.user_id IS NOT NULL -- Only users with Puppet settings
ORDER BY connections_today DESC, connections_this_week DESC;

-- Indexes for admin dashboard performance
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_admin_monitoring ON puppet_jobs(status, created_at, user_id);
CREATE INDEX IF NOT EXISTS idx_puppet_jobs_admin_user_status ON puppet_jobs(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_puppet_admin_log_action_type ON puppet_admin_log(action_type, created_at);
CREATE INDEX IF NOT EXISTS idx_puppet_admin_log_admin_user ON puppet_admin_log(admin_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_puppet_user_settings_admin_paused ON puppet_user_settings(admin_paused);

-- Enable RLS for admin tables
ALTER TABLE puppet_admin_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE puppet_admin_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin tables (super admin only)
CREATE POLICY "Super admins can manage admin controls"
  ON puppet_admin_controls
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

CREATE POLICY "Super admins can view admin logs"
  ON puppet_admin_log 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert admin logs"
  ON puppet_admin_log 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Function to get current system status
CREATE OR REPLACE FUNCTION get_puppet_system_status()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'shutdown_mode', puppet_shutdown_mode,
    'maintenance_mode', maintenance_mode,
    'shutdown_reason', shutdown_reason,
    'shutdown_initiated_at', shutdown_initiated_at,
    'maintenance_message', maintenance_message,
    'max_concurrent_jobs', max_concurrent_jobs,
    'global_rate_limit_per_hour', global_rate_limit_per_hour
  ) INTO result
  FROM puppet_admin_controls 
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle emergency shutdown
CREATE OR REPLACE FUNCTION toggle_puppet_emergency_shutdown(
  enable_shutdown BOOLEAN,
  reason TEXT DEFAULT NULL,
  admin_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Update admin controls
  UPDATE puppet_admin_controls 
  SET 
    puppet_shutdown_mode = enable_shutdown,
    shutdown_reason = CASE WHEN enable_shutdown THEN reason ELSE NULL END,
    shutdown_initiated_by = CASE WHEN enable_shutdown THEN admin_user_id ELSE NULL END,
    shutdown_initiated_at = CASE WHEN enable_shutdown THEN NOW() ELSE NULL END,
    updated_at = NOW();
  
  -- Log admin action
  INSERT INTO puppet_admin_log (
    admin_user_id,
    action_type,
    action_description,
    metadata
  ) VALUES (
    COALESCE(admin_user_id, auth.uid()),
    CASE WHEN enable_shutdown THEN 'emergency_shutdown' ELSE 'shutdown_disable' END,
    CASE 
      WHEN enable_shutdown THEN 'Emergency shutdown activated: ' || COALESCE(reason, 'No reason provided')
      ELSE 'Emergency shutdown deactivated'
    END,
    jsonb_build_object(
      'shutdown_mode', enable_shutdown,
      'reason', reason,
      'timestamp', NOW()
    )
  );
  
  -- Return current status
  SELECT jsonb_build_object(
    'success', true,
    'shutdown_mode', enable_shutdown,
    'reason', reason,
    'message', CASE 
      WHEN enable_shutdown THEN 'Emergency shutdown activated'
      ELSE 'Emergency shutdown deactivated'
    END
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE puppet_admin_controls IS 'System-wide admin controls for Puppet LinkedIn automation';
COMMENT ON TABLE puppet_admin_log IS 'Audit log for all admin actions on Puppet system';
COMMENT ON VIEW puppet_admin_dashboard_stats IS 'Comprehensive stats for admin dashboard';
COMMENT ON VIEW puppet_admin_job_details IS 'Detailed job view with user and proxy information for admin monitoring';
COMMENT ON VIEW puppet_admin_user_performance IS 'User performance metrics for admin dashboard';

COMMENT ON COLUMN puppet_admin_controls.puppet_shutdown_mode IS 'Emergency kill switch to stop all job runners';
COMMENT ON COLUMN puppet_admin_controls.maintenance_mode IS 'Maintenance mode to pause new job creation';
COMMENT ON COLUMN puppet_jobs.paused_by_admin IS 'Whether this job was paused by admin action';
COMMENT ON COLUMN puppet_user_settings.admin_paused IS 'Whether this user was paused by admin action'; 