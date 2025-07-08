const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleCampaignFlow() {
  console.log('🧪 Testing simplified campaign count flow...\n');

  try {
    // 1. Create a test campaign WITHOUT lead_source_type (to avoid constraint issue)
    const testCampaignData = {
      name: 'Test Count Update Campaign',
      user_id: '031bcc33-5d93-4e1e-8168-99181ab36c07',
      status: 'draft',
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

    // 2. Create test leads 
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
        status: 'New',
        created_at: new Date().toISOString(),
      },
      {
        user_id: testCampaignData.user_id,
        campaign_id: campaign.id,
        first_name: 'Bob',
        last_name: 'Wilson',
        name: 'Bob Wilson',
        email: null, // This one has no email, so won't count as enriched
        title: 'Designer',
        company: 'Creative Co',
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

    // 4. Test the exact count update logic from the API endpoint
    console.log('\n📊 Testing campaign count updates (exact API logic)...');

    // Get total and enriched lead counts for this campaign (EXACT same query as API)
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

    // Update campaign with new counts (EXACT same update as API)
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

    console.log('\n📝 Lead details:');
    finalLeads.forEach((lead, i) => {
      console.log(`  ${i+1}. ${lead.first_name} ${lead.last_name} - Email: ${lead.email || 'none'} - Campaign: ${lead.campaign_id}`);
    });

    // 6. Expected vs Actual
    console.log('\n✅ Expected: 3 total leads, 2 enriched leads');
    console.log(`📊 Actual: ${finalCampaign.total_leads} total leads, ${finalCampaign.enriched_leads} enriched leads`);

    if (finalCampaign.total_leads === 3 && finalCampaign.enriched_leads === 2) {
      console.log('🎉 SUCCESS: Campaign counts updated correctly!');
    } else {
      console.log('❌ FAILURE: Campaign counts are incorrect');
    }

    // 7. Clean up
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

testSimpleCampaignFlow().then(() => {
  console.log('\n🏁 Simple campaign flow test completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
}); 