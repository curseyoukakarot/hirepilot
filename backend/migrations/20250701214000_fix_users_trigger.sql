-- Fix trigger to reliably create row in public.users without failing auth signup

-- If re-running, drop previous objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Function: copy row into public.users (camelCase columns)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  f_name text := COALESCE(meta->>'first_name', meta->>'firstName', '');
  l_name text := COALESCE(meta->>'last_name',  meta->>'lastName',  '');
BEGIN
  INSERT INTO public.users (id, email, "firstName", "lastName", role, "onboardingComplete")
  VALUES (NEW.id, NEW.email, f_name, l_name, 'member', FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user(); 