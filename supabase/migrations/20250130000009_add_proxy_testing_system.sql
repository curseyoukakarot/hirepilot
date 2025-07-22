-- Proxy Testing System
-- Adds comprehensive proxy testing capabilities with history tracking

-- Add testing columns to existing proxy_pool table
ALTER TABLE proxy_pool 
ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_test_success BOOLEAN;

-- Proxy Test History Table
-- Tracks all proxy test attempts with detailed results
CREATE TABLE IF NOT EXISTS proxy_test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test Reference
  proxy_id UUID REFERENCES proxy_pool(id) ON DELETE CASCADE NOT NULL,
  
  -- Test Details
  test_type TEXT DEFAULT 'linkedin_access' NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  
  -- Error Information
  error_type TEXT, -- 'timeout', 'blocked', 'network_error', 'captcha', 'banned', 'other'
  error_message TEXT,
  
  -- Test Results
  test_details JSONB DEFAULT '{}', -- Page title, final URL, IP address, etc.
  
  -- Timing
  tested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Metadata
  tested_by UUID, -- Admin who initiated the test
  test_context TEXT DEFAULT 'manual' -- 'manual', 'scheduled', 'health_check', 'batch'
);

-- Proxy Statistics View
-- Aggregated statistics for admin dashboard
CREATE OR REPLACE VIEW proxy_statistics AS
WITH provider_counts AS (
  SELECT 
    provider,
    COUNT(*) as count
  FROM proxy_pool
  WHERE provider IS NOT NULL
  GROUP BY provider
),
region_counts AS (
  SELECT 
    COALESCE(country_code, 'unknown') as region,
    COUNT(*) as count
  FROM proxy_pool
  GROUP BY COALESCE(country_code, 'unknown')
)
SELECT 
  -- Overall counts
  COUNT(*) as total_proxies,
  COUNT(*) FILTER (WHERE status = 'active') as active_proxies,
  COUNT(*) FILTER (WHERE status = 'inactive') as inactive_proxies,
  COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_proxies,
  COUNT(*) FILTER (WHERE status = 'banned') as banned_proxies,
  
  -- Provider breakdown (as JSON)
  (
    SELECT json_object_agg(provider, count)
    FROM provider_counts
  ) as proxies_by_provider,
  
  -- Region breakdown (as JSON)
  (
    SELECT json_object_agg(region, count)
    FROM region_counts
  ) as proxies_by_region,
  
  -- Health metrics
  AVG(global_success_count::DECIMAL / NULLIF(global_success_count + global_failure_count, 0) * 100) as avg_success_rate,
  SUM(global_success_count) as total_successes,
  SUM(global_failure_count) as total_failures,
  
  -- Recent activity
  COUNT(*) FILTER (WHERE last_success_at > NOW() - INTERVAL '24 hours') as active_in_24h,
  COUNT(*) FILTER (WHERE last_tested_at > NOW() - INTERVAL '24 hours') as tested_in_24h,
  COUNT(*) FILTER (WHERE last_test_success = true) as last_test_passed,
  COUNT(*) FILTER (WHERE last_test_success = false) as last_test_failed,
  
  -- Assignments
  COUNT(*) FILTER (WHERE in_use = true) as proxies_in_use,
  COUNT(*) FILTER (WHERE in_use = false) as proxies_available,
  
  -- Performance
  (SELECT id FROM proxy_pool WHERE global_success_count > 0 ORDER BY global_success_count DESC LIMIT 1) as top_performing_proxy,
  (SELECT id FROM proxy_pool WHERE global_failure_count > 0 ORDER BY global_failure_count DESC LIMIT 1) as worst_performing_proxy
  
FROM proxy_pool;

