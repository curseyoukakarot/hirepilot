const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaignCounts() {
  console.log('🧪 Testing campaign count updates...\n');

  try {
    // 1. Get a campaign with leads
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, total_leads, enriched_leads')
      .limit(5);

    if (campaignError) {
      console.error('❌ Error fetching campaigns:', campaignError);
      return;
    }

    console.log('📋 Available campaigns:');
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.id}) - ${c.total_leads} total, ${c.enriched_leads} enriched`);
    });

    // 2. Pick first campaign with leads
    const testCampaign = campaigns.find(c => c.total_leads > 0);
    if (!testCampaign) {
      console.log('⚠️  No campaigns with leads found');
      return;
    }

    console.log(`\n🎯 Testing campaign: ${testCampaign.name} (${testCampaign.id})`);

    // 3. Get actual lead counts from database
    const { count: actualTotalLeads, error: totalError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', testCampaign.id);

    const { count: actualEnrichedLeads, error: enrichedError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', testCampaign.id)
      .not('email', 'is', null)
      .neq('email', '');

    console.log('📊 Database counts:');
    console.log(`  - Total leads in leads table: ${actualTotalLeads}`);
    console.log(`  - Enriched leads in leads table: ${actualEnrichedLeads}`);
    console.log(`  - Campaign.total_leads: ${testCampaign.total_leads}`);
    console.log(`  - Campaign.enriched_leads: ${testCampaign.enriched_leads}`);

    // 4. Check for mismatches
    if (actualTotalLeads !== testCampaign.total_leads) {
      console.log('⚠️  MISMATCH: Campaign total_leads doesn\'t match actual count');
    }

    if (actualEnrichedLeads !== testCampaign.enriched_leads) {
      console.log('⚠️  MISMATCH: Campaign enriched_leads doesn\'t match actual count');
    }

    // 5. Update the campaign counts manually
    console.log('\n🔄 Updating campaign counts...');
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        total_leads: actualTotalLeads || 0,
        enriched_leads: actualEnrichedLeads || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', testCampaign.id);

    if (updateError) {
      console.error('❌ Error updating campaign:', updateError);
    } else {
      console.log('✅ Campaign counts updated successfully');
    }

    // 6. Show sample leads for debugging
    console.log('\n📝 Sample leads for this campaign:');
    const { data: sampleLeads } = await supabase
      .from('leads')
      .select('id, first_name, last_name, email, campaign_id')
      .eq('campaign_id', testCampaign.id)
      .limit(3);

    sampleLeads?.forEach((lead, i) => {
      console.log(`${i + 1}. ${lead.first_name} ${lead.last_name} (${lead.email || 'no email'}) - Campaign: ${lead.campaign_id}`);
    });

    // 7. Test specific SQL queries
    console.log('\n🔍 Testing specific count queries...');
    
    if (totalError) {
      console.error('❌ Total count error:', totalError);
    }
    
    if (enrichedError) {
      console.error('❌ Enriched count error:', enrichedError);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCampaignCounts().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
}); 