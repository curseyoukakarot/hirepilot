-- Create team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invited_by UUID NOT NULL REFERENCES users(id),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'member', 'viewer')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS team_invites_email_idx ON team_invites(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS team_invites_status_idx ON team_invites(status);

-- Add RLS policies
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Policy for inserting invites (only authenticated users)
CREATE POLICY "Users can create team invites"
    ON team_invites FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy for viewing invites (only the inviter or the invitee can see them)
CREATE POLICY "Users can view their own team invites"
    ON team_invites FOR SELECT
    TO authenticated
    USING (
        auth.uid() = invited_by 
        OR 
        email = (SELECT email FROM users WHERE id = auth.uid())
    );

-- Policy for updating invites (only the invitee can update their own invite)
CREATE POLICY "Users can update their own received invites"
    ON team_invites FOR UPDATE
    TO authenticated
    USING (email = (SELECT email FROM users WHERE id = auth.uid()))
    WITH CHECK (
        status IN ('accepted', 'rejected')
        AND 
        email = (SELECT email FROM users WHERE id = auth.uid())
    );

-- Policy for deleting invites (only the inviter can delete their own invites)
CREATE POLICY "Users can delete their own sent invites"
    ON team_invites FOR DELETE
    TO authenticated
    USING (auth.uid() = invited_by); 