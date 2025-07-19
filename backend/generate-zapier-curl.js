require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateZapierCurl() {
  try {
    console.log('🚀 Generating Zapier webhook curl command...\n');

    // Get the most recent pending LinkedIn request
    const { data: queueItems, error } = await supabase
      .from('linkedin_outreach_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching queue items:', error);
      return;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('📭 No pending LinkedIn requests found to test with');
      return;
    }

    const item = queueItems[0];
    console.log('📊 Using this queue item for testing:');
    console.log(`   ID: ${item.id}`);
    console.log(`   LinkedIn URL: ${item.linkedin_url}`);
    console.log(`   Message: ${item.message}`);
    console.log(`   User ID: ${item.user_id}\n`);

    // Get the webhook URL from environment (same as CRON processor)
    const webhookUrl = process.env.ZAPIER_LINKEDIN_WEBHOOK_URL2 || "https://hooks.zapier.com/hooks/catch/18279230/u2qdg1l/";
    console.log(`🔗 Using webhook URL: ${webhookUrl}`);

    // Create the exact payload that our CRON processor sends
    const realSessionCookie = "AQEFAQ4BAAAAABb6jbYAAAGYB8PPSQAAAZgr0mQjVgAAsXVybjpsaTplbnRlcnByaXNlQXV0aFRva2VuOmVKeGpaQUFDbHRNeUwwRTBXNzFHTDRnV1BubGZoaEhFK049a1hRWm1SRDJhLzRlQkVRQzVKUW1iXnVybjpsaTplbnRlcnByaXNlUHJvZmlsZToodXJuOmxpOmVudGVycHJpc2VBY2NvdW50OjgwNDIwMDczLDEwODk5Njc0OSledXJuOmxpOm1lbWJlcjo1MjE1NDA0NQ5GFek4AeV6LPpZl8s0iMYNdrGmuezMdpKfWBiLbD1ECkY_s59o7kdZUJa-ApbtETy5QwzxrojJh1tIrnAl4zDOwaptCyoT5WnUi-UKN4HlQzD51yDWlhUk8QoJnssHm1Hn18L1n6MR3ITMvY-b-UYcB4Ts2w03jvNbrHYB1oJtB40_DR2CPlJmcmow3e4L9zHffx4";
    const testMessage = "Hi #firstName# would love to connect!";
    
    const payload = {
      linkedin_url: item.linkedin_url,
      message: testMessage,
      phantom_api_key: process.env.PHANTOMBUSTER_API_KEY,
      session_cookie: realSessionCookie,
      phantom_agent_id: item.phantom_agent_id,
      queue_item_id: item.id
    };

    console.log('📋 Payload being sent to Zapier:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('\n');

    // Generate the curl command
    const curlCommand = `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(payload, null, 0)}'`;

    console.log('🔧 Copy and paste this curl command to test your Zapier webhook:\n');
    console.log('```bash');
    console.log(curlCommand);
    console.log('```\n');

    // Also provide a pretty-printed version for readability
    console.log('📝 Pretty-printed payload for Zapier setup:');
    console.log('```json');
    console.log(JSON.stringify(payload, null, 2));
    console.log('```\n');

    console.log('💡 Notes:');
    console.log('   • Replace "YOUR_LINKEDIN_SESSION_COOKIE_HERE" with a real LinkedIn session cookie');
    console.log('   • The phantom_api_key should be your actual PhantomBuster API key');
    console.log('   • Watch the Zapier logs to see what gets received vs what PhantomBuster expects');
    console.log('   • PhantomBuster might expect "profileUrl" instead of "linkedin_url"');

  } catch (error) {
    console.error('❌ Error generating curl:', error);
  }
}

// Run the generator
generateZapierCurl(); 