// Script to update user metadata with roles from users table
// Run this with service role key to backfill user roles

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateUserRoles() {
  console.log('🔄 Updating user roles in auth.users metadata...');
  
  try {
    // Get all users from public.users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, email');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users to update`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Update auth.users with role in user_metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          {
            user_metadata: { 
              role: user.role || 'free',
              email: user.email 
            }
          }
        );
        
        if (updateError) {
          console.error(`Error updating user ${user.email}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Updated ${user.email} with role: ${user.role || 'free'}`);
          successCount++;
        }
      } catch (err) {
        console.error(`Exception updating user ${user.email}:`, err);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Update complete:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

// Run the update
updateUserRoles();
