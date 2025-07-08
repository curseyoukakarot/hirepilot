import { createClient } from '@supabase/supabase-js';
import { CreditService } from '../services/creditService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillUserCredits() {
  try {
    console.log('🚀 Starting credit backfill for existing users...');

    // Get all users from the public.users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, firstName, lastName');

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found in the database.');
      return;
    }

    console.log(`📊 Found ${users.length} users to process`);

    // Get existing credit records to avoid duplicates
    const { data: existingCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('user_id');

    if (creditsError) {
      console.error('❌ Error fetching existing credits:', creditsError);
      throw creditsError;
    }

    const existingCreditUserIds = new Set(
      (existingCredits || []).map(c => c.user_id)
    );

    // Filter users who don't have credits yet
    const usersWithoutCredits = users.filter(user => !existingCreditUserIds.has(user.id));

    console.log(`🎯 ${usersWithoutCredits.length} users need credit allocation`);

    if (usersWithoutCredits.length === 0) {
      console.log('✅ All users already have credits assigned.');
      return;
    }

    // Process each user
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const user of usersWithoutCredits) {
      try {
        const role = user.role || 'member'; // Default to member if no role
        
        console.log(`🔄 Processing ${user.email} (${role})...`);
        
        await CreditService.allocateCreditsBasedOnRole(user.id, role, 'admin_grant');
        
        successCount++;
        console.log(`✅ Assigned credits to ${user.email} (${role})`);
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to assign credits to ${user.email}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Summary
    console.log('\n📋 BACKFILL SUMMARY:');
    console.log(`✅ Successfully processed: ${successCount} users`);
    console.log(`❌ Errors encountered: ${errorCount} users`);
    
    if (errors.length > 0) {
      console.log('\n🚨 Error details:');
      errors.forEach(error => console.log(`   ${error}`));
    }

    // Verify results
    console.log('\n🔍 Verifying results...');
    const { data: finalCredits, error: finalError } = await supabase
      .from('user_credits')
      .select('user_id')
      .in('user_id', users.map(u => u.id));

    if (finalError) {
      console.error('❌ Error verifying results:', finalError);
    } else {
      const usersWithCredits = finalCredits?.length || 0;
      console.log(`📊 Total users with credits after backfill: ${usersWithCredits}/${users.length}`);
    }

    console.log('\n🎉 Backfill completed!');

  } catch (error) {
    console.error('💥 Fatal error during backfill:', error);
    throw error;
  } finally {
    process.exit();
  }
}

// Run the backfill
if (require.main === module) {
  backfillUserCredits()
    .then(() => {
      console.log('Script completed successfully');
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { backfillUserCredits }; 