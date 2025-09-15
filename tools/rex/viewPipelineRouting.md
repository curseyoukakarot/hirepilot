# REX MCP Routing Prompt for Pipeline Tools

## Tool Descriptions
- **`viewPipeline`**: Allows REX to access pipeline data for a given Job REQ, including candidates in each stage, their status, and timestamps. It supports filtering by stage, staleness (time in stage), or candidate name.
- **`moveCandidateStage`**: Allows REX to update the pipeline stage of a candidate with role-based access control and confirmation flow.

## MCP Routing Logic

```javascript
/**
 * Routing logic:
 * - viewPipeline → use when asking about candidate lists, stages, summaries.
 * - moveCandidateStage → use when asked to "move", "advance", or "update" candidate stages.
 */

// For viewing pipeline data
if (
  message.includes("pipeline") ||
  message.includes("stage") ||
  message.includes("who's in") ||
  message.includes("candidates in") ||
  message.includes("stuck in") ||
  message.includes("show me") && (message.includes("candidates") || message.includes("pipeline")) ||
  message.includes("list") && (message.includes("candidates") || message.includes("stage")) ||
  message.includes("summarize") && message.includes("candidates") ||
  message.includes("who") && (message.includes("been in") || message.includes("stuck")) ||
  message.includes("candidate") && (message.includes("notes") || message.includes("status"))
) {
  return "Use viewPipeline to retrieve the current stage data for the given job ID.";
}

// For moving candidates between stages
if (
  message.match(/move .* to .* stage/i) ||
  message.includes("advance candidate") ||
  message.includes("update stage") ||
  message.includes("move candidate") ||
  message.includes("advance") && message.includes("stage") ||
  message.includes("update") && message.includes("candidate") && message.includes("stage")
) {
  return "Use moveCandidateStage to update the pipeline stage of the given candidate.";
}
```

## Example Prompts REX Can Now Respond To

### View Pipeline Data
- "REX, show me all candidates in the Interview stage for the Revenue Ops role."
- "REX, who's been in Phone Screen for more than 7 days?"
- "REX, list all candidates in the Offer stage."
- "REX, summarize candidate notes for the Sales Executive job."
- "REX, show me candidates named John in the pipeline."
- "REX, who's stuck in the Application stage for over 10 days?"
- "REX, what candidates are in the Technical Interview stage?"
- "REX, show me all candidates with notes in the pipeline."
- "REX, who hasn't moved stages in 5 days?"

### Move Candidates Between Stages
- "REX, move John Smith to the Interview stage."
- "REX, advance candidate 45f8-92ab into Offer."
- "REX, update this candidate's stage to Rejected."
- "REX, confirm moving Jane Doe to Phone Screen."
- "REX, move candidate to Technical Interview stage."
- "REX, advance this candidate to Final Interview."

## Tool Parameters

### viewPipeline
- `jobId` (required): The UUID of the job requisition
- `stage` (optional): Filter by specific pipeline stage
- `staleDays` (optional): Filter candidates who have been in their current stage longer than X days
- `candidateName` (optional): Search for candidates by name (case-insensitive)

### moveCandidateStage
- `candidateId` (required): The UUID of the candidate to move
- `newStage` (required): The target pipeline stage
- `requestedByRole` (required): User's role for access control
- `confirm` (optional): Confirmation flag (defaults to false)

## Access Control
- **viewPipeline**: Available to all collaborators (team members + guests) with visibility to the job's pipeline
- **moveCandidateStage**: Only available to team_admin, pro, or RecruitPro roles with confirmation flow
