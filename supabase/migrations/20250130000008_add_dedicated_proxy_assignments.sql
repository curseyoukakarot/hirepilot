-- Dedicated Proxy Assignment System
-- Assigns each user a dedicated residential proxy from the proxy pool

-- Add in_use column to existing proxy_pool table if it doesn't exist
ALTER TABLE proxy_pool ADD COLUMN IF NOT EXISTS in_use BOOLEAN DEFAULT FALSE;

-- Dedicated User Proxy Assignments Table
-- Simple mapping of users to their dedicated proxies
CREATE TABLE IF NOT EXISTS user_proxy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and Proxy
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  proxy_id UUID REFERENCES proxy_pool(id) ON DELETE SET NULL NOT NULL,
  
  -- Assignment Status
  active BOOLEAN DEFAULT TRUE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ,
  
  -- Performance Tracking (for this dedicated assignment)
  total_jobs_processed INTEGER DEFAULT 0,
  successful_jobs INTEGER DEFAULT 0,
  failed_jobs INTEGER DEFAULT 0,
  
  -- Assignment Context
  assignment_reason TEXT DEFAULT 'initial', -- 'initial', 'rotation', 'manual', 'auto_reassign'
  assigned_by UUID, -- Admin who made the assignment
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_proxy_assignments_user ON user_proxy_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_proxy_assignments_proxy ON user_proxy_assignments(proxy_id);
CREATE INDEX IF NOT EXISTS idx_user_proxy_assignments_active ON user_proxy_assignments(active) WHERE active = TRUE;

-- Partial unique index: one active assignment per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_proxy_assignments_unique_active_user 
ON user_proxy_assignments(user_id) WHERE active = TRUE;

-- Update proxy_pool index for in_use column
CREATE INDEX IF NOT EXISTS idx_proxy_pool_in_use ON proxy_pool(in_use, status);

-- View: Available Proxies for Assignment
-- Shows proxies that are available for new user assignments
CREATE OR REPLACE VIEW available_proxies_for_assignment AS
SELECT 
  p.*,
  COALESCE(assignment_count.active_assignments, 0) as current_assignments,
  CASE 
    WHEN p.max_concurrent_users > COALESCE(assignment_count.active_assignments, 0) THEN TRUE
    ELSE FALSE
  END as available_for_assignment
FROM proxy_pool p
LEFT JOIN (
  SELECT 
    proxy_id, 
    COUNT(*) as active_assignments
  FROM user_proxy_assignments 
  WHERE active = TRUE
  GROUP BY proxy_id
) assignment_count ON p.id = assignment_count.proxy_id
WHERE p.status = 'active'
ORDER BY assignment_count.active_assignments ASC, p.global_success_count DESC;

-- Function: Assign Proxy to User
-- Smart proxy assignment with load balancing and health consideration
CREATE OR REPLACE FUNCTION assign_proxy_to_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_assignment RECORD;
  best_proxy_id UUID;
  assignment_id UUID;
BEGIN
  -- Check if user already has an active proxy assignment
  SELECT * INTO existing_assignment
  FROM user_proxy_assignments
  WHERE user_id = p_user_id AND active = TRUE;
  
  -- If user already has an active assignment, return that proxy ID
  IF existing_assignment.proxy_id IS NOT NULL THEN
    -- Update last_used_at
    UPDATE user_proxy_assignments 
    SET 
      last_used_at = NOW(),
      updated_at = NOW()
    WHERE id = existing_assignment.id;
    
    RETURN existing_assignment.proxy_id;
  END IF;
  
  -- Find the best available proxy for assignment
  -- Priority: active status, available capacity, good health metrics, balanced load
  SELECT id INTO best_proxy_id
  FROM available_proxies_for_assignment
  WHERE 
    status = 'active' 
    AND available_for_assignment = TRUE
    AND (in_use = FALSE OR current_assignments < max_concurrent_users)
  ORDER BY 
    current_assignments ASC,           -- Prefer less loaded proxies
    global_success_count DESC,         -- Prefer proxies with good track record
    global_failure_count ASC,          -- Avoid problematic proxies
    created_at ASC                     -- Prefer older (more tested) proxies
  LIMIT 1;
  
  -- If no proxy found, return null
  IF best_proxy_id IS NULL THEN
    RAISE EXCEPTION 'No available proxy found for user %', p_user_id;
  END IF;
  
  -- Create the assignment
  INSERT INTO user_proxy_assignments (
    user_id,
    proxy_id,
    active,
    assignment_reason,
    assigned_at
  ) VALUES (
    p_user_id,
    best_proxy_id,
    TRUE,
    'initial',
    NOW()
  ) RETURNING id INTO assignment_id;
  
  -- Mark proxy as in use if this is the first assignment
  UPDATE proxy_pool 
  SET in_use = TRUE 
  WHERE id = best_proxy_id AND in_use = FALSE;
  
  -- Log the assignment
  INSERT INTO proxy_assignments (
    proxy_id,
    user_id,
    assignment_reason,
    assigned_at
  ) VALUES (
    best_proxy_id,
    p_user_id,
    'dedicated_assignment',
    NOW()
  );
  
  RETURN best_proxy_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get User's Dedicated Proxy
