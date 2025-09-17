// Backfill user app_metadata.role for all existing users
// This ensures all current users have a role assigned in their JWT claims

import { createClient } from '@supabase/supabase-js';

// Use service role key here
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('🔄 Backfilling user roles into app_metadata...\n');
  
  try {
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    console.log(`📊 Found ${users?.users?.length || 0} users to process\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const u of users?.users || []) {
      try {
        // Get role from public.users table first, then fallback to user_metadata
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', u.id)
          .maybeSingle();

        const role = userData?.role || u.user_metadata?.role || 'member'; // default fallback
        
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          u.id,
          {
            app_metadata: {
              ...u.app_metadata,
              role,
              allowed_roles: ['super_admin', 'team_admin', 'recruitpro', 'member', 'authenticated']
            }
          }
        );
        
        if (updateErr) {
          console.error('❌ Failed to update', u.email || u.id, updateErr);
          errorCount++;
        } else {
          console.log('✅ Updated user', u.email || u.id, '→ role:', role);
          successCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error('💥 Exception updating user', u.email || u.id, err);
        errorCount++;
      }
    }

    console.log(`\n📊 Backfill complete:`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (successCount > 0) {
      console.log(`\n🎉 Users need to log out and log back in to get new JWTs with roles!`);
    }
    
  } catch (err) {
    console.error('💥 Script error:', err);
  }
}

run();
