-- Fix credit_usage_log table schema
-- Run this SQL directly in the Supabase dashboard SQL editor

-- First, let's check the current structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'credit_usage_log' 
ORDER BY ordinal_position;

-- Add missing columns
ALTER TABLE credit_usage_log 
ADD COLUMN IF NOT EXISTS amount INTEGER,
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('credit', 'debit')),
ADD COLUMN IF NOT EXISTS usage_type TEXT CHECK (usage_type IN ('campaign_creation', 'campaign_boost', 'api_usage')),
ADD COLUMN IF NOT EXISTS description TEXT;

-- Remove NOT NULL constraint from credits_used since we're transitioning to the new schema
ALTER TABLE credit_usage_log ALTER COLUMN credits_used DROP NOT NULL;

-- Update existing records to have proper values
UPDATE credit_usage_log 
SET 
  amount = CASE 
    WHEN credits_used > 0 THEN credits_used
    ELSE -ABS(credits_used)
  END,
  type = CASE 
    WHEN credits_used > 0 THEN 'credit'
    ELSE 'debit'
  END,
  usage_type = 'api_usage',
  description = COALESCE(source, 'Credit usage')
WHERE amount IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_type ON credit_usage_log(type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_usage_type ON credit_usage_log(usage_type);

-- Check the updated structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'credit_usage_log' 
ORDER BY ordinal_position;

-- Final verification - show a few sample records (if any exist)
SELECT user_id, credits_used, amount, type, usage_type, description, created_at 
FROM credit_usage_log 
ORDER BY created_at DESC 
LIMIT 3;

-- Show total count of records
SELECT COUNT(*) as total_records FROM credit_usage_log; 