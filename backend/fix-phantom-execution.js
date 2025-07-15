const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPhantomExecution() {
  try {
    console.log('🔧 Fixing PhantomBuster execution...');
    
    // 1. Update the execution with real PhantomBuster container ID
    const { data: updateData, error: updateError } = await supabase
      .from('campaign_executions')
      .update({
        phantombuster_execution_id: '3566929249603604', // Real container ID
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', 'zapier-1752548579212-9ab854') // Old temporary ID
      .select();

    if (updateError) {
      console.error('❌ Error updating execution:', updateError);
      return;
    }

    console.log('✅ Updated execution record:', updateData);

    // 2. Fetch results from PhantomBuster API
    console.log('📥 Fetching results from PhantomBuster...');
    
    const response = await axios.get('https://api.phantombuster.com/api/v2/agents/fetch-output', {
      params: {
        id: '3566929249603604',
        output: 'latest'
      },
      headers: {
        'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY
      },
      timeout: 30000
    });

    const results = response.data.output || [];
    console.log(`✅ Fetched ${results.length} results from PhantomBuster`);

    if (results.length === 0) {
      console.log('⚠️ No results found in PhantomBuster output');
      return;
    }

    // 3. Process leads into database
    console.log('💾 Processing leads into database...');
    
    const execution = updateData[0];
    const leadsToInsert = [];

    for (const result of results) {
      const lead = {
        user_id: execution.user_id,
        campaign_id: execution.campaign_id,
        first_name: result.firstName || result.firstname || '',
        last_name: result.lastName || result.lastname || '',
        title: result.title || '',
        company: result.company || '',
        linkedin_url: result.linkedinUrl || result.profileUrl || '',
        location: result.location || '',
        status: 'New',
        created_at: new Date().toISOString()
      };

      // Only add if we have at least first name or last name
      if (lead.first_name || lead.last_name) {
        leadsToInsert.push(lead);
      }
    }

    console.log(`📝 Inserting ${leadsToInsert.length} leads...`);

    // Insert leads in batches
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize);
      
      const { data: insertData, error: insertError } = await supabase
        .from('leads')
        .insert(batch)
        .select();

      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
        continue;
      }

      totalInserted += insertData.length;
      console.log(`✅ Inserted batch ${i / batchSize + 1}: ${insertData.length} leads`);
    }

    // 4. Update campaign status
    console.log('🏁 Updating campaign status...');
    
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.campaign_id);

    if (campaignError) {
      console.error('❌ Error updating campaign:', campaignError);
    } else {
      console.log('✅ Campaign marked as completed');
    }

    console.log(`\n🎉 SUCCESS! Processed ${totalInserted} leads from PhantomBuster`);
    console.log(`📊 Campaign: ${execution.campaign_id}`);
    console.log(`👤 User: ${execution.user_id}`);
    console.log(`🔗 PhantomBuster Container: 3566929249603604`);

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixPhantomExecution(); 