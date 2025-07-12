const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250111_fix_create_public_user_function.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration to fix create_public_user function...');
    console.log('SQL:', migrationSql);

    // Execute the migration using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSql
    });

    if (error) {
      console.error('Error applying migration:', error);
      console.log('Trying alternative approach...');
      
      // Try executing it as a simple query
      const { data: altData, error: altError } = await supabase
        .from('information_schema.routines')
        .select('*')
        .limit(1); // Just to test connection
      
      if (altError) {
        console.error('Connection test failed:', altError);
      } else {
        console.log('Connection works, but rpc exec_sql may not be available');
        console.log('Please run this SQL manually in your Supabase SQL editor:');
        console.log('---');
        console.log(migrationSql);
        console.log('---');
      }
    } else {
      console.log('Migration applied successfully!');
      console.log('Result:', data);
    }
  } catch (error) {
    console.error('Error applying migration:', error);
    
    // Provide manual instructions
    console.log('\nManual fix required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the following SQL:');
    console.log('---');
    
    const migrationPath = path.join(__dirname, 'migrations', '20250111_fix_create_public_user_function.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSql);
    console.log('---');
  }
}

applyMigration();