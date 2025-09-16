-- Fix job_collaborators role constraint to ensure it accepts the correct values
-- The frontend sends 'Editor' but there might be a constraint mismatch

-- Drop the existing constraint
ALTER TABLE public.job_collaborators DROP CONSTRAINT IF EXISTS job_collaborators_role_check;

-- Add the correct constraint with proper role values (exact match)
ALTER TABLE public.job_collaborators ADD CONSTRAINT job_collaborators_role_check 
CHECK (role IN ('Admin', 'Editor', 'View Only'));

-- Also ensure any existing data is valid
UPDATE public.job_collaborators 
SET role = 'Editor' 
WHERE role = 'editor' OR role = 'EDITOR' OR role = 'Editor ' OR role = ' Editor';

UPDATE public.job_collaborators 
SET role = 'Admin' 
WHERE role = 'admin' OR role = 'ADMIN' OR role = 'Admin ' OR role = ' Admin';

UPDATE public.job_collaborators 
SET role = 'View Only' 
WHERE role = 'view only' OR role = 'VIEW ONLY' OR role = 'View Only ' OR role = ' View Only';
