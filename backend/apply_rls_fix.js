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

async function applyRLSFix() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250124_fix_rls_policies.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Applying RLS policy fixes...');
    console.log('Migration file:', migrationPath);

    // Split SQL statements and execute them one by one
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`\n${i + 1}. Executing: ${statement.substring(0, 80)}...`);
        try {
          const result = await client.query(statement);
          console.log('   ✅ Success');
        } catch (stmtError) {
          console.error(`   ❌ Error: ${stmtError.message}`);
          // Continue with other statements even if one fails
        }
      }
    }

    console.log('\n🎉 RLS policy fix migration completed!');

    // Verify the policies were created
    console.log('\n🔍 Verifying new policies...');
    const verifyQuery = `
      SELECT tablename, policyname, cmd, permissive
      FROM pg_policies
      WHERE tablename IN ('job_requisitions', 'team_settings')
      ORDER BY tablename, policyname;
    `;

    const verifyResult = await client.query(verifyQuery);
    if (verifyResult.rows.length > 0) {
      console.log('✅ New policies created:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.tablename}.${row.policyname} (${row.cmd})`);
      });
    } else {
      console.log('❌ No policies found - something went wrong');
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

applyRLSFix();
