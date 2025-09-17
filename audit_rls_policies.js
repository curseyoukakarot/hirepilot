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

async function auditCurrentPolicies() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Step 1: Audit current policies
    console.log('\n🔍 AUDITING CURRENT RLS POLICIES');
    console.log('=====================================');
    
    const auditQuery = `
      SELECT
        schemaname, tablename, policyname, cmd,
        permissive, roles, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('job_requisitions', 'team_settings')
      ORDER BY tablename, policyname;
    `;

    const result = await client.query(auditQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ No policies found on job_requisitions or team_settings tables');
    } else {
      console.log(`✅ Found ${result.rows.length} policies:`);
      result.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. Table: ${row.tablename}`);
        console.log(`   Policy: ${row.policyname}`);
        console.log(`   Command: ${row.cmd}`);
        console.log(`   Permissive: ${row.permissive}`);
        console.log(`   Roles: ${row.roles || 'N/A'}`);
        console.log(`   Qual: ${row.qual || 'N/A'}`);
        console.log(`   With Check: ${row.with_check || 'N/A'}`);
      });
    }

    // Check if RLS is enabled
    console.log('\n🔒 CHECKING RLS STATUS');
    console.log('======================');
    
    const rlsQuery = `
      SELECT schemaname, tablename, rowsecurity, forcerowsecurity
      FROM pg_tables 
      WHERE tablename IN ('job_requisitions', 'team_settings')
      ORDER BY tablename;
    `;

    const rlsResult = await client.query(rlsQuery);
    rlsResult.rows.forEach(row => {
      console.log(`${row.tablename}: RLS=${row.rowsecurity}, Force RLS=${row.forcerowsecurity}`);
    });

  } catch (error) {
    console.error('Error auditing policies:', error);
  } finally {
    await client.end();
  }
}

// Run the audit
auditCurrentPolicies();
