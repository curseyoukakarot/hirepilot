const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLeadSourceConstraint() {
  console.log('🔧 Fixing lead_source_type constraint...\n');

  try {
    // First, let's try to drop any existing constraint
    console.log('1. Dropping existing lead_source_type constraint...');
    
    const dropConstraintSQL = `
      ALTER TABLE campaigns 
      DROP CONSTRAINT IF EXISTS chk_lead_source;
    `;
    
    const { error: dropError } = await supabase.rpc('exec_raw_sql', {
      query: dropConstraintSQL
    });
    
    if (dropError) {
      console.log('Note: Could not drop constraint (might not exist):', dropError.message);
    } else {
      console.log('✅ Dropped existing constraint');
    }

    // Now create the correct constraint
    console.log('2. Creating new lead_source_type constraint...');
    
    const createConstraintSQL = `
      ALTER TABLE campaigns 
      ADD CONSTRAINT chk_lead_source 
      CHECK (lead_source_type IN ('linkedin', 'apollo', 'csv'));
    `;
    
    const { error: createError } = await supabase.rpc('exec_raw_sql', {
      query: createConstraintSQL
    });
    
    if (createError) {
      console.error('❌ Error creating constraint:', createError);
    } else {
      console.log('✅ Created new constraint');
    }

    // Test the constraint
    console.log('3. Testing constraint...');
    
    const testSources = ['linkedin', 'apollo', 'csv'];
    
    for (const source of testSources) {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            name: `Test ${source} Campaign`,
            user_id: 'cd9f9e70-4a67-4b65-b35c-4ab458fb2e06',
            status: 'draft',
            lead_source_type: source,
            total_leads: 0,
            enriched_leads: 0
          })
          .select()
          .single();
        
        if (error) {
          console.log(`❌ ${source}: ${error.message}`);
        } else {
          console.log(`✅ ${source}: Success`);
          // Clean up
          await supabase.from('campaigns').delete().eq('id', data.id);
        }
      } catch (e) {
        console.log(`❌ ${source}: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

fixLeadSourceConstraint().then(() => {
  console.log('\n🏁 Constraint fix completed');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
}); 