const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateLeadSource() {
  try {
    console.log('🔧 Updating lead source to "Sales Navigator"...');
    
    const { data, error } = await supabase
      .from('leads')
      .update({
        enrichment_source: 'Sales Navigator',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', '9ab854aa-3468-4b4e-bbc0-358ccb39ed7c')
      .eq('user_id', '02a42d5c-0f65-4c58-8175-8304610c2ddc')
      .select('id, name, enrichment_source');
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log(`✅ Updated ${data.length} leads`);
      console.log('📋 Sample updated leads:');
      data.slice(0, 3).forEach((lead, i) => {
        console.log(`  ${i+1}. ${lead.name} - Source: ${lead.enrichment_source}`);
      });
    }
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

updateLeadSource(); 