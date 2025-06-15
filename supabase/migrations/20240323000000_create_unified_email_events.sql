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

-- Add indexes for better query performance
CREATE INDEX idx_email_events_user_id ON email_events(user_id);
CREATE INDEX idx_email_events_campaign_id ON email_events(campaign_id);
CREATE INDEX idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX idx_email_events_provider ON email_events(provider);
CREATE INDEX idx_email_events_message_id ON email_events(message_id);
CREATE INDEX idx_email_events_event_type ON email_events(event_type);
CREATE INDEX idx_email_events_event_timestamp ON email_events(event_timestamp);

-- Add RLS policies
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email events"
    ON email_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert email events"
    ON email_events
    FOR INSERT
    WITH CHECK (true);

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