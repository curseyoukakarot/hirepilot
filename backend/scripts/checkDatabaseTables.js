// Script to check what tables exist in the database
// This helps us understand the current schema before applying RLS policies

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDatabaseTables() {
  console.log('🔍 Checking database tables and RLS status...\n');
  
  try {
    // Check what tables exist in public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info');
    
    if (tablesError) {
      console.log('Using alternative method to check tables...\n');
      
      // Alternative: try to query each table we care about
      const tablesToCheck = [
        'job_requisitions',
        'team_settings', 
        'team_members',
        'job_collaborators',
        'users',
        'job_activity_log'
      ];
      
      for (const tableName of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (error) {
            console.log(`❌ ${tableName}: ${error.message}`);
          } else {
            console.log(`✅ ${tableName}: exists (${data?.length || 0} sample rows)`);
          }
        } catch (err) {
          console.log(`❌ ${tableName}: ${err.message}`);
        }
      }
    } else {
      console.log('📊 Database tables:', tables);
    }
    
    // Check RLS status on key tables
    console.log('\n🔒 Checking RLS status...');
    
    const rlsTables = ['job_requisitions', 'team_settings'];
    
    for (const tableName of rlsTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error && error.code === '42501') {
          console.log(`🔒 ${tableName}: RLS enabled (permission denied)`);
        } else if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`⚠️  ${tableName}: RLS may be disabled (data returned)`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    // Test current user access
    console.log('\n👤 Testing current user access...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('✅ Current user:', user.email);
        console.log('   Role from user_metadata:', user.user_metadata?.role);
        console.log('   Role from app_metadata:', user.app_metadata?.role);
      } else {
        console.log('❌ No current user (run with service role key)');
      }
    } catch (err) {
      console.log('❌ User check error:', err.message);
    }
    
  } catch (err) {
    console.error('💥 Script error:', err);
  }
}

checkDatabaseTables();
