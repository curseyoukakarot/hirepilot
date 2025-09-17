-- Check what tables exist in the database
-- Run this in Supabase SQL Editor

-- List all tables in public schema
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check if specific tables we care about exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_requisitions' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as job_requisitions_status;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_settings' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as team_settings_status;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as team_members_status;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_collaborators' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as job_collaborators_status;

-- Check RLS status on job_requisitions
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'job_requisitions' AND schemaname = 'public';

-- Check existing policies on job_requisitions
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'job_requisitions' AND schemaname = 'public';
