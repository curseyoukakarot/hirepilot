const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to extract regular LinkedIn profile URL from Sales Navigator URL
function extractLinkedInProfileUrl(salesNavUrl) {
  if (!salesNavUrl) return '';
  
  // If it's already a regular LinkedIn profile URL, return as is
  if (salesNavUrl.includes('linkedin.com/in/')) {
    return salesNavUrl;
  }
  
  // Extract profile identifier from Sales Navigator URL
  // Example: https://www.linkedin.com/sales/lead/ACwAABKmnABXjRcw-vLoY79TA4BsDgDeU,NAME_SEARCH,0KvS
  // We need to extract the profile ID and convert it to regular profile URL
  
  // For now, return empty string - we'll get the regular profile URL from PhantomBuster data
  // The PhantomBuster LinkedIn Sales Navigator scraper should provide both URLs
  return '';
}

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

    // 3. Delete existing leads for this campaign to avoid duplicates
    console.log('🗑️ Removing existing leads for this campaign...');
    
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('campaign_id', execution.campaign_id)
      .eq('user_id', execution.user_id);

    if (deleteError) {
      console.error('❌ Error deleting existing leads:', deleteError);
    } else {
      console.log('✅ Existing leads removed');
    }

    // 4. Process leads into database with correct field mappings
    console.log('💾 Processing leads into database...');
    
    const leadsToInsert = [];

    for (const result of results) {
      // Extract regular LinkedIn profile URL - prioritize linkedinUrl over profileUrl
      const linkedinProfileUrl = result.linkedinUrl || result.profileUrl || '';
      
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
        linkedin_url: linkedinProfileUrl, // Correct field name for frontend
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
          originalUrl: linkedinProfileUrl,
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

    console.log(`📝 Inserting ${leadsToInsert.length} leads with correct field mappings...`);

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

    // 5. Update campaign status
    console.log('🏁 Updating campaign status...');
    
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.campaign_id);

    if (campaignError) {
      console.error('❌ Error updating campaign:', campaignError);
    } else {
      console.log('✅ Campaign marked as completed');
    }

    // 6. Update execution status
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

    console.log(`\n🎉 SUCCESS! Processed ${totalInserted} leads with correct field mappings`);
    console.log(`📊 Campaign: ${execution.campaign_id}`);
    console.log(`👤 User: ${execution.user_id}`);
    console.log(`🔗 PhantomBuster Container: 3566929249603604`);
    console.log(`📋 Sample leads with correct data:`);
    
    // Show first few leads with all fields
    leadsToInsert.slice(0, 3).forEach((lead, index) => {
      console.log(`  ${index + 1}. ${lead.name} - ${lead.title} at ${lead.company}`);
      console.log(`     Location: ${lead.location}`);
      console.log(`     LinkedIn: ${lead.linkedin_url}`);
      console.log(`     Source: ${lead.enrichment_source}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
fixPhantomExecutionFromS3(); 