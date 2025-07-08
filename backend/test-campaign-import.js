#!/usr/bin/env node

// Test script to verify campaign lead import functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCampaignLeadImport() {
  console.log('🧪 Testing campaign lead import functionality...\n');

  // Test data
  const testUserId = '02a42d5c-0f65-4c58-8175-8304610c2ddc'; // Your super_admin user
  const testCampaignId = 'test-campaign-' + Date.now();
  const testLeads = [
    {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      title: 'Software Engineer',
      company: 'TechCorp',
      location: 'San Francisco, CA'
    },
    {
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      title: 'Product Manager',
      company: 'StartupInc',
      location: 'New York, NY'
    }
  ];

  try {
    // 1. Create a test campaign
    console.log('1️⃣ Creating test campaign...');
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        id: testCampaignId,
        user_id: testUserId,
        name: 'Test Campaign - Lead Import',
        status: 'draft',
        total_leads: 0,
        enriched_leads: 0
      })
      .select()
      .single();

    if (campaignError) throw campaignError;
    console.log('✅ Test campaign created:', campaign.id);

    // 2. Check initial credit balance
    console.log('\n2️⃣ Checking initial credit balance...');
    const { data: initialCredits } = await supabase
      .from('user_credits')
      .select('remaining_credits')
      .eq('user_id', testUserId)
      .single();
    
    console.log('💰 Initial credits:', initialCredits?.remaining_credits || 0);

    // 3. Test the import endpoint (simulate the API call)
    console.log('\n3️⃣ Testing lead import...');
    
    // Simulate the /api/leads/import endpoint logic
    const { CreditService } = await import('./services/creditService');
    
    // Check if user has enough credits
    const hasCredits = await CreditService.hasSufficientCredits(testUserId, testLeads.length);
    console.log('💳 Has sufficient credits:', hasCredits);

    if (!hasCredits) {
      console.log('❌ Insufficient credits for test');
      return;
    }

    // Import leads
    const normalizedLeads = testLeads.map(lead => ({
      user_id: testUserId,
      campaign_id: testCampaignId,
      first_name: lead.first_name,
      last_name: lead.last_name,
      name: `${lead.first_name} ${lead.last_name}`,
      email: lead.email,
      title: lead.title,
      company: lead.company,
      location: lead.location,
      status: 'New',
      created_at: new Date().toISOString()
    }));

    const { data: insertedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(normalizedLeads)
      .select('*');

    if (insertError) throw insertError;
    console.log('✅ Leads inserted:', insertedLeads.length);

    // Deduct credits
    await CreditService.useCreditsEffective(testUserId, testLeads.length);
    await CreditService.logCreditUsage(
      testUserId,
      testLeads.length,
      'api_usage',
      `Test campaign lead import: ${testLeads.length} leads added to campaign ${testCampaignId}`
    );
    console.log('✅ Credits deducted and logged');

    // Update campaign counts
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', testCampaignId);

    const { count: enrichedLeads } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', testCampaignId)
      .not('email', 'is', null)
      .neq('email', '');

    await supabase
      .from('campaigns')
      .update({ 
        total_leads: totalLeads || 0,
        enriched_leads: enrichedLeads || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', testCampaignId);

    console.log('✅ Campaign counts updated');

    // 4. Verify results
    console.log('\n4️⃣ Verifying results...');

    // Check updated campaign
    const { data: updatedCampaign } = await supabase
      .from('campaigns')
      .select('total_leads, enriched_leads')
      .eq('id', testCampaignId)
      .single();

    console.log('📊 Campaign totals:', updatedCampaign);

    // Check credit balance
    const { data: finalCredits } = await supabase
      .from('user_credits')
      .select('remaining_credits')
      .eq('user_id', testUserId)
      .single();

    console.log('💰 Final credits:', finalCredits?.remaining_credits || 0);
    console.log('💸 Credits used:', (initialCredits?.remaining_credits || 0) - (finalCredits?.remaining_credits || 0));

    // Check credit usage log
    const { data: usageLog } = await supabase
      .from('credit_usage_log')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('📝 Recent credit usage log:');
    usageLog?.forEach(log => {
      console.log(`   ${log.type}: ${log.amount} credits - ${log.description}`);
    });

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('leads').delete().eq('campaign_id', testCampaignId);
    await supabase.from('campaigns').delete().eq('id', testCampaignId);
    console.log('✅ Cleanup completed');
  }
}

if (require.main === module) {
  testCampaignLeadImport();
} 