const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testApolloFlow() {
  console.log('🧪 Testing Apollo wizard flow...\n');

  try {
    // 1. Create a test campaign (simulating Step 1-3 of wizard)
    const testCampaignData = {
      name: 'Test Apollo Campaign',
      user_id: 'cd9f9e70-4a67-4b65-b35c-4ab458fb2e06', // Replace with actual user ID
      status: 'draft',
      lead_source_type: 'apollo',
      location: 'San Francisco, CA',
      total_leads: 0,
      enriched_leads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert(testCampaignData)
      .select()
      .single();

    if (campaignError) {
      console.error('❌ Error creating test campaign:', campaignError);
      return;
    }

    console.log('✅ Created test campaign:', campaign.id);

    // 2. Create test leads (simulating Apollo search results)
    const testLeads = [
      {
        user_id: testCampaignData.user_id,
        campaign_id: campaign.id,
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
        enrichment_data: JSON.stringify({
          location: 'San Francisco, CA, USA',
          source: 'Apollo'
        }),
        enrichment_source: 'Apollo',
        status: 'New',
        created_at: new Date().toISOString(),
      },
      {
        user_id: testCampaignData.user_id,
        campaign_id: campaign.id,
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
        enrichment_data: JSON.stringify({
          location: 'San Francisco, CA, USA',
          source: 'Apollo'
        }),
        enrichment_source: 'Apollo',
        status: 'New',
        created_at: new Date().toISOString(),
      }
    ];

    // 3. Simulate the /api/leads/import endpoint
    console.log('\n📝 Simulating leads import...');
    console.log('Adding', testLeads.length, 'leads to campaign', campaign.id);

    const { data: insertedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(testLeads)
      .select('*');

    if (insertError) {
      console.error('❌ Error inserting leads:', insertError);
      return;
    }

    console.log('✅ Inserted leads:', insertedLeads.length);

    // 4. Now test the count update logic (exactly like the API endpoint)
    console.log('\n📊 Testing campaign count updates...');

    // Get total and enriched lead counts for this campaign
    const { count: totalLeads, error: totalError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaign.id);

    const { count: enrichedLeads, error: enrichedError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaign.id)
      .not('email', 'is', null)
      .neq('email', '');

    console.log('📊 Count query results:', {
      totalLeads,
      enrichedLeads,
      totalError,
      enrichedError
    });

    // Update campaign with new counts
    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({ 
        total_leads: totalLeads || 0,
        enriched_leads: enrichedLeads || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    if (campaignUpdateError) {
      console.error('❌ Error updating campaign counts:', campaignUpdateError);
    } else {
      console.log('✅ Campaign counts updated successfully');
    }

    // 5. Verify the results
    console.log('\n🔍 Verifying final state...');
    
    const { data: finalCampaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign.id)
      .single();

    const { data: finalLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', campaign.id);

    console.log('📊 Final campaign state:');
    console.log(`  - Campaign ID: ${finalCampaign.id}`);
    console.log(`  - Campaign Name: ${finalCampaign.name}`);
    console.log(`  - Total Leads: ${finalCampaign.total_leads}`);
    console.log(`  - Enriched Leads: ${finalCampaign.enriched_leads}`);
    console.log(`  - Status: ${finalCampaign.status}`);
    console.log(`  - Actual leads in database: ${finalLeads.length}`);

    // 6. Clean up
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

testApolloFlow().then(() => {
  console.log('\n🏁 Apollo flow test completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
}); 