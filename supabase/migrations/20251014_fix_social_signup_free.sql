-- Default all social signups to FREE plan with 50 credits
-- Safe to re-run; uses CREATE OR REPLACE and ON CONFLICT guards

-- Drop old trigger if named differently (best-effort)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Function: copy row into public.users with free defaults when role is absent
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  f_name text := COALESCE(meta->>'first_name', meta->>'firstName', '');
  l_name text := COALESCE(meta->>'last_name',  meta->>'lastName',  '');
  role_in text := COALESCE(meta->>'role', 'free');
  credit_amount integer := 50;
BEGIN
  -- Map paid/admin roles to their credit allocations; otherwise keep free
  IF role_in = 'admin' THEN credit_amount := 1000; END IF;
  IF role_in = 'team_admin' THEN credit_amount := 5000; END IF;
  IF role_in = 'RecruitPro' THEN credit_amount := 1000; END IF;
  IF role_in = 'super_admin' THEN credit_amount := 10000; END IF;

  -- Upsert into public.users with plan defaults
  INSERT INTO public.users (id, email, "firstName", "lastName", role, plan, "onboardingComplete")
  VALUES (NEW.id, NEW.email, f_name, l_name, role_in, CASE WHEN role_in='free' THEN 'free' ELSE NULL END, FALSE)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    plan = COALESCE(public.users.plan, EXCLUDED.plan);

  -- Initialize credits row if missing
  INSERT INTO public.user_credits (user_id, total_credits, used_credits, remaining_credits, last_updated)
  VALUES (NEW.id, credit_amount, 0, credit_amount, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


