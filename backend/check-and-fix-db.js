#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract database connection details from Supabase URL
const url = new URL(supabaseUrl);
const host = url.hostname;
const database = 'postgres';
const port = 5432;
const password = serviceRoleKey;

// Create connection string
const connectionString = `postgresql://postgres:${password}@${host}:${port}/${database}`;

async function checkAndFixDatabase() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // First, check the current structure of credit_usage_log table
    console.log('Checking current structure of credit_usage_log table...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'credit_usage_log' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Current columns in credit_usage_log:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    const existingColumns = result.rows.map(row => row.column_name);
    const requiredColumns = ['amount', 'type', 'usage_type', 'description'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
      console.log('✅ All required columns exist! No migration needed.');
      return;
    }

    console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
    console.log('Applying migration...');

    // Apply the migration statements one by one
    const statements = [
      'ALTER TABLE credit_usage_log ADD COLUMN IF NOT EXISTS amount INTEGER;',
      "ALTER TABLE credit_usage_log ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('credit', 'debit'));",
      "ALTER TABLE credit_usage_log ADD COLUMN IF NOT EXISTS usage_type TEXT CHECK (usage_type IN ('campaign_creation', 'campaign_boost', 'api_usage'));",
      'ALTER TABLE credit_usage_log ADD COLUMN IF NOT EXISTS description TEXT;'
    ];

    for (const statement of statements) {
      console.log(`Executing: ${statement}`);
      try {
        await client.query(statement);
        console.log('✅ Success');
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    }

    // Update existing records
    console.log('Updating existing records...');
    const updateQuery = `
      UPDATE credit_usage_log 
      SET 
        amount = CASE 
          WHEN credits_used > 0 THEN credits_used
          ELSE -ABS(credits_used)
        END,
        type = CASE 
          WHEN credits_used > 0 THEN 'credit'
          ELSE 'debit'
        END,
        usage_type = 'api_usage',
        description = COALESCE(source, 'Credit usage')
      WHERE amount IS NULL;
    `;
    
    try {
      const updateResult = await client.query(updateQuery);
      console.log(`✅ Updated ${updateResult.rowCount} existing records`);
    } catch (error) {
      console.error('❌ Error updating records:', error.message);
    }

    // Add indexes
    console.log('Adding indexes...');
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_credit_usage_log_type ON credit_usage_log(type);',
      'CREATE INDEX IF NOT EXISTS idx_credit_usage_log_usage_type ON credit_usage_log(usage_type);'
    ];

    for (const statement of indexStatements) {
      console.log(`Executing: ${statement}`);
      try {
        await client.query(statement);
        console.log('✅ Success');
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    }

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

checkAndFixDatabase(); 