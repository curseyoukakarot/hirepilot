-- Test current RLS policies with different role claims
-- Run this in Supabase SQL Editor to verify RLS is working

-- Test 1: Super admin role
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

-- Test 5: Test with a real user ID (replace with actual user ID)
-- SET LOCAL request.jwt.claims = '{"sub":"2b9ea9e2-3c0f-41d5-b60c-5c1e6139ae42","role":"super_admin"}';
-- SELECT id, user_id, title FROM public.job_requisitions LIMIT 5;
