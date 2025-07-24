-- Migration: Add LinkedIn Cookies Table for Sales Navigator Authentication
-- This table stores encrypted LinkedIn cookies for authenticated scraping

-- Create linkedin_cookies table
CREATE TABLE IF NOT EXISTS linkedin_cookies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    encrypted_cookie TEXT NOT NULL,
    cookie_hash TEXT NOT NULL, -- For validation without decryption
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    valid BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    user_agent TEXT, -- Store user agent for consistency
    
    -- Foreign key constraint
    CONSTRAINT fk_linkedin_cookies_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_cookies_user_id ON linkedin_cookies(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_cookies_valid ON linkedin_cookies(valid) WHERE valid = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_cookies_expires_at ON linkedin_cookies(expires_at);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_linkedin_cookies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER linkedin_cookies_updated_at_trigger
    BEFORE UPDATE ON linkedin_cookies
    FOR EACH ROW
    EXECUTE FUNCTION update_linkedin_cookies_updated_at();

-- Add cookie_connection_status to users table for tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_connected_at TIMESTAMPTZ;

-- Add indexes for user linkedin connection status
CREATE INDEX IF NOT EXISTS idx_users_linkedin_connected ON users(linkedin_connected) WHERE linkedin_connected = true;

COMMENT ON TABLE linkedin_cookies IS 'Stores encrypted LinkedIn authentication cookies for Sales Navigator scraping';
COMMENT ON COLUMN linkedin_cookies.encrypted_cookie IS 'AES encrypted li_at cookie value';
COMMENT ON COLUMN linkedin_cookies.cookie_hash IS 'SHA-256 hash of cookie for validation without decryption';
COMMENT ON COLUMN linkedin_cookies.valid IS 'Whether the cookie is still valid for authentication';
COMMENT ON COLUMN linkedin_cookies.expires_at IS 'Estimated expiration time for the LinkedIn session'; 