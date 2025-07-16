const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchFromS3() {
  try {
    console.log('🔧 Fetching PhantomBuster results from S3...');
    
    const campaignId = '7c6d8641-f56f-4fcc-81e3-2a9c629ce949';
    const executionId = '7601283125039528';
    
    // These S3 URLs were shown in the PhantomBuster execution logs
    const jsonUrl = 'https://phantombuster.s3.amazonaws.com/173s8h3USpQ/eq7TT3UAbjs7I1IV1foAAQ/result.json';
    
    console.log('📥 Fetching results from S3 JSON URL...');
    console.log('  URL:', jsonUrl);
    
    const response = await axios.get(jsonUrl, { timeout: 30000 });
    const results = response.data;
    
    console.log(`✅ Fetched ${results.length} results from S3`);
    
    if (results.length > 0) {
      console.log('\n📋 Sample result:');
      const sample = results[0];
      console.log('  Name:', sample.firstName, sample.lastName);
      console.log('  Title:', sample.linkedinJobTitle);
      console.log('  Company:', sample.companyName);
      console.log('  LinkedIn URL:', sample.linkedinProfileUrl);
      console.log('  Location:', sample.location);
    }
    
    // Process results
    console.log('\n⚡ Processing leads...');
    let processedCount = 0;
    let errorCount = 0;
    
    for (const result of results) {
      try {
        const leadData = {
          campaign_id: campaignId,
          user_id: '02a42d5c-0f65-4c58-8175-8304610c2ddc',
          first_name: result.firstName || '',
          last_name: result.lastName || '',
          email: result.email || null,
          company_name: result.companyName || '',
          title: result.linkedinJobTitle || '',
          linkedin_url: result.linkedinProfileUrl || result.profileUrl || '',
          location: result.location || '',
          source: 'Sales Navigator',
          source_payload: JSON.stringify(result),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: insertError } = await supabase
          .from('leads')
          .insert(leadData);
        
        if (insertError) {
          console.error(`❌ Failed to insert lead ${result.firstName} ${result.lastName}:`, insertError.message);
          errorCount++;
        } else {
          processedCount++;
          if (processedCount % 10 === 0) {
            console.log(`  ✅ Processed ${processedCount} leads...`);
          }
        }
        
      } catch (leadError) {
        console.error('❌ Error processing individual lead:', leadError.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Lead processing completed:`);
    console.log(`  - Successfully imported: ${processedCount} leads`);
    console.log(`  - Errors: ${errorCount} leads`);
    
    console.log(`\n🎉 SUCCESS: ${processedCount} leads imported from S3!`);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

fetchFromS3(); 