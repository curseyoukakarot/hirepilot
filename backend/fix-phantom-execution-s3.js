const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPhantomExecutionFromS3() {
  try {
    console.log('🔧 Fetching PhantomBuster results from S3...');
    
    // 1. Get the execution record
    const { data: execution, error: executionError } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', '3566929249603604')
      .single();

    if (executionError || !execution) {
      console.error('❌ Error finding execution:', executionError);
      return;
    }

    console.log('✅ Found execution:', execution);

    // 2. Fetch results directly from S3 URL (from your PhantomBuster logs)
    console.log('📥 Fetching results from S3...');
    
    const s3Url = 'https://phantombuster.s3.amazonaws.com/173s8h3USpQ/eq7TT3UAbjs7I1IV1foAAQ/result.json';
    
    const response = await axios.get(s3Url, {
      timeout: 30000
    });

    const results = response.data || [];
    console.log(`✅ Fetched ${results.length} results from S3`);

    if (results.length === 0) {
      console.log('⚠️ No results found in S3 file');
      return;
    }

    // 3. Process leads into database
    console.log('💾 Processing leads into database...');
    
    const leadsToInsert = [];

    for (const result of results) {
      // Build full name
      const firstName = result.firstName || result.firstname || '';
      const lastName = result.lastName || result.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Build location from available fields
      const location = result.location || result.city || '';
      
      const lead = {
        user_id: execution.user_id,
        campaign_id: execution.campaign_id,
        first_name: firstName,
        last_name: lastName,
        name: fullName, // Frontend expects this field
        title: result.title || '',
        company: result.company || '',
        linkedin_url: result.linkedinUrl || result.profileUrl || '', // Prioritize linkedinUrl over profileUrl
        location: location,
        city: result.city || '',
        state: result.state || '',
        country: result.country || '',
        campaign_location: location,
        status: 'New',
        enrichment_source: 'Sales Navigator', // Frontend expects this field
        enrichment_data: JSON.stringify({
          location: location,
          source: 'Sales Navigator',
          originalUrl: result.linkedinUrl || result.profileUrl || '',
          linkedinUrl: result.linkedinUrl, // Store the actual LinkedIn URL
          profileUrl: result.profileUrl    // Store the Sales Navigator URL for reference
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

    // 5. Update execution status
    const { error: executionUpdateError } = await supabase
      .from('campaign_executions')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.id);

    if (executionUpdateError) {
      console.error('❌ Error updating execution:', executionUpdateError);
    } else {
      console.log('✅ Execution marked as completed');
    }

    console.log(`\n🎉 SUCCESS! Processed ${totalInserted} leads from PhantomBuster`);
    console.log(`📊 Campaign: ${execution.campaign_id}`);
    console.log(`👤 User: ${execution.user_id}`);
    console.log(`🔗 PhantomBuster Container: 3566929249603604`);
    console.log(`📋 Sample lead names:`);
    
    // Show first few leads
    leadsToInsert.slice(0, 5).forEach((lead, index) => {
      console.log(`  ${index + 1}. ${lead.first_name} ${lead.last_name} - ${lead.title} at ${lead.company}`);
    });

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixPhantomExecutionFromS3(); 