#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
    const migrationPath = path.join(__dirname, 'migrations', '20250118000000_fix_credit_usage_log_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    console.log('SQL to execute:', migrationSql);

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSql
    });

    if (error) {
      console.error('Error applying migration:', error);
      // Try using the raw SQL approach
      console.log('Trying raw SQL approach...');
      
      // Split SQL statements and execute them one by one
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.substring(0, 100)}...`);
          const { error: stmtError } = await supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (stmtError) {
            console.error('Error executing statement:', stmtError);
            console.error('Statement:', statement);
          } else {
            console.log('Statement executed successfully');
          }
        }
      }
    } else {
      console.log('Migration applied successfully!');
      console.log('Result:', data);
    }
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration(); 