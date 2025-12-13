-- Expand valid_role to include job seeker plans

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
      'job_seeker_elite'
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
      'job_seeker_elite'
    )
  );

-- Normalize legacy viewer/recruiter roles
UPDATE users SET role = 'member' WHERE role IN ('viewer','recruiter');
UPDATE team_invites SET role = 'member' WHERE role IN ('viewer','recruiter');
