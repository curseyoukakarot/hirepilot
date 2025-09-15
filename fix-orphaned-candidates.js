#!/usr/bin/env node

/**
 * Fix Orphaned Candidates Script
 * This script helps identify and fix orphaned candidate records before adding foreign key constraints
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

async function fixOrphanedCandidates() {
  console.log('🔍 Fixing Orphaned Candidates...\n');
  console.log('=' .repeat(50));

  try {
    // 1. Find orphaned candidates
    console.log('1️⃣ Finding orphaned candidates...');
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, lead_id, first_name, last_name, email, created_at')
      .not('lead_id', 'is', null);

    if (candidatesError) {
      console.error('❌ Error fetching candidates:', candidatesError);
      return;
    }

    const orphanedCandidates = [];
    
    for (const candidate of candidates || []) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('id', candidate.lead_id)
        .single();
      
      if (!lead) {
        orphanedCandidates.push(candidate);
      }
    }

    console.log(`Found ${orphanedCandidates.length} orphaned candidates`);

    if (orphanedCandidates.length === 0) {
      console.log('✅ No orphaned candidates found! You can run the migration safely.');
      return;
    }

    // 2. Display orphaned candidates
    console.log('\n2️⃣ Orphaned candidates:');
    orphanedCandidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.first_name} ${candidate.last_name} (${candidate.email})`);
      console.log(`   ID: ${candidate.id}`);
      console.log(`   Invalid lead_id: ${candidate.lead_id}`);
      console.log(`   Created: ${candidate.created_at}`);
      console.log('');
    });

    // 3. Ask for confirmation
    console.log('3️⃣ Options:');
    console.log('A. Set lead_id to NULL for all orphaned candidates (recommended)');
    console.log('B. Delete orphaned candidates (DANGEROUS - will lose data)');
    console.log('C. Manual review required (exit script)');
    console.log('');

    // For automated execution, we'll go with option A
    console.log('🤖 Auto-selecting option A: Set lead_id to NULL...');

    // 4. Fix orphaned candidates
    console.log('\n4️⃣ Fixing orphaned candidates...');
    
    const candidateIds = orphanedCandidates.map(c => c.id);
    
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ lead_id: null })
      .in('id', candidateIds);

    if (updateError) {
      console.error('❌ Error updating candidates:', updateError);
      return;
    }

    console.log(`✅ Successfully updated ${candidateIds.length} candidates (set lead_id to NULL)`);

    // 5. Verify the fix
    console.log('\n5️⃣ Verifying fix...');
    const { data: remainingOrphans, error: verifyError } = await supabase
      .from('candidates')
      .select('id, lead_id')
      .not('lead_id', 'is', null);

    if (verifyError) {
      console.error('❌ Error verifying fix:', verifyError);
      return;
    }

    // Check if any remaining orphans exist
    const stillOrphaned = [];
    for (const candidate of remainingOrphans || []) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('id', candidate.lead_id)
        .single();
      
      if (!lead) {
        stillOrphaned.push(candidate);
      }
    }

    if (stillOrphaned.length === 0) {
      console.log('✅ All orphaned candidates fixed! You can now run the migration safely.');
    } else {
      console.log(`⚠️  ${stillOrphaned.length} orphaned candidates still remain. Manual cleanup may be needed.`);
    }

    // 6. Show summary
    console.log('\n📊 Summary:');
    console.log(`• Total candidates processed: ${candidates?.length || 0}`);
    console.log(`• Orphaned candidates found: ${orphanedCandidates.length}`);
    console.log(`• Candidates fixed: ${candidateIds.length}`);
    console.log(`• Remaining orphans: ${stillOrphaned.length}`);

    console.log('\n🎯 Next steps:');
    console.log('1. Run the migration: 20241220_fix_candidate_lead_integrity_v2.sql');
    console.log('2. Test your application to ensure everything works');
    console.log('3. Monitor for any issues');

  } catch (error) {
    console.error('❌ Error during orphaned candidates fix:', error);
  }
}

// Run the fix
fixOrphanedCandidates().catch(console.error);
