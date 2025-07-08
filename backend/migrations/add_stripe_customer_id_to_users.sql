-- Add stripe_customer_id column to users table if it doesn't exist
-- This fixes billing portal issues where the column is missing

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS users_stripe_customer_idx ON users(stripe_customer_id);

-- Update RLS policy to allow access to stripe_customer_id
-- No additional policy needed as existing policies cover all columns 