-- Returns the proxy details for a user's dedicated assignment
CREATE OR REPLACE FUNCTION get_user_proxy(p_user_id UUID)
RETURNS TABLE (
  proxy_id UUID,
  endpoint TEXT,
  port INTEGER,
  username TEXT,
  password TEXT,
  provider TEXT,
  country_code TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.endpoint,
    CASE 
      WHEN p.endpoint ~ ':\d+$' THEN 
        SPLIT_PART(p.endpoint, ':', 2)::INTEGER
      ELSE 
        8080 -- default port
    END as port,
    p.username,
    p.password,
    p.provider::TEXT,
    p.country_code,
    p.status::TEXT
  FROM user_proxy_assignments upa
  JOIN proxy_pool p ON upa.proxy_id = p.id
  WHERE upa.user_id = p_user_id 
    AND upa.active = TRUE 
    AND p.status = 'active'
  LIMIT 1;
  
  -- If no result found, try to assign a new proxy
  IF NOT FOUND THEN
    PERFORM assign_proxy_to_user(p_user_id);
    
    -- Return the newly assigned proxy
    RETURN QUERY
    SELECT 
      p.id,
      p.endpoint,
      CASE 
        WHEN p.endpoint ~ ':\d+$' THEN 
          SPLIT_PART(p.endpoint, ':', 2)::INTEGER
        ELSE 
          8080 -- default port
      END as port,
      p.username,
      p.password,
      p.provider::TEXT,
      p.country_code,
      p.status::TEXT
    FROM user_proxy_assignments upa
    JOIN proxy_pool p ON upa.proxy_id = p.id
    WHERE upa.user_id = p_user_id 
      AND upa.active = TRUE 
      AND p.status = 'active'
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Update Assignment Performance
-- Updates performance metrics for a user's proxy assignment
CREATE OR REPLACE FUNCTION update_assignment_performance(
  p_user_id UUID,
  p_was_successful BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE user_proxy_assignments
  SET 
    total_jobs_processed = total_jobs_processed + 1,
    successful_jobs = CASE WHEN p_was_successful THEN successful_jobs + 1 ELSE successful_jobs END,
    failed_jobs = CASE WHEN NOT p_was_successful THEN failed_jobs + 1 ELSE failed_jobs END,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id AND active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Reassign User Proxy
-- Assigns a new proxy to a user (for rotation or failure recovery)
CREATE OR REPLACE FUNCTION reassign_user_proxy(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'rotation'
)
RETURNS UUID AS $$
DECLARE
  old_proxy_id UUID;
  new_proxy_id UUID;
BEGIN
  -- Get current assignment
  SELECT proxy_id INTO old_proxy_id
  FROM user_proxy_assignments
  WHERE user_id = p_user_id AND active = TRUE;
  
  -- Deactivate current assignment
  UPDATE user_proxy_assignments
  SET 
    active = FALSE,
    updated_at = NOW()
  WHERE user_id = p_user_id AND active = TRUE;
  
  -- Check if old proxy can be marked as not in use
  UPDATE proxy_pool
  SET in_use = FALSE
  WHERE id = old_proxy_id
    AND NOT EXISTS (
      SELECT 1 FROM user_proxy_assignments 
      WHERE proxy_id = old_proxy_id AND active = TRUE
    );
  
  -- Find new proxy (excluding the old one)
  SELECT id INTO new_proxy_id
  FROM available_proxies_for_assignment
  WHERE 
    status = 'active' 
    AND available_for_assignment = TRUE
    AND id != COALESCE(old_proxy_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ORDER BY 
    current_assignments ASC,
    global_success_count DESC,
    global_failure_count ASC
  LIMIT 1;
  
  IF new_proxy_id IS NULL THEN
    RAISE EXCEPTION 'No alternative proxy available for user %', p_user_id;
  END IF;
  
  -- Create new assignment
  INSERT INTO user_proxy_assignments (
    user_id,
    proxy_id,
    active,
    assignment_reason,
    assigned_at
  ) VALUES (
    p_user_id,
    new_proxy_id,
    TRUE,
    p_reason,
    NOW()
  );
  
  -- Mark new proxy as in use
  UPDATE proxy_pool 
  SET in_use = TRUE 
  WHERE id = new_proxy_id;
  
  RETURN new_proxy_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE user_proxy_assignments ENABLE ROW LEVEL SECURITY;

-- Users can view their own proxy assignments
CREATE POLICY "Users can view own proxy assignments" ON user_proxy_assignments
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all assignments
CREATE POLICY "Service role can manage proxy assignments" ON user_proxy_assignments
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON user_proxy_assignments TO service_role;
GRANT SELECT ON available_proxies_for_assignment TO service_role;

-- Comments
COMMENT ON TABLE user_proxy_assignments IS 'Dedicated proxy assignments - one proxy per user for consistent automation';
COMMENT ON COLUMN user_proxy_assignments.active IS 'Only one active assignment per user allowed';
COMMENT ON FUNCTION assign_proxy_to_user IS 'Assigns the best available proxy to a user with load balancing';
COMMENT ON FUNCTION get_user_proxy IS 'Returns proxy details for user, auto-assigns if none exists';
COMMENT ON FUNCTION reassign_user_proxy IS 'Rotates user to a new proxy for health/performance reasons';
COMMENT ON VIEW available_proxies_for_assignment IS 'Shows proxies available for new user assignments with capacity info'; 