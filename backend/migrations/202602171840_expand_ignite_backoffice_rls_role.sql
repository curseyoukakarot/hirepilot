-- Allow ignite_backoffice role in Ignite backoffice RLS helper

CREATE OR REPLACE FUNCTION public.ignite_backoffice_role_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role') IN ('ignite_admin', 'ignite_team', 'ignite_backoffice'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('ignite_admin', 'ignite_team', 'ignite_backoffice'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'account_type') IN ('ignite_admin', 'ignite_team', 'ignite_backoffice'),
    false
  )
  OR COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('ignite_admin', 'ignite_team', 'ignite_backoffice'),
    false
  );
$$;
