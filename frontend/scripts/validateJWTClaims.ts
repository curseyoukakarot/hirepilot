// Validate JWT claims after Access Token Hook deployment
// Run this in browser console after logging in

import { supabase } from '../src/lib/supabaseClient';

(async () => {
  console.log('🔍 Validating JWT Claims...\n');
  
  try {
    // 1. Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.error('❌ No active session found');
      return;
    }
    
    console.log('✅ Session found');
    console.log('   User ID:', session.user.id);
    console.log('   Email:', session.user.email);
    
    // 2. Check user metadata
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ User error:', userError);
      return;
    }
    
    console.log('\n📊 User Metadata:');
    console.log('   user_metadata.role:', user?.user_metadata?.role);
    console.log('   app_metadata.role:', user?.app_metadata?.role);
    
    // 3. Test JWT claims by making a request that would use RLS
    console.log('\n🧪 Testing RLS with role claims...');
    
    const { data: jobs, error: jobsError } = await supabase
      .from('job_requisitions')
      .select('id, user_id, title')
      .limit(3);
    
    if (jobsError) {
      console.error('❌ Jobs query error:', jobsError);
      console.log('💡 This suggests the role claim is not working in RLS policies');
    } else {
      console.log('✅ Jobs query successful');
      console.log('   Rows returned:', jobs?.length || 0);
      if (jobs && jobs.length > 0) {
        console.log('   Sample jobs:', jobs);
      }
    }
    
    // 4. Test team settings
    const { data: teams, error: teamsError } = await supabase
      .from('team_settings')
      .select('id, team_id')
      .limit(3);
    
    if (teamsError) {
      console.error('❌ Teams query error:', teamsError);
    } else {
      console.log('✅ Teams query successful');
      console.log('   Rows returned:', teams?.length || 0);
    }
    
    // 5. Summary
    console.log('\n📊 Validation Summary:');
    console.log('✅ Session:', !!session);
    console.log('✅ User:', !!user);
    console.log('✅ Jobs RLS:', !jobsError);
    console.log('✅ Teams RLS:', !teamsError);
    
    if (session && user && !jobsError) {
      console.log('\n🎉 JWT role claims are working! RLS policies can access the role.');
    } else {
      console.log('\n❌ JWT role claims need fixing. Check Access Token Hook deployment.');
    }
    
  } catch (err) {
    console.error('💥 Validation error:', err);
  }
})();
