-- Create lead_activities table for tracking user interactions with leads
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'Call', 
    'Meeting', 
    'Outreach', 
    'Email', 
    'LinkedIn', 
    'Note', 
    'Other'
  )),
  tags TEXT[], -- optional tag array
  notes TEXT, -- optional user-entered notes
  activity_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON lead_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_activity_type ON lead_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_lead_activities_activity_timestamp ON lead_activities(activity_timestamp);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_timestamp ON lead_activities(lead_id, activity_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view activities for leads they own
CREATE POLICY "Users can view lead activities for their own leads"
  ON lead_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_activities.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

-- Users can create activities for leads they own
CREATE POLICY "Users can create lead activities for their own leads"
  ON lead_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_activities.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

-- Users can update their own activities
CREATE POLICY "Users can update their own lead activities"
  ON lead_activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own activities
CREATE POLICY "Users can delete their own lead activities"
  ON lead_activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add table comment
COMMENT ON TABLE lead_activities IS 'Activity log for tracking user interactions with leads (calls, meetings, emails, etc.)';