#!/usr/bin/env node

/**
 * Data Integrity Check Script
 * Run this to identify data integrity issues that might be causing 404 errors
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataIntegrity() {
  console.log('🔍 Checking Data Integrity...\n');
  console.log('=' .repeat(50));

  try {
    // 1. Check for orphaned candidates (no matching lead)
    console.log('1️⃣ Checking for orphaned candidates...');
    const { data: orphanedCandidates, error: orphanError } = await supabase
      .from('candidates')
      .select('id, lead_id, first_name, last_name, email')
      .not('lead_id', 'is', null);

    if (orphanError) {
      console.error('❌ Error fetching candidates:', orphanError);
    } else {
      const orphaned = [];
      for (const candidate of orphanedCandidates || []) {
        const { data: lead } = await supabase
          .from('leads')
          .select('id')
          .eq('id', candidate.lead_id)
          .single();
        
        if (!lead) {
          orphaned.push(candidate);
        }
      }

      if (orphaned.length > 0) {
        console.log(`❌ Found ${orphaned.length} orphaned candidates:`);
        orphaned.forEach(c => {
          console.log(`   - ${c.first_name} ${c.last_name} (${c.email}) - lead_id: ${c.lead_id}`);
        });
      } else {
        console.log('✅ No orphaned candidates found');
      }
    }

    // 2. Check for leads that claim a candidate that doesn't exist
    console.log('\n2️⃣ Checking for leads with invalid candidate references...');
    const { data: leadsWithCandidates, error: leadsError } = await supabase
      .from('leads')
      .select('id, candidate_id, first_name, last_name, email')
      .not('candidate_id', 'is', null);

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError);
    } else {
      const invalidLeads = [];
      for (const lead of leadsWithCandidates || []) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('id', lead.candidate_id)
          .single();
        
        if (!candidate) {
          invalidLeads.push(lead);
        }
      }

      if (invalidLeads.length > 0) {
        console.log(`❌ Found ${invalidLeads.length} leads with invalid candidate references:`);
        invalidLeads.forEach(l => {
          console.log(`   - ${l.first_name} ${l.last_name} (${l.email}) - candidate_id: ${l.candidate_id}`);
        });
      } else {
        console.log('✅ No invalid lead-candidate references found');
      }
    }

    // 3. Check for duplicate candidates
    console.log('\n3️⃣ Checking for duplicate candidates...');
    const { data: duplicates, error: dupError } = await supabase
      .rpc('check_duplicate_candidates');

    if (dupError) {
      console.log('ℹ️  Duplicate check function not available, skipping...');
    } else if (duplicates && duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate candidates`);
    } else {
      console.log('✅ No duplicate candidates found');
    }

    // 4. Check for missing indexes
    console.log('\n4️⃣ Checking for missing indexes...');
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname, tablename')
      .in('tablename', ['candidates', 'leads', 'lead_activities', 'candidate_activities']);

    if (indexError) {
      console.log('ℹ️  Could not check indexes (permission issue)');
    } else {
      const requiredIndexes = [
        'idx_candidates_lead_id',
        'idx_lead_activities_lead_id',
        'idx_candidate_activities_candidate_id'
      ];
      
      const existingIndexes = indexes?.map(i => i.indexname) || [];
      const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));
      
      if (missingIndexes.length > 0) {
        console.log(`❌ Missing indexes: ${missingIndexes.join(', ')}`);
      } else {
        console.log('✅ All required indexes are present');
      }
    }

    // 5. Check for recent activity errors
    console.log('\n5️⃣ Checking recent activity patterns...');
    const { data: recentActivities, error: activityError } = await supabase
      .from('lead_activities')
      .select('id, lead_id, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(10);

    if (activityError) {
      console.log('ℹ️  Could not check recent activities');
    } else {
      console.log(`✅ Found ${recentActivities?.length || 0} activities in the last 24 hours`);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('🎯 Data integrity check complete!');
    console.log('\n💡 Recommendations:');
    console.log('1. Run the migration script to add missing indexes');
    console.log('2. Fix any orphaned records found above');
    console.log('3. Consider adding RLS policies if not already present');
    console.log('4. Monitor the application logs for 404 errors');

  } catch (error) {
    console.error('❌ Error during integrity check:', error);
  }
}

// Run the check
checkDataIntegrity().catch(console.error);
