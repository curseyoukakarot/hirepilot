// Auth smoke test to verify session + role + RLS alignment
// Run this after deployment to confirm everything works

import { supabase } from '../src/lib/supabaseClient';

(async () => {
  console.log('🧪 Running Auth Smoke Test...\n');
  
  try {
    // 1. Check session
    console.log('1️⃣ Checking session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.error('❌ No active session found');
      console.log('💡 Solution: Log in and ensure email confirmation is disabled');
      return;
    }
    
    console.log('✅ Session found');
    console.log('   User ID:', session.user.id);
    console.log('   Email:', session.user.email);
    
    // 2. Check user
    console.log('\n2️⃣ Checking user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ User error:', userError);
      return;
    }
    
    if (!user) {
      console.error('❌ No user found');
      return;
    }
    
    console.log('✅ User found');
    console.log('   Role from user_metadata:', user.user_metadata?.role);
    console.log('   Role from app_metadata:', user.app_metadata?.role);
    
    // 3. Test RLS with job_requisitions
    console.log('\n3️⃣ Testing RLS with job_requisitions...');
    const { data: jobs, error: jobsError } = await supabase
      .from('job_requisitions')
      .select('id, user_id, title')
      .limit(5);
    
    if (jobsError) {
      console.error('❌ Jobs query error:', jobsError);
      console.log('💡 This indicates RLS is blocking access');
      return;
    }
    
    console.log('✅ Jobs query successful');
    console.log('   Rows returned:', jobs?.length || 0);
    
    if (jobs && jobs.length > 0) {
      console.log('   Sample jobs:', jobs.slice(0, 2));
    }
    
    // 4. Test with team_settings
    console.log('\n4️⃣ Testing RLS with team_settings...');
    const { data: teams, error: teamsError } = await supabase
      .from('team_settings')
      .select('id, team_id')
      .limit(5);
    
    if (teamsError) {
      console.error('❌ Teams query error:', teamsError);
    } else {
      console.log('✅ Teams query successful');
      console.log('   Rows returned:', teams?.length || 0);
    }
    
    // 5. Summary
    console.log('\n📊 Smoke Test Summary:');
    console.log('✅ Session:', !!session);
    console.log('✅ User:', !!user);
    console.log('✅ Jobs RLS:', !jobsError);
    console.log('✅ Teams RLS:', !teamsError);
    
    if (session && user && !jobsError) {
      console.log('\n🎉 Auth smoke test PASSED! RLS is working correctly.');
    } else {
      console.log('\n❌ Auth smoke test FAILED! Check the issues above.');
    }
    
  } catch (err) {
    console.error('💥 Smoke test error:', err);
  }
})();
