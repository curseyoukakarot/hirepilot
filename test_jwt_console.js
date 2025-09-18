// Console test script for JWT claims after Access Token Hook
console.log('🔍 Testing JWT claims after Access Token Hook deployment...');

// Check if Supabase client is available
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase client found');
  
  // Test JWT claims
  window.supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error('❌ Error getting session:', error);
      return;
    }
    
    if (!session) {
      console.log('❌ No active session. Please log in first.');
      return;
    }
    
    console.log('✅ Active session found');
    console.log('User ID:', session.user.id);
    console.log('Email:', session.user.email);
    
    // Decode JWT to check claims
    try {
      const token = session.access_token;
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      console.log('🔍 JWT Claims:', payload);
      console.log('Role claim:', payload.role);
      console.log('App metadata:', payload.app_metadata);
      console.log('User metadata:', payload.user_metadata);
      
      if (payload.role) {
        console.log('✅ SUCCESS: Role claim found! Access Token Hook is working.');
        console.log('Role value:', payload.role);
        console.log('Allowed roles:', payload.allowed_roles);
      } else {
        console.error('❌ FAILED: No role claim in JWT! Access Token Hook is not working.');
        console.log('This means the hook is not enabled in Supabase Dashboard or not functioning properly.');
      }
      
      // Test RLS
      console.log('🧪 Testing RLS with job_requisitions...');
      return window.supabase
        .from('job_requisitions')
        .select('id, title, user_id')
        .limit(3);
        
    } catch (e) {
      console.error('❌ Error decoding JWT:', e);
    }
  }).then(({ data, error }) => {
    if (error) {
      console.error('❌ RLS Test Failed:', error.message);
      console.log('This confirms the 403 issue is still present.');
    } else {
      console.log('✅ RLS Test Passed: Retrieved', data.length, 'job requisitions');
      console.log('Data:', data);
    }
  }).catch(err => {
    console.error('❌ RLS Test Error:', err);
  });
  
} else {
  console.log('❌ Supabase client not found on window object');
  console.log('Make sure you are running this in the browser console on the application page.');
}
