// Script to inject user roles into app_metadata for JWT claims
// This fixes the 403s by ensuring JWTs contain role information

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function injectUserRoles() {
  console.log('🔄 Injecting user roles into app_metadata...\n');
  
  try {
    // Get all users from public.users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, email');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`📊 Found ${users.length} users to process`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      try {
        // Get current user from auth.users
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id);
        
        if (authError) {
          console.error(`❌ Error fetching auth user ${user.email}:`, authError);
          errorCount++;
          continue;
        }
        
        if (!authUser.user) {
          console.log(`⚠️  Auth user not found for ${user.email}, skipping`);
          skippedCount++;
          continue;
        }
        
        const currentRole = user.role || 'free';
        const currentAppMetadata = authUser.user.app_metadata || {};
        
        // Check if role is already correct
        if (currentAppMetadata.role === currentRole) {
          console.log(`⏭️  ${user.email} already has correct role: ${currentRole}`);
          skippedCount++;
          continue;
        }
        
        // Update app_metadata with role
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          {
            app_metadata: {
              ...currentAppMetadata,
              role: currentRole,
              allowed_roles: ['authenticated', currentRole]
            }
          }
        );
        
        if (updateError) {
          console.error(`❌ Error updating ${user.email}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Updated ${user.email} with role: ${currentRole}`);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`💥 Exception updating user ${user.email}:`, err);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Injection complete:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (successCount > 0) {
      console.log(`\n🎉 Users need to log out and log back in to get new JWTs with roles!`);
    }
    
  } catch (err) {
    console.error('💥 Script error:', err);
  }
}

// Run the injection
injectUserRoles();
