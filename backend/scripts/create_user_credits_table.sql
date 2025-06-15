-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    total_credits INTEGER NOT NULL DEFAULT 0,
    used_credits INTEGER NOT NULL DEFAULT 0,
    remaining_credits INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_credits CHECK (total_credits >= 0 AND used_credits >= 0 AND remaining_credits >= 0),
    CONSTRAINT valid_remaining_credits CHECK (remaining_credits = total_credits - used_credits)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_credits_user_id_idx ON user_credits(user_id);

-- Grant access to authenticated users
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
    ON user_credits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all credits"
    ON user_credits FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON user_credits TO authenticated;
GRANT ALL ON user_credits TO service_role; 