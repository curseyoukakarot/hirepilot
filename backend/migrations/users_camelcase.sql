-- Drop existing table if it exists
DROP TABLE IF EXISTS users;

-- Create users table with camelCase columns
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    onboardingComplete BOOLEAN DEFAULT false,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_role CHECK (role IN ('admin', 'member', 'viewer', 'super_admin', 'RecruitPro'))
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Add RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy for inserting users (only authenticated users)
CREATE POLICY "Users can create their own record"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Policy for viewing users (authenticated users can view all users)
CREATE POLICY "Users can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (true);

-- Policy for updating users (users can only update their own record)
CREATE POLICY "Users can update their own record"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy for deleting users (users can only delete their own record)
CREATE POLICY "Users can delete their own record"
    ON users FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- Create function to insert user
CREATE OR REPLACE FUNCTION create_public_user(
    user_id UUID,
    user_email VARCHAR,
    user_first_name VARCHAR,
    user_last_name VARCHAR,
    user_role VARCHAR,
    user_onboarding_complete BOOLEAN
) RETURNS json AS $$
DECLARE
    result json;
BEGIN
    INSERT INTO users (
        id,
        email,
        firstName,
        lastName,
        role,
        onboardingComplete
    ) VALUES (
        user_id,
        user_email,
        user_first_name,
        user_last_name,
        user_role,
        user_onboarding_complete
    )
    RETURNING json_build_object(
        'id', id,
        'email', email,
        'firstName', firstName,
        'lastName', lastName,
        'role', role,
        'onboardingComplete', onboardingComplete,
        'createdAt', createdAt,
        'updatedAt', updatedAt
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 