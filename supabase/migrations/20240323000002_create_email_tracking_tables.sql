-- Drop existing objects
DROP MATERIALIZED VIEW IF EXISTS daily_email_stats;
DROP FUNCTION IF EXISTS refresh_daily_email_stats();
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS gmail_tokens CASCADE;
DROP TABLE IF EXISTS gmail_notifications CASCADE;
DROP TABLE IF EXISTS outlook_tokens CASCADE;
DROP TABLE IF EXISTS outlook_subscriptions CASCADE;

-- Create unified email_events table
CREATE TABLE email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'sendgrid', 'gmail', 'outlook'
    message_id TEXT NOT NULL, -- provider-specific message ID
    event_type TEXT NOT NULL, -- 'sent', 'delivered', 'open', 'click', 'reply', 'bounce'
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB, -- Store provider-specific data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Gmail tokens table
CREATE TABLE gmail_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Gmail notifications table
CREATE TABLE gmail_notifications (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    watch_expiration TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Outlook tokens table
CREATE TABLE outlook_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Outlook subscriptions table
CREATE TABLE outlook_subscriptions (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    expiration_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for email_events table
CREATE INDEX idx_email_events_user_id ON email_events(user_id);
CREATE INDEX idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX idx_email_events_provider ON email_events(provider);
CREATE INDEX idx_email_events_message_id ON email_events(message_id);
CREATE INDEX idx_email_events_event_type ON email_events(event_type);
CREATE INDEX idx_email_events_event_timestamp ON email_events(event_timestamp);

-- Create indexes for Gmail tables
CREATE INDEX idx_gmail_tokens_expires_at ON gmail_tokens(expires_at);
CREATE INDEX idx_gmail_notifications_expiration ON gmail_notifications(watch_expiration);

-- Create indexes for Outlook tables
CREATE INDEX idx_outlook_tokens_expires_at ON outlook_tokens(expires_at);
CREATE INDEX idx_outlook_subscriptions_expiration ON outlook_subscriptions(expiration_date);

-- Enable RLS on all tables
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own email events"
    ON email_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert email events"
    ON email_events
    FOR INSERT
    WITH CHECK (true);

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

-- Create materialized view for daily email stats
CREATE MATERIALIZED VIEW daily_email_stats AS
SELECT
    date_trunc('day', event_timestamp) as day,
    user_id,
    provider,
    COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
    COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE event_type = 'open') as opens,
    COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'reply') as replies,
    COUNT(*) FILTER (WHERE event_type = 'bounce') as bounces
FROM email_events
GROUP BY 1, 2, 3;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_daily_email_stats ON daily_email_stats(day, user_id, provider);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_email_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_email_stats;
END;
$$ LANGUAGE plpgsql; 