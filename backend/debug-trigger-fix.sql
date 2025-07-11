-- Debug and fix the user creation trigger
-- This creates a more robust version that won't fail on credit table issues

-- First, let's check what tables exist and their schemas
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'user_credits', 'credit_usage_log')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Create a safer version of the trigger that handles errors gracefully
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb;
  first_name text;
  last_name  text;
  role text;
  credit_amount integer;
BEGIN
  meta := NEW.raw_user_meta_data;
  -- Extract commonly provided metadata keys with sensible fallbacks
  first_name := COALESCE(meta->>'first_name', meta->>'firstName', '');
  last_name  := COALESCE(meta->>'last_name',  meta->>'lastName',  '');
  role       := COALESCE(meta->>'role', 'member');

  -- 1. Call helper to insert into users table (this should work now)
  BEGIN
    PERFORM create_public_user(
      NEW.id,
      NEW.email,
      first_name,
      last_name,
      role,
      false -- onboarding_complete
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating public user: %', SQLERRM;
    -- Don't fail the entire trigger, just log the error
  END;

  -- 2. Try to initialize credits (but don't fail if it doesn't work)
  BEGIN
    -- Determine credit amount based on role
    CASE role
      WHEN 'admin' THEN credit_amount := 1000;
      WHEN 'team_admin' THEN credit_amount := 5000;
      WHEN 'RecruitPro' THEN credit_amount := 1000;
      WHEN 'super_admin' THEN credit_amount := 10000;
      ELSE credit_amount := 350; -- Default for 'member' and any other role
    END CASE;

    -- Try to initialize credits for the user
    INSERT INTO user_credits (user_id, total_credits, used_credits, remaining_credits, last_updated)
    VALUES (NEW.id, credit_amount, 0, credit_amount, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error initializing credits for user %: %', NEW.id, SQLERRM;
    -- Don't fail the trigger, just log the error
  END;

  -- 3. Try to log the credit allocation (but don't fail if it doesn't work)
  BEGIN
    INSERT INTO credit_usage_log (user_id, amount, type, source, description)
    VALUES (NEW.id, credit_amount, 'credit', 'subscription_renewal', 
            'Initial credit allocation for ' || role || ' role')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error logging credit allocation for user %: %', NEW.id, SQLERRM;
    -- Don't fail the trigger, just log the error
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 