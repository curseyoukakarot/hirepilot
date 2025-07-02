-- Update valid_role check constraints to new roles while preserving RecruitPro

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS valid_role,
  ADD CONSTRAINT valid_role CHECK (role IN ('member','admin','team_admin','RecruitPro','super_admin'));

ALTER TABLE team_invites
  DROP CONSTRAINT IF EXISTS valid_role,
  ADD CONSTRAINT valid_role CHECK (role IN ('member','admin','team_admin','RecruitPro'));

-- Migrate legacy roles to member
UPDATE users SET role='member' WHERE role IN ('viewer','recruiter');
UPDATE team_invites SET role='member' WHERE role IN ('viewer','recruiter'); 