-- Proxy Management View
-- Complete proxy information for admin interface
CREATE OR REPLACE VIEW proxy_management_view AS
SELECT 
  p.id,
  p.provider,
  p.endpoint,
  p.country_code,
  p.region,
  p.city,
  p.proxy_type,
  p.status,
  p.max_concurrent_users,
  p.in_use,
  
  -- Health metrics
  p.global_success_count,
  p.global_failure_count,
  CASE 
    WHEN p.global_success_count + p.global_failure_count = 0 THEN NULL
    ELSE ROUND((p.global_success_count::DECIMAL / (p.global_success_count + p.global_failure_count)) * 100, 2)
  END as success_rate_percent,
  
  -- Recent activity
  p.last_success_at,
  p.last_failure_at,
  p.last_tested_at,
  p.last_test_success,
  
  -- Current assignments
  (
    SELECT COUNT(*)
    FROM user_proxy_assignments upa
    WHERE upa.proxy_id = p.id AND upa.active = true
  ) as current_assignments,
  
  -- Assigned users (comma-separated emails for display)
  (
    SELECT string_agg(u.email, ', ')
    FROM user_proxy_assignments upa
    JOIN auth.users u ON upa.user_id = u.id
    WHERE upa.proxy_id = p.id AND upa.active = true
  ) as assigned_users,
  
  -- Recent test results
  (
    SELECT json_agg(
      json_build_object(
        'tested_at', pth.tested_at,
        'success', pth.success,
        'response_time_ms', pth.response_time_ms,
        'error_type', pth.error_type
      ) ORDER BY pth.tested_at DESC
    )
    FROM proxy_test_history pth
    WHERE pth.proxy_id = p.id
    LIMIT 5
  ) as recent_test_results,
  
  -- Health status for UI
  CASE 
    WHEN p.status != 'active' THEN 'inactive'
    WHEN p.last_test_success = false THEN 'warning'
    WHEN p.global_failure_count > p.global_success_count THEN 'warning'
    ELSE 'healthy'
  END as health_status,
  
  -- Audit
  p.created_at,
  p.updated_at
  
FROM proxy_pool p
ORDER BY p.created_at DESC;

-- Function: Get Proxy Test Summary
-- Returns aggregated test statistics for a proxy
CREATE OR REPLACE FUNCTION get_proxy_test_summary(p_proxy_id UUID)
RETURNS TABLE (
  total_tests INTEGER,
  successful_tests INTEGER,
  failed_tests INTEGER,
  success_rate DECIMAL,
  avg_response_time INTEGER,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  common_error_types JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_tests,
    COUNT(*) FILTER (WHERE pth.success = true)::INTEGER as successful_tests,
    COUNT(*) FILTER (WHERE pth.success = false)::INTEGER as failed_tests,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE pth.success = true)::DECIMAL / COUNT(*)) * 100, 2)
    END as success_rate,
    AVG(pth.response_time_ms)::INTEGER as avg_response_time,
    MAX(pth.tested_at) as last_test_at,
    (SELECT pth2.success FROM proxy_test_history pth2 WHERE pth2.proxy_id = p_proxy_id ORDER BY pth2.tested_at DESC LIMIT 1) as last_test_success,
    (
      SELECT jsonb_object_agg(error_type, error_count)
      FROM (
        SELECT 
          pth3.error_type,
          COUNT(*) as error_count
        FROM proxy_test_history pth3
        WHERE pth3.proxy_id = p_proxy_id AND pth3.error_type IS NOT NULL
        GROUP BY pth3.error_type
        ORDER BY error_count DESC
        LIMIT 5
      ) error_summary
    ) as common_error_types
  FROM proxy_test_history pth
  WHERE pth.proxy_id = p_proxy_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Cleanup Old Test History
-- Removes test history older than specified days (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_proxy_test_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM proxy_test_history
  WHERE tested_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_proxy_id ON proxy_test_history(proxy_id);
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_tested_at ON proxy_test_history(tested_at);
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_success ON proxy_test_history(success);
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_error_type ON proxy_test_history(error_type);

-- Index on proxy_pool for testing columns
CREATE INDEX IF NOT EXISTS idx_proxy_pool_last_tested ON proxy_pool(last_tested_at);
CREATE INDEX IF NOT EXISTS idx_proxy_pool_test_success ON proxy_pool(last_test_success);

-- RLS Policies
ALTER TABLE proxy_test_history ENABLE ROW LEVEL SECURITY;

-- Admin can manage all proxy test history
CREATE POLICY "Admins can manage proxy test history" ON proxy_test_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.role IN ('super_admin', 'admin')
    )
  );

-- Service role can manage all test history
CREATE POLICY "Service role can manage proxy test history" ON proxy_test_history
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON proxy_test_history TO service_role;
GRANT SELECT ON proxy_statistics TO service_role;
GRANT SELECT ON proxy_management_view TO service_role;

-- Comments
COMMENT ON TABLE proxy_test_history IS 'Historical record of proxy testing attempts with detailed results';
COMMENT ON VIEW proxy_statistics IS 'Aggregated proxy statistics for admin dashboard';
COMMENT ON VIEW proxy_management_view IS 'Complete proxy information for admin management interface';
COMMENT ON FUNCTION get_proxy_test_summary IS 'Returns aggregated test statistics for a specific proxy';
COMMENT ON FUNCTION cleanup_proxy_test_history IS 'Removes old test history records for maintenance'; 