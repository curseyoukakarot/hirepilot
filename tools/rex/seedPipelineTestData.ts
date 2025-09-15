/**
 * Seed script for test pipeline data.
 * Run once to populate Supabase with dummy jobs and candidates.
 * 
 * Usage: ts-node rex/tools/seedPipelineTestData.ts
 */

import { supabaseDb } from "../../backend/lib/supabase";

async function seed() {
  console.log("🌱 Seeding REX Pipeline Test Data...");
  console.log("=" .repeat(50));

  try {
    // Clean up existing test data first
    console.log("🧹 Cleaning up existing test data...");
    await supabaseDb.from("candidates").delete().eq("job_id", "job123");
    await supabaseDb.from("job_requisitions").delete().eq("id", "job123");

    // Create test job
    console.log("📋 Creating test job...");
    const { data: job, error: jobErr } = await supabaseDb
      .from("job_requisitions")
      .insert([{ 
        id: "job123", 
        title: "Revenue Ops Role", 
        description: "Senior Revenue Operations Manager",
        department: "Sales",
        location: "San Francisco, CA",
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (jobErr) {
      console.error("❌ Job insert error:", jobErr);
      return;
    }
    console.log("✅ Job created:", job.title);

    // Create test candidates with various stages and timestamps
    console.log("👥 Creating test candidates...");
    const candidates = [
      {
        id: "cand123",
        job_id: "job123",
        first_name: "Alice",
        last_name: "Johnson",
        email: "alice@example.com",
        phone: "+1-555-0101",
        status: "sourced",
        notes: "Strong background in SaaS sales. 5+ years experience.",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      },
      {
        id: "cand124",
        job_id: "job123",
        first_name: "Bob",
        last_name: "Smith",
        email: "bob@example.com",
        phone: "+1-555-0102",
        status: "sourced",
        notes: "Great technical depth. Former Salesforce admin.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), // Recent
      },
      {
        id: "cand125",
        job_id: "job123",
        first_name: "Carol",
        last_name: "Davis",
        email: "carol@example.com",
        phone: "+1-555-0103",
        status: "sourced",
        notes: "Excellent communication skills. Startup experience.",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      },
      {
        id: "cand126",
        job_id: "job123",
        first_name: "David",
        last_name: "Wilson",
        email: "david@example.com",
        phone: "+1-555-0104",
        status: "sourced",
        notes: "Strong analytical skills. MBA from Stanford.",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      }
    ];

    const { error: candErr } = await supabaseDb.from("candidates").insert(candidates);

    if (candErr) {
      console.error("❌ Candidate insert error:", candErr);
      return;
    }
    console.log(`✅ ${candidates.length} candidates created`);

    // Create candidate_jobs associations with different stages
    console.log("🔗 Creating candidate-job stage associations...");
    const candidateJobs = [
      {
        id: "cj123",
        candidate_id: "cand123",
        job_id: "job123",
        status: "sourced",
        stage: "Phone Screen",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      },
      {
        id: "cj124",
        candidate_id: "cand124",
        job_id: "job123",
        status: "sourced",
        stage: "Interview",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), // Recent
      },
      {
        id: "cj125",
        candidate_id: "cand125",
        job_id: "job123",
        status: "sourced",
        stage: "Technical Interview",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      },
      {
        id: "cj126",
        candidate_id: "cand126",
        job_id: "job123",
        status: "sourced",
        stage: "Offer",
        created_at: new Date().toISOString(),
        updated_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      }
    ];

    const { error: cjErr } = await supabaseDb.from("candidate_jobs").insert(candidateJobs);

    if (cjErr) {
      console.error("❌ Candidate jobs insert error:", cjErr);
      return;
    }
    console.log(`✅ ${candidateJobs.length} candidate-job associations created`);

    console.log("\n" + "=" .repeat(50));
    console.log("🎉 Seed data inserted successfully!");
    console.log("\n📊 Test Data Summary:");
    console.log("  - Job: Revenue Ops Role (job123)");
    console.log("  - Candidates: 4 total");
    console.log("  - Stages: Phone Screen, Interview, Technical Interview, Offer");
    console.log("  - Staleness: 1 recent, 1 old (15 days), 2 medium (3-10 days)");
    console.log("\n🚀 Ready for testing! Run: ts-node rex/tools/testPipelineTools.ts");

  } catch (error) {
    console.error("❌ Seed script failed:", error);
  }
}

// Run the seed script
seed()
  .then(() => {
    console.log("\n✅ Seed script completed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed script failed:", err);
    process.exit(1);
  });
