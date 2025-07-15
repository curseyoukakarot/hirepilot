const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateExistingLeads() {
  try {
    console.log('🔧 Updating existing leads with correct field mappings...');
    
    // 1. Get existing leads for this campaign
    const { data: existingLeads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', '9ab854aa-3468-4b4e-bbc0-358ccb39ed7c')
      .eq('user_id', '02a42d5c-0f65-4c58-8175-8304610c2ddc');

    if (leadsError) {
      console.error('❌ Error fetching existing leads:', leadsError);
      return;
    }

    console.log(`✅ Found ${existingLeads.length} existing leads to update`);

    // 2. Fetch fresh results from S3 to get the original data
    console.log('📥 Fetching fresh results from S3...');
    
    const s3Url = 'https://phantombuster.s3.amazonaws.com/173s8h3USpQ/eq7TT3UAbjs7I1IV1foAAQ/result.json';
    
    const response = await axios.get(s3Url, {
      timeout: 30000
    });

    const results = response.data || [];
    console.log(`✅ Fetched ${results.length} results from S3`);

    // 3. Create a mapping of LinkedIn URLs to PhantomBuster data
    const resultsByLinkedIn = {};
    results.forEach(result => {
      const linkedinUrl = result.linkedinUrl || result.profileUrl || '';
      if (linkedinUrl) {
        resultsByLinkedIn[linkedinUrl] = result;
      }
      // Also map by profileUrl in case that was used as the original key
      if (result.profileUrl && result.profileUrl !== linkedinUrl) {
        resultsByLinkedIn[result.profileUrl] = result;
      }
    });

    // 4. Update each existing lead
    console.log('🔄 Updating leads with correct field mappings...');
    
    let updatedCount = 0;
    
    for (const lead of existingLeads) {
      const linkedinUrl = lead.linkedin_url;
      const phantomData = resultsByLinkedIn[linkedinUrl];
      
      if (!phantomData) {
        console.log(`⚠️ No PhantomBuster data found for lead: ${lead.first_name} ${lead.last_name}`);
        continue;
      }

      // Build corrected data
      const firstName = phantomData.firstName || phantomData.firstname || '';
      const lastName = phantomData.lastName || phantomData.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const location = phantomData.location || phantomData.city || '';

      const updateData = {
        name: fullName, // Frontend expects this field
        location: location,
        city: phantomData.city || '',
        state: phantomData.state || '',
        country: phantomData.country || '',
        campaign_location: location,
        linkedin_url: phantomData.linkedinUrl || phantomData.profileUrl || lead.linkedin_url, // Prioritize linkedinUrl
        enrichment_source: 'Sales Navigator', // Frontend expects this field
        enrichment_data: JSON.stringify({
          location: location,
          source: 'Sales Navigator',
          originalUrl: linkedinUrl,
          linkedinUrl: phantomData.linkedinUrl, // Store the actual LinkedIn URL
          profileUrl: phantomData.profileUrl    // Store the Sales Navigator URL for reference
        }),
        updated_at: new Date().toISOString()
      };

      // Update the lead
      const { error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id);

      if (updateError) {
        console.error(`❌ Error updating lead ${lead.id}:`, updateError);
      } else {
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`✅ Updated ${updatedCount} leads...`);
        }
      }
    }

    console.log(`\n🎉 SUCCESS! Updated ${updatedCount} leads with correct field mappings`);
    console.log(`📊 Campaign: 9ab854aa-3468-4b4e-bbc0-358ccb39ed7c`);
    console.log(`👤 User: 02a42d5c-0f65-4c58-8175-8304610c2ddc`);
    
    // 5. Show sample of updated leads
    console.log(`📋 Sample updated leads:`);
    
    const { data: sampleLeads, error: sampleError } = await supabase
      .from('leads')
      .select('name, title, company, location, enrichment_source, linkedin_url')
      .eq('campaign_id', '9ab854aa-3468-4b4e-bbc0-358ccb39ed7c')
      .limit(3);

    if (sampleError) {
      console.error('❌ Error fetching sample leads:', sampleError);
    } else {
      sampleLeads.forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.name} - ${lead.title} at ${lead.company}`);
        console.log(`     Location: ${lead.location || 'Unknown'}`);
        console.log(`     LinkedIn: ${lead.linkedin_url ? 'Yes' : 'No'}`);
        console.log(`     Source: ${lead.enrichment_source || 'Unknown'}`);
        console.log('');
      });
    }

    // 6. Update campaign status
    console.log('🏁 Updating campaign status...');
    
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', '9ab854aa-3468-4b4e-bbc0-358ccb39ed7c');

    if (campaignError) {
      console.error('❌ Error updating campaign:', campaignError);
    } else {
      console.log('✅ Campaign marked as completed');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
updateExistingLeads(); 