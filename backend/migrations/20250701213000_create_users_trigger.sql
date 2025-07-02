-- Automatically create a users row whenever a new Supabase auth user is created
-- Adjust dates as needed; created July 1 2025

-- Drop existing trigger/function if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_auth_user();

-- Function that maps auth.users row into the public users table
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb;
  first_name text;
  last_name  text;
  role text;
BEGIN
  meta := NEW.raw_user_meta_data;
  -- Extract commonly provided metadata keys with sensible fallbacks
  first_name := COALESCE(meta->>'first_name', meta->>'firstName', '');
  last_name  := COALESCE(meta->>'last_name',  meta->>'lastName',  '');
  role       := COALESCE(meta->>'role', 'member');

  -- Call helper to insert into users table
  PERFORM create_public_user(
    NEW.id,
    NEW.email,
    first_name,
    last_name,
    role,
    false -- onboarding_complete
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fires after every insert on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user(); 