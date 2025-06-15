-- Create Gmail tokens table
CREATE TABLE IF NOT EXISTS gmail_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Gmail notifications table
CREATE TABLE IF NOT EXISTS gmail_notifications (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    watch_expiration TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Outlook tokens table
CREATE TABLE IF NOT EXISTS outlook_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Outlook subscriptions table
CREATE TABLE IF NOT EXISTS outlook_subscriptions (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    expiration_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_expires_at ON gmail_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_gmail_notifications_expiration ON gmail_notifications(watch_expiration);
CREATE INDEX IF NOT EXISTS idx_outlook_tokens_expires_at ON outlook_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_outlook_subscriptions_expiration ON outlook_subscriptions(expiration_date);

-- Enable RLS on all tables
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own Gmail tokens"
    ON gmail_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own Gmail notifications"
    ON gmail_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own Outlook tokens"
    ON outlook_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own Outlook subscriptions"
    ON outlook_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow system to manage tokens and notifications
CREATE POLICY "System can manage Gmail tokens"
    ON gmail_tokens
    FOR ALL
    USING (true);

CREATE POLICY "System can manage Gmail notifications"
    ON gmail_notifications
    FOR ALL
    USING (true);

CREATE POLICY "System can manage Outlook tokens"
    ON outlook_tokens
    FOR ALL
    USING (true);

CREATE POLICY "System can manage Outlook subscriptions"
    ON outlook_subscriptions
    FOR ALL
    USING (true); 