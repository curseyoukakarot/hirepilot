const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicateLeads() {
  try {
    console.log('🧹 Cleaning up duplicate leads caused by race condition...');
    
    // Find leads with no contact data (likely duplicates from the bug)
    const { data: emptyLeads, error: selectError } = await supabase
      .from('leads')
      .select('id, user_id, campaign_id, first_name, last_name, name, title, company, linkedin_url, created_at')
      .or('first_name.is.null,last_name.is.null,name.is.null')
      .or('first_name.eq.,last_name.eq.,name.eq.')
      .eq('enrichment_source', 'Sales Navigator')
      .order('created_at', { ascending: true });

    if (selectError) {
      console.error('❌ Error fetching empty leads:', selectError);
      return;
    }

    console.log(`📊 Found ${emptyLeads.length} leads with no contact data`);

    if (emptyLeads.length === 0) {
      console.log('✅ No duplicate leads found to clean up');
      return;
    }

    // Group by campaign to see the distribution
    const byCampaign = {};
    emptyLeads.forEach(lead => {
      const key = lead.campaign_id;
      if (!byCampaign[key]) {
        byCampaign[key] = 0;
      }
      byCampaign[key]++;
    });

    console.log('📈 Distribution by campaign:');
    Object.entries(byCampaign).forEach(([campaignId, count]) => {
      console.log(`  Campaign ${campaignId}: ${count} empty leads`);
    });

    // Ask for confirmation (in a real run, you might want to add prompts)
    console.log('⚠️  This will DELETE all leads with no contact data from Sales Navigator');
    console.log('🔄 Proceeding with cleanup...');

    // Delete empty leads in batches to avoid timeout
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < emptyLeads.length; i += batchSize) {
      const batch = emptyLeads.slice(i, i + batchSize);
      const ids = batch.map(lead => lead.id);

      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error(`❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, deleteError);
        continue;
      }

      deletedCount += batch.length;
      console.log(`✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} leads (total: ${deletedCount})`);
    }

    console.log(`\n🎉 SUCCESS! Deleted ${deletedCount} duplicate/empty leads`);
    console.log('📋 Summary:');
    console.log(`  - Total leads processed: ${emptyLeads.length}`);
    console.log(`  - Successfully deleted: ${deletedCount}`);
    console.log(`  - Failed deletions: ${emptyLeads.length - deletedCount}`);

    // Show remaining lead count
    const { count: remainingCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('enrichment_source', 'Sales Navigator');

    console.log(`  - Remaining Sales Navigator leads: ${remainingCount || 0}`);

  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupDuplicateLeads();
}

module.exports = { cleanupDuplicateLeads }; 