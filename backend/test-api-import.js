const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testApiImport() {
  console.log('🧪 Testing actual /api/leads/import endpoint...\n');

  try {
    // 1. Get a real user ID and create a test campaign
    const realUserId = '031bcc33-5d93-4e1e-8168-99181ab36c07';
    
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name: 'Test API Import Campaign',
        user_id: realUserId,
        status: 'draft',
        total_leads: 0,
        enriched_leads: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (campaignError) {
      console.error('❌ Error creating test campaign:', campaignError);
      return;
    }

    console.log('✅ Created test campaign:', campaign.id);

    // 2. Prepare test leads data (like the frontend sends)
    const testLeads = [
      {
        user_id: realUserId,
        first_name: 'John',
        last_name: 'Doe',
        name: 'John Doe',
        email: 'john.doe@example.com',
        title: 'Software Engineer',
        company: 'Tech Corp',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        location: 'San Francisco, CA, USA',
        enrichment_data: {
          location: 'San Francisco, CA, USA',
          source: 'Apollo'
        },
        enrichment_source: 'Apollo',
        status: 'New',
        created_at: new Date().toISOString(),
      },
      {
        user_id: realUserId,
        first_name: 'Jane',
        last_name: 'Smith',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        title: 'Product Manager',
        company: 'Innovation Inc',
        linkedin_url: 'https://linkedin.com/in/janesmith',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        location: 'San Francisco, CA, USA',
        enrichment_data: {
          location: 'San Francisco, CA, USA',
          source: 'Apollo'
        },
        enrichment_source: 'Apollo',
        status: 'New',
        created_at: new Date().toISOString(),
      }
    ];

    // 3. Get auth token for API call
    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
      email: 'brandon@hirepilot.ai', // Replace with actual user email
      password: 'your-password' // You'll need to set this
    });

    if (authError) {
      console.log('⚠️  Auth failed, using service role key instead');
      // We'll use service role key approach instead
    }

    // 4. Call the actual API endpoint
    console.log('\n📡 Calling /api/leads/import endpoint...');
    const apiUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/leads/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify({
        campaignId: campaign.id,
        leads: testLeads
      })
    });

    console.log('📊 Response status:', response.status);
    
    let responseData;
    try {
      responseData = await response.json();
      console.log('📊 Response data:', responseData);
    } catch (e) {
      const responseText = await response.text();
      console.log('📊 Response text:', responseText);
    }

    // 5. Check the campaign counts directly in database
    console.log('\n🔍 Checking campaign counts in database...');
    
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign.id)
      .single();

    console.log('📊 Updated campaign:', {
      id: updatedCampaign.id,
      name: updatedCampaign.name,
      total_leads: updatedCampaign.total_leads,
      enriched_leads: updatedCampaign.enriched_leads,
      status: updatedCampaign.status
    });

    // 6. Check actual leads in database
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', campaign.id);

    console.log('📊 Leads in database:', leads?.length || 0);
    if (leads && leads.length > 0) {
      leads.forEach((lead, i) => {
        console.log(`  ${i+1}. ${lead.first_name} ${lead.last_name} - ${lead.email || 'no email'}`);
      });
    }

    // 7. Check if API was successful
    if (response.ok && responseData?.success) {
      console.log('\n🎉 API call was successful!');
      if (updatedCampaign.total_leads === testLeads.length) {
        console.log('✅ Campaign counts updated correctly!');
      } else {
        console.log('❌ Campaign counts NOT updated correctly');
      }
    } else {
      console.log('\n❌ API call failed');
    }

    // 8. Clean up
    console.log('\n🧹 Cleaning up test data...');
    
    await supabase
      .from('leads')
      .delete()
      .eq('campaign_id', campaign.id);

    await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign.id);

    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testApiImport().then(() => {
  console.log('\n🏁 API test completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
}); 