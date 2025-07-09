-- Fix user_credits table schema
-- Run this SQL directly in the Supabase dashboard SQL editor

-- First, let's check the current structure of user_credits table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_credits' 
ORDER BY ordinal_position;

-- Add all missing columns that the code expects
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS total_credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have proper values
UPDATE user_credits 
SET 
  total_credits = COALESCE(total_credits, 0),
  used_credits = COALESCE(used_credits, 0),
  remaining_credits = COALESCE(remaining_credits, total_credits - used_credits, 0),
  last_updated = COALESCE(last_updated, NOW())
WHERE last_updated IS NULL OR remaining_credits IS NULL;

-- Check the updated structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_credits' 
ORDER BY ordinal_position;

-- Show existing user_credits records (only selecting columns that should now exist)
SELECT user_id, total_credits, used_credits, remaining_credits, last_updated 
FROM user_credits 
ORDER BY last_updated DESC 
LIMIT 5;

-- Show total count of user_credits records
SELECT COUNT(*) as total_user_credits FROM user_credits; 