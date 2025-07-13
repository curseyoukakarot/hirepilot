-- Create zap_events table for comprehensive Zapier/Make.com event tracking
-- This table stores all events that can trigger external automations

CREATE TABLE IF NOT EXISTS zap_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    source_table TEXT, -- which table/entity triggered this event (leads, candidates, etc.)
    source_id UUID, -- ID of the source record
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for efficient querying by Zapier/Make
CREATE INDEX IF NOT EXISTS idx_zap_events_user_id ON zap_events(user_id);
CREATE INDEX IF NOT EXISTS idx_zap_events_event_type ON zap_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zap_events_created_at ON zap_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zap_events_user_type ON zap_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_zap_events_user_created ON zap_events(user_id, created_at DESC);

-- Add composite index for filtering by user, event type, and date
CREATE INDEX IF NOT EXISTS idx_zap_events_user_type_date ON zap_events(user_id, event_type, created_at DESC);

-- Enable RLS
ALTER TABLE zap_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own events
CREATE POLICY "Users can view their own zap events"
    ON zap_events
    FOR SELECT
    USING (auth.uid() = user_id);

-- System can insert events for any user (for automated event creation)
CREATE POLICY "System can insert zap events"
    ON zap_events
    FOR INSERT
    WITH CHECK (true);

-- Optional: Users can delete their own events (for cleanup)
CREATE POLICY "Users can delete their own zap events"
    ON zap_events
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create a function to clean up old events (older than 30 days) to prevent infinite growth
CREATE OR REPLACE FUNCTION cleanup_old_zap_events()
RETURNS void AS $$
BEGIN
    DELETE FROM zap_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the table purpose
COMMENT ON TABLE zap_events IS 'Stores all events that can trigger Zapier/Make.com automations. Events are automatically cleaned up after 30 days.';
COMMENT ON COLUMN zap_events.event_type IS 'Type of event (e.g., lead_created, candidate_hired, etc.)';
COMMENT ON COLUMN zap_events.event_data IS 'JSON data payload for the event';
COMMENT ON COLUMN zap_events.source_table IS 'Table that triggered the event (leads, candidates, etc.)';
COMMENT ON COLUMN zap_events.source_id IS 'ID of the record that triggered the event'; 