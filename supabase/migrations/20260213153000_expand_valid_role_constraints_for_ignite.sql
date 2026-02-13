-- Expand role constraints to support Ignite + current admin role options.
-- Safe/idempotent: drop and recreate with a superset of roles.

begin;

alter table public.users
  drop constraint if exists valid_role;

alter table public.users
  add constraint valid_role
  check (
    role in (
      'free',
      'member',
      'admin',
      'team_admin',
      'viewer',
      'RecruitPro',
      'recruitpro',
      'super_admin',
      'job_seeker_free',
      'job_seeker_pro',
      'job_seeker_elite',
      'ignite_admin',
      'ignite_team',
      'ignite_client'
    )
  );

alter table public.team_invites
  drop constraint if exists valid_role;

alter table public.team_invites
  add constraint valid_role
  check (
    role in (
      'free',
      'member',
      'admin',
      'team_admin',
      'viewer',
      'RecruitPro',
      'recruitpro',
      'job_seeker_free',
      'job_seeker_pro',
      'job_seeker_elite',
      'ignite_admin',
      'ignite_team',
      'ignite_client'
    )
  );

commit;

