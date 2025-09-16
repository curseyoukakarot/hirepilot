-- Phase 1: Create teams table and assign TAM Solutions users to same team
-- This migration creates the teams table and assigns the 3 TAM Solutions users to one team

BEGIN;

-- Create teams table if not exists
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add name column if it doesn't exist (in case table exists but missing column)
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

-- Add team_id column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- Create TAM Solutions Trial team with a proper UUID
INSERT INTO teams (id, name) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'TAM Solutions Trial')
ON CONFLICT (id) DO NOTHING;

-- Assign all 3 TAM Solutions users to the team
UPDATE users
SET team_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE email IN ('julia@tamsolutions.io', 'ayla@tamsolutions.io', 'Fede@tamsolutions.io');

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Enable RLS on teams table
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teams
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.team_id = teams.id 
      AND users.id = auth.uid()
    )
  );

-- Allow team admins to update team info
CREATE POLICY "Team admins can update team info"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.team_id = teams.id 
      AND users.id = auth.uid()
      AND users.role IN ('admin', 'team_admin', 'super_admin')
    )
  );

COMMIT;
