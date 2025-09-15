/**
 * Backfill Team Invite Status Script
 * 
 * This script updates team_invites status from 'pending' to 'accepted' for users
 * who have already completed onboarding but their invite status wasn't updated.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillTeamInviteStatus() {
  console.log('🔄 Starting team invite status backfill...\n');

  try {
    // Step 1: Find all pending team invites
    console.log('📋 Step 1: Fetching pending team invites...');
    const { data: pendingInvites, error: invitesError } = await supabase
      .from('team_invites')
      .select('*')
      .eq('status', 'pending');

    if (invitesError) {
      throw new Error(`Failed to fetch pending invites: ${invitesError.message}`);
    }

    console.log(`Found ${pendingInvites.length} pending invites`);

    if (pendingInvites.length === 0) {
      console.log('✅ No pending invites found. Nothing to backfill.');
      return;
    }

    // Step 2: Check which users have completed onboarding
    console.log('\n📋 Step 2: Checking user onboarding status...');
    
    const emails = pendingInvites.map(invite => invite.email);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, onboarding_complete')
      .in('email', emails);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`Found ${users.length} users in database`);

    // Step 3: Identify invites that should be marked as accepted
    const invitesToUpdate = [];
    const usersByEmail = new Map(users.map(user => [user.email, user]));

    for (const invite of pendingInvites) {
      const user = usersByEmail.get(invite.email);
      if (user && user.onboarding_complete === true) {
        invitesToUpdate.push({
          inviteId: invite.id,
          email: invite.email,
          name: `${invite.first_name} ${invite.last_name}`,
          role: invite.role
        });
      }
    }

    console.log(`\n📋 Step 3: Found ${invitesToUpdate.length} invites to update`);

    if (invitesToUpdate.length === 0) {
      console.log('✅ No invites need updating. All pending users are still in onboarding.');
      return;
    }

    // Step 4: Update the invite statuses
    console.log('\n📋 Step 4: Updating invite statuses...');
    
    const inviteIds = invitesToUpdate.map(item => item.inviteId);
    const { error: updateError } = await supabase
      .from('team_invites')
      .update({ 
        status: 'accepted'
      })
      .in('id', inviteIds);

    if (updateError) {
      throw new Error(`Failed to update invites: ${updateError.message}`);
    }

    // Step 5: Report results
    console.log('\n✅ Backfill completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Total pending invites found: ${pendingInvites.length}`);
    console.log(`- Users with completed onboarding: ${users.filter(u => u.onboarding_complete).length}`);
    console.log(`- Invites updated to 'accepted': ${invitesToUpdate.length}`);
    
    console.log('\n👥 Updated invites:');
    invitesToUpdate.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.email}) - ${item.role}`);
    });

    console.log('\n🎉 All done! The team management interface should now show these users as "Active".');

  } catch (error) {
    console.error('❌ Error during backfill:', error.message);
    process.exit(1);
  }
}

// Run the backfill
if (require.main === module) {
  backfillTeamInviteStatus();
}

module.exports = { backfillTeamInviteStatus };
