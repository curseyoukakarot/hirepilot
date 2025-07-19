require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLinkedInQueue() {
  try {
    console.log('🔍 Debugging LinkedIn queue data...\n');

    // Get all LinkedIn queue items
    const { data: queueItems, error } = await supabase
      .from('linkedin_outreach_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching queue items:', error);
      return;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('📭 No LinkedIn queue items found');
      return;
    }

    console.log(`📊 Found ${queueItems.length} LinkedIn queue items:\n`);

    queueItems.forEach((item, index) => {
      console.log(`🔸 Item ${index + 1}:`);
      console.log(`   ID: ${item.id}`);
      console.log(`   User ID: ${item.user_id}`);
      console.log(`   LinkedIn URL: "${item.linkedin_url}"`);
      console.log(`   LinkedIn URL type: ${typeof item.linkedin_url}`);
      console.log(`   LinkedIn URL length: ${item.linkedin_url?.length || 'N/A'}`);
      console.log(`   Message: "${item.message}"`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Credit Cost: ${item.credit_cost}`);
      console.log(`   Scheduled At: ${item.scheduled_at}`);
      console.log(`   Sent At: ${item.sent_at}`);
      console.log(`   Retry Count: ${item.retry_count}`);
      console.log(`   Phantom Agent ID: ${item.phantom_agent_id}`);
      console.log(`   Created At: ${item.created_at}`);
      console.log('');
    });

    // Check specifically for pending items
    const pendingItems = queueItems.filter(item => item.status === 'pending');
    console.log(`⏳ Pending items: ${pendingItems.length}`);
    
    if (pendingItems.length > 0) {
      console.log('\n🎯 Pending items that would be processed:');
      pendingItems.forEach((item, index) => {
        console.log(`   ${index + 1}. "${item.linkedin_url}" (${item.linkedin_url ? 'HAS URL' : 'NO URL!'})`);
      });
    }

    // Check for any items with null/undefined URLs
    const badUrls = queueItems.filter(item => !item.linkedin_url);
    if (badUrls.length > 0) {
      console.log('\n❌ Items with missing LinkedIn URLs:');
      badUrls.forEach((item, index) => {
        console.log(`   ${index + 1}. ID: ${item.id}, Status: ${item.status}, Created: ${item.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug
debugLinkedInQueue(); 