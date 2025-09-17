// Script to check and fix Supabase auth settings
// This helps diagnose the email confirmation issue

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAuthSettings() {
  console.log('🔍 Checking Supabase Auth Settings...\n');
  
  try {
    // Check if we can access auth settings
    console.log('✅ Supabase client initialized with service role key');
    console.log('📧 Supabase URL:', supabaseUrl);
    console.log('🔑 Service role key present:', !!serviceRoleKey);
    
    // Test a simple query to verify connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection error:', testError);
    } else {
      console.log('✅ Database connection successful');
      console.log('👥 Sample user data:', testData);
    }
    
    console.log('\n📋 Manual Steps Required:');
    console.log('1. Go to Supabase Dashboard → Auth → Providers → Email');
    console.log('2. Disable "Confirm email" checkbox');
    console.log('3. Save settings');
    console.log('4. Test login flow');
    
    console.log('\n🧪 Test Commands:');
    console.log('// In browser console after login:');
    console.log('window.supabase.auth.getSession().then(r => console.log("Session:", r.data.session));');
    console.log('window.supabase.auth.getUser().then(r => console.log("User:", r.data.user));');
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkAuthSettings();
