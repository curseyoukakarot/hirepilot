/**
 * Test harness for pipeline tools.
 * Run with: ts-node rex/tools/testPipelineTools.ts
 */

import ViewPipeline from "./viewPipeline.js";
import MoveCandidateStage from "./moveCandidateStage.js";

async function runTests() {
  console.log("🧪 Starting REX Pipeline Tools Test Suite");
  console.log("=" .repeat(50));

  try {
    console.log("\n=== Test 1: ViewPipeline (All candidates) ===");
    const viewAllRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
    });
    console.log("Result:", JSON.stringify(viewAllRes, null, 2));

    console.log("\n=== Test 2: ViewPipeline (Applied stage only) ===");
    const viewAppliedRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
      stage: "Applied",
    });
    console.log("Result:", JSON.stringify(viewAppliedRes, null, 2));

    console.log("\n=== Test 3: ViewPipeline (Stale candidates - 5+ days) ===");
    const viewStaleRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
      staleDays: 5,
    });
    console.log("Result:", JSON.stringify(viewStaleRes, null, 2));

    console.log("\n=== Test 4: ViewPipeline (Search by name) ===");
    const viewNameRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
      candidateName: "Test", // Search for any name containing "Test"
    });
    console.log("Result:", JSON.stringify(viewNameRes, null, 2));

    console.log("\n=== Test 5: MoveCandidateStage (Permission denied - guest role) ===");
    const moveGuestRes = await MoveCandidateStage.run({
      candidateId: "960b6019-84bb-403d-b54a-69ae8dd568ff", // Use existing candidate_id
      newStage: "Interview",
      requestedByRole: "guest",
      confirm: true,
    });
    console.log("Result:", JSON.stringify(moveGuestRes, null, 2));

    console.log("\n=== Test 6: MoveCandidateStage (Requires confirmation) ===");
    const moveNoConfirmRes = await MoveCandidateStage.run({
      candidateId: "960b6019-84bb-403d-b54a-69ae8dd568ff", // Use existing candidate_id
      newStage: "Interview",
      requestedByRole: "team_admin",
      confirm: false,
    });
    console.log("Result:", JSON.stringify(moveNoConfirmRes, null, 2));

    console.log("\n=== Test 7: MoveCandidateStage (Successful move) ===");
    const moveConfirmRes = await MoveCandidateStage.run({
      candidateId: "960b6019-84bb-403d-b54a-69ae8dd568ff", // Use existing candidate_id
      newStage: "Interview",
      requestedByRole: "team_admin",
      confirm: true,
    });
    console.log("Result:", JSON.stringify(moveConfirmRes, null, 2));

    console.log("\n=== Test 8: Verify move with ViewPipeline ===");
    const verifyMoveRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
      stage: "Interview",
    });
    console.log("Result:", JSON.stringify(verifyMoveRes, null, 2));

    console.log("\n=== Test 9: MoveCandidateStage (Invalid candidate) ===");
    const moveInvalidRes = await MoveCandidateStage.run({
      candidateId: "invalid123",
      newStage: "Interview",
      requestedByRole: "team_admin",
      confirm: true,
    });
    console.log("Result:", JSON.stringify(moveInvalidRes, null, 2));

    console.log("\n=== Test 10: ViewPipeline (Empty result) ===");
    const viewEmptyRes = await ViewPipeline.run({
      jobId: "21d6249a-8b34-4f5d-938a-734b97e6255e", // Use existing job_id
      stage: "NonExistentStage",
    });
    console.log("Result:", JSON.stringify(viewEmptyRes, null, 2));

  } catch (error) {
    console.error("❌ Test execution failed:", error);
    return;
  }

  console.log("\n" + "=" .repeat(50));
  console.log("✅ All tests executed successfully!");
  console.log("📊 Test Summary:");
  console.log("  - ViewPipeline: 6 tests");
  console.log("  - MoveCandidateStage: 4 tests");
  console.log("  - Total: 10 tests");
}

// Run the test suite
runTests()
  .then(() => {
    console.log("\n🎉 Test suite completed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  });
