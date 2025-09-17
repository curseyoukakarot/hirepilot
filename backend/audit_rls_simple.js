#!/usr/bin/env node

const { Client } = require('pg');

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

async function auditPolicies() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Step 1: Check current policies
    console.log('\n🔍 Current RLS Policies:');
    console.log('========================');
    
    const policiesQuery = `
      SELECT tablename, policyname, cmd, permissive, roles, qual
      FROM pg_policies
      WHERE tablename IN ('job_requisitions', 'team_settings')
      ORDER BY tablename, policyname;
    `;

    const policiesResult = await client.query(policiesQuery);
    
    if (policiesResult.rows.length === 0) {
      console.log('❌ No policies found on job_requisitions or team_settings');
    } else {
      policiesResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.tablename}.${row.policyname} (${row.cmd})`);
        console.log(`   Roles: ${row.roles || 'N/A'}`);
        console.log(`   Qual: ${row.qual || 'N/A'}`);
        console.log('');
      });
    }

    // Step 2: Check RLS status
    console.log('🔒 RLS Status:');
    console.log('==============');
    
    const rlsQuery = `
      SELECT tablename, rowsecurity, forcerowsecurity
      FROM pg_tables 
      WHERE tablename IN ('job_requisitions', 'team_settings')
      ORDER BY tablename;
    `;

    const rlsResult = await client.query(rlsQuery);
    rlsResult.rows.forEach(row => {
      console.log(`${row.tablename}: RLS=${row.rowsecurity}, Force=${row.forcerowsecurity}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

auditPolicies();
