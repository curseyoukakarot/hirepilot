-- Create email_tracking_events table
CREATE TABLE IF NOT EXISTS email_tracking_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    email_id TEXT,
    event_type TEXT NOT NULL, -- 'open', 'click', 'delivered', 'bounce', etc.
    event_timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_user_id ON email_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign_id ON email_tracking_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_lead_id ON email_tracking_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event_timestamp ON email_tracking_events(event_timestamp);

-- Add RLS policies
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email tracking events"
    ON email_tracking_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert email tracking events"
    ON email_tracking_events
    FOR INSERT
    WITH CHECK (true); 