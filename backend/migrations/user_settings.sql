-- Drop existing policies if they exist
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
    DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
    DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    campaign_updates BOOLEAN DEFAULT true,
    team_activity BOOLEAN DEFAULT true,
    slack_webhook_url TEXT,
    slack_channel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist
DO $$ BEGIN
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS campaign_updates BOOLEAN DEFAULT true;
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS team_activity BOOLEAN DEFAULT true;
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS slack_channel TEXT;
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
    WHEN duplicate_column THEN
        NULL;
END $$;

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS initialize_user_settings_trigger ON auth.users;

-- Create or replace function to initialize user settings
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize settings for new users
CREATE TRIGGER initialize_user_settings_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_settings(); 