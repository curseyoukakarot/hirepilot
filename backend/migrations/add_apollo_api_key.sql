-- Add apollo_api_key column to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS apollo_api_key TEXT;

-- Create unique constraint for apollo_api_key per user
ALTER TABLE user_settings
ADD CONSTRAINT unique_user_apollo_key UNIQUE (user_id, apollo_api_key);

-- Add RLS policies for apollo_api_key
CREATE POLICY "Users can view their own apollo api key"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own apollo api key"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id); 