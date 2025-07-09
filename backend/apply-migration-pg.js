#!/usr/bin/env node

const { Client } = require('pg');
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

// Extract database connection details from Supabase URL
const url = new URL(supabaseUrl);
const host = url.hostname;
const database = 'postgres';
const port = 5432;
const password = serviceRoleKey;

// Create connection string
const connectionString = `postgresql://postgres:${password}@${host}:${port}/${database}`;

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250118000000_fix_credit_usage_log_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    console.log('SQL to execute:', migrationSql.substring(0, 200) + '...');

    // Execute the migration
    const result = await client.query(migrationSql);
    console.log('Migration applied successfully!');
    console.log('Result:', result);

  } catch (error) {
    console.error('Error applying migration:', error);
    console.error('Error details:', error.message);
    
    // Try executing statements one by one
    console.log('Trying to execute statements individually...');
    
    try {
      const migrationPath = path.join(__dirname, 'migrations', '20250118000000_fix_credit_usage_log_schema.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      
      // Split SQL statements and execute them one by one
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.substring(0, 100)}...`);
          try {
            const result = await client.query(statement);
            console.log('Statement executed successfully');
          } catch (stmtError) {
            console.error('Error executing statement:', stmtError.message);
            console.error('Statement:', statement);
          }
        }
      }
    } catch (retryError) {
      console.error('Error in retry logic:', retryError);
    }
    
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

applyMigration(); 