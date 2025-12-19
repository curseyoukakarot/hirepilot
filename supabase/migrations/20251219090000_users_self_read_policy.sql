-- Allow authenticated users to read their own row in public.users.
-- This prevents UI role gating (and other profile reads) from failing due to RLS.
--
-- Idempotent: checks for existing policy before creating.

do $$
begin
  -- Ensure RLS is enabled (safe if already enabled)
  begin
    execute 'alter table public.users enable row level security';
  exception when others then
    -- ignore if table missing or insufficient perms in some environments
  end;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Users can read own profile'
  ) then
    execute $pol$
      create policy "Users can read own profile"
      on public.users
      for select
      using (auth.uid() = id)
    $pol$;
  end if;
end
$$;


