-- Allow the 'free' role in users and team_invites
-- Safe to run multiple times

begin;

-- users.role check constraint
alter table public.users
  drop constraint if exists valid_role;

alter table public.users
  add constraint valid_role
  check (role in ('free','member','admin','team_admin','RecruitPro','super_admin'));

-- team_invites.role check constraint
alter table public.team_invites
  drop constraint if exists valid_role;

alter table public.team_invites
  add constraint valid_role
  check (role in ('free','member','admin','team_admin','RecruitPro'));

commit;


