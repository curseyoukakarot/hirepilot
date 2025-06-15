-- Add expiry tracking to linkedin_cookies
ALTER TABLE linkedin_cookies
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS proxy_id UUID REFERENCES user_proxies(user_id),
    ADD CONSTRAINT one_cookie_per_user UNIQUE (user_id);

-- Create index for faster expiry checks
CREATE INDEX IF NOT EXISTS idx_linkedin_cookies_expires ON linkedin_cookies(expires_at);

-- Add function to automatically mark expired cookies as stale
CREATE OR REPLACE FUNCTION mark_expired_cookies()
RETURNS void AS $$
BEGIN
    UPDATE linkedin_cookies
    SET status = 'stale'
    WHERE expires_at < NOW()
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Create user_proxies table for static proxy assignment
CREATE TABLE IF NOT EXISTS user_proxies (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    proxy_url TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create phantombuster_proxies table
CREATE TABLE IF NOT EXISTS phantombuster_proxies (
    proxy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_type TEXT NOT NULL, -- residential, mobile, internal
    proxy_location TEXT,
    proxy_address TEXT NOT NULL,
    proxy_username TEXT,
    proxy_password TEXT,
    is_static BOOLEAN NOT NULL DEFAULT true,
    assigned_to_account_id UUID REFERENCES users(id),
    last_used_at TIMESTAMPTZ
);

-- Create phantom_launch_queue table
CREATE TABLE IF NOT EXISTS phantom_launch_queue (
    queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES users(id),
    phantom_id TEXT,
    status TEXT NOT NULL, -- pending, running, completed, failed
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ
);

-- Create phantom_schedules table
CREATE TABLE IF NOT EXISTS phantom_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES users(id),
    phantom_id TEXT,
    runs_per_day INT NOT NULL DEFAULT 3,
    run_window_start TIME NOT NULL DEFAULT '09:00',
    run_window_end TIME NOT NULL DEFAULT '17:00',
    random_offset_minutes INT NOT NULL DEFAULT 30,
    last_run_at TIMESTAMPTZ
);

-- Create phantom_job_queue table
CREATE TABLE IF NOT EXISTS phantom_job_queue (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES phantom_schedules(schedule_id),
    account_id UUID REFERENCES users(id),
    phantom_id TEXT,
    next_run_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create phantom_health_logs table
CREATE TABLE IF NOT EXISTS phantom_health_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES users(id),
    phantom_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL, -- ok, warning, error, cookie_expired, captcha, login_challenge
    message TEXT,
    severity TEXT NOT NULL, -- low, medium, high
    phantom_run_id UUID
);

-- Add cooldown fields to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_in_cooldown BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ; 