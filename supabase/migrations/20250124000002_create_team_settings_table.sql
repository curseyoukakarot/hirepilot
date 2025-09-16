-- Phase 3: Create team_settings table for team sharing preferences
-- This migration creates the team_settings table to store team sharing preferences

BEGIN;

-- Ensure teams table exists first
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add columns if they don't exist (in case teams table exists but missing columns)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Update any existing NULL name values before making the column NOT NULL
UPDATE teams SET name = 'Unnamed Team' WHERE name IS NULL;

-- Make name NOT NULL if it's not already
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'name' AND is_nullable = 'YES') THEN
        ALTER TABLE teams ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- Ensure users table has team_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id uuid;

-- Create team_settings table
CREATE TABLE IF NOT EXISTS team_settings (
  team_id uuid PRIMARY KEY,
  share_leads boolean DEFAULT false,
  share_candidates boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_team_settings_team_id ON team_settings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_settings_share_leads ON team_settings(share_leads);
CREATE INDEX IF NOT EXISTS idx_team_settings_share_candidates ON team_settings(share_candidates);

-- Enable RLS on team_settings table
ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for team_settings (only if users.team_id exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'team_id') THEN
        -- Team members can view team settings
        EXECUTE 'CREATE POLICY "Team members can view team settings"
            ON team_settings FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.team_id = team_settings.team_id 
                    AND users.id = auth.uid()
                )
            )';

        -- Only team admins can update team settings
        EXECUTE 'CREATE POLICY "Team admins can update team settings"
            ON team_settings FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.team_id = team_settings.team_id 
                    AND users.id = auth.uid()
                    AND users.role IN (''admin'', ''team_admin'', ''super_admin'')
                )
            )';

        -- Team admins can insert team settings
        EXECUTE 'CREATE POLICY "Team admins can insert team settings"
            ON team_settings FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.team_id = team_settings.team_id 
                    AND users.id = auth.uid()
                    AND users.role IN (''admin'', ''team_admin'', ''super_admin'')
                )
            )';
    END IF;
END $$;

COMMIT;
