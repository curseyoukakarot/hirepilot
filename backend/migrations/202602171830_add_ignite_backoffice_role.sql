-- Add Ignite roles (including ignite_backoffice) to valid_role constraints

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS valid_role,
  ADD CONSTRAINT valid_role CHECK (
    role IN (
      'member',
      'admin',
      'team_admin',
      'RecruitPro',
      'super_admin',
      'free',
      'job_seeker_free',
      'job_seeker_pro',
      'job_seeker_elite',
      'ignite_admin',
      'ignite_team',
      'ignite_client',
      'ignite_backoffice'
    )
  );

ALTER TABLE team_invites
  DROP CONSTRAINT IF EXISTS valid_role,
  ADD CONSTRAINT valid_role CHECK (
    role IN (
      'member',
      'admin',
      'team_admin',
      'RecruitPro',
      'free',
      'job_seeker_free',
      'job_seeker_pro',
      'job_seeker_elite',
      'ignite_admin',
      'ignite_team',
      'ignite_client',
      'ignite_backoffice'
    )
  );
