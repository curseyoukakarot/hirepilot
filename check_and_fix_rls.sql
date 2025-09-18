-- Check current RLS policies for job_requisitions
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'job_requisitions';

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'job_requisitions';

-- Test the JWT role extraction
SELECT 
    auth.jwt() ->> 'role' as top_level_role,
    auth.jwt() -> 'app_metadata' ->> 'role' as app_metadata_role,
    auth.jwt() -> 'user_metadata' ->> 'role' as user_metadata_role;
