// Debug script for Supabase session and role claims
// Run this in browser console after logging in

console.log('=== SUPABASE SESSION & ROLE DEBUG ===');

// 1. Check if supabase is available globally
console.log('1. Checking global supabase client...');
console.log('window.supabase available:', !!window.supabase);

if (!window.supabase) {
  console.error('❌ window.supabase not available. Check if the client is properly initialized.');
  return;
}

// 2. Check current session
console.log('\n2. Checking current session...');
window.supabase.auth.getSession().then(result => {
  console.log('Session result:', result);
  console.log('Session exists:', !!result.data.session);
  
  if (result.data.session) {
    console.log('User ID:', result.data.session.user.id);
    console.log('User email:', result.data.session.user.email);
    console.log('Access token present:', !!result.data.session.access_token);
    console.log('User metadata:', result.data.session.user.user_metadata);
    console.log('App metadata:', result.data.session.user.app_metadata);
  } else {
    console.log('❌ No active session found');
  }
}).catch(err => {
  console.error('Session error:', err);
});

// 3. Check current user
console.log('\n3. Checking current user...');
window.supabase.auth.getUser().then(result => {
  console.log('User result:', result);
  console.log('User exists:', !!result.data.user);
  
  if (result.data.user) {
    console.log('User ID:', result.data.user.id);
    console.log('User email:', result.data.user.email);
    console.log('User metadata:', result.data.user.user_metadata);
    console.log('App metadata:', result.data.user.app_metadata);
  } else {
    console.log('❌ No user found');
  }
}).catch(err => {
  console.error('User error:', err);
});

// 4. Test database query with RLS
console.log('\n4. Testing database query with RLS...');
window.supabase.from('job_requisitions').select('id, user_id, title').limit(5).then(result => {
  console.log('Jobs query result:', result);
  console.log('Jobs returned:', result.data?.length || 0);
  if (result.error) {
    console.log('Query error:', result.error);
  }
  if (result.data && result.data.length > 0) {
    console.log('Sample jobs:', result.data.slice(0, 3));
  }
}).catch(err => {
  console.error('Database query error:', err);
});

// 5. Test role from users table
console.log('\n5. Testing role from users table...');
window.supabase.auth.getUser().then(userResult => {
  if (userResult.data.user) {
    return window.supabase.from('users').select('role').eq('id', userResult.data.user.id).single();
  }
  return { data: null, error: { message: 'No user' } };
}).then(roleResult => {
  console.log('Role query result:', roleResult);
  if (roleResult.data) {
    console.log('User role from users table:', roleResult.data.role);
  }
}).catch(err => {
  console.error('Role query error:', err);
});

console.log('\n=== DEBUG COMPLETE ===');
console.log('If session is null, check persistSession and detectSessionInUrl settings.');
console.log('If user has no role in metadata, run the role claim injection migration.');
