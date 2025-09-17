-- Add role claim injection to Supabase JWTs
-- This ensures that auth.jwt() includes the user's role from the users table

-- Step 1: Create function to inject role into JWT claims
CREATE OR REPLACE FUNCTION auth.jwt_claims(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  user_metadata jsonb;
BEGIN
  -- Get role from users table
  SELECT role INTO user_role
  FROM public.users
  WHERE id = user_id;
  
  -- Get existing user_metadata
  SELECT raw_user_meta_data INTO user_metadata
  FROM auth.users
  WHERE id = user_id;
  
  -- If no role found, try to get from user_metadata
  IF user_role IS NULL THEN
    user_role := COALESCE(user_metadata->>'role', 'free');
  END IF;
  
  -- Return JWT claims with role
  RETURN jsonb_build_object(
    'sub', user_id,
    'role', user_role,
    'email', (SELECT email FROM auth.users WHERE id = user_id),
    'aud', 'authenticated'
  );
END;
$$;

-- Step 2: Create trigger function to update user_metadata when role changes
CREATE OR REPLACE FUNCTION public.update_user_metadata_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user_metadata in auth.users when role changes in public.users
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on users table
DROP TRIGGER IF EXISTS trigger_update_user_metadata ON public.users;
CREATE TRIGGER trigger_update_user_metadata
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_metadata_on_role_change();

-- Step 4: Backfill existing users with role in user_metadata
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', COALESCE(u.role, 'free'))
FROM public.users u
WHERE auth.users.id = u.id;

-- Step 5: Update RLS policies to use the role from JWT claims
-- Drop existing policies
DROP POLICY IF EXISTS jr_super_admin_all ON public.job_requisitions;
DROP POLICY IF EXISTS ts_super_admin_all ON public.team_settings;

-- Recreate policies with proper role checking
CREATE POLICY jr_super_admin_all
  ON public.job_requisitions
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin'
  )
  WITH CHECK (TRUE);

CREATE POLICY ts_super_admin_all
  ON public.team_settings
  FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'super_admin'
  )
  WITH CHECK (TRUE);

-- Log completion
INSERT INTO public.migration_log (migration_name, applied_at, description) 
VALUES (
  '20250124_add_role_claim_injection', 
  NOW(), 
  'Added role claim injection to Supabase JWTs and updated RLS policies'
) ON CONFLICT (migration_name) DO NOTHING;
