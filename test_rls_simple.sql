-- Simple test to verify RLS is working with role claims
-- Run this in Supabase SQL Editor

-- Test 1: Super admin role (should see all jobs)
SET LOCAL request.jwt.claims = '{"sub":"test-user-id","role":"super_admin"}';
SELECT 
  'Super Admin Test' as test_name,
  COUNT(*) as jobs_visible
FROM public.job_requisitions;

-- Test 2: Regular user role (should only see own jobs)
SET LOCAL request.jwt.claims = '{"sub":"test-user-id","role":"recruitpro"}';
SELECT 
  'RecruitPro Test' as test_name,
  COUNT(*) as jobs_visible
FROM public.job_requisitions;

-- Test 3: No role (should be blocked)
SET LOCAL request.jwt.claims = '{"sub":"test-user-id"}';
SELECT 
  'No Role Test' as test_name,
  COUNT(*) as jobs_visible
FROM public.job_requisitions;

-- Test 4: Check what the current JWT claims look like
SELECT 
  'Current JWT Claims' as test_name,
  current_setting('request.jwt.claims', true)::json as jwt_claims;
