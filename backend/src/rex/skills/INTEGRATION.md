# Integrating the v2 Skill Registry into rex/server.ts

This module is **wired but not yet invoked from REX**. The MCP tool surface in
`rex/server.ts` (~3,554 LOC) still uses the legacy `rexToolFunctions` directly.

## What's already built

- `skills/registry.ts` — id → handler map for all 30 seeded Skills
- `skills/guardrails.ts` — autopilot decision logic (score threshold, spend cap, hard-hold types)
- `skills/handlers/{role}.ts` — 8 per-role handler files (currently stubs that route through guardrails)
- `agentLoader.ts` — loads agent + trust + installed skills + guardrails + system prompt
- `prompts/agents/{role}.md` — 8 specialist system prompts

## What's left

1. **Specialist routing.** When REX receives a user request, it should:
   - Decide which specialist (if any) owns this — based on the request's intent
   - Call `loadAgentContext(workspaceId, userId, role)` to get the agent's prompt + skills
   - If `paused` or null, fall back to handling it as REX itself
   - Inject `systemPrompt` into the LLM call so the specialist's voice + behavioral rules apply
   - Filter the available tool surface to only the agent's `installedSkills`

2. **Skill invocation.** Replace direct `rexToolFunctions.X(...)` calls with
   `getSkillHandler(skillId)(input, ctx)`. The registry returns a handler that:
   - Either executes (returns `data`)
   - Or holds (returns `held` + writes a `decisions` row via guardrails)

3. **Goal execution loop.** When a goal moves to `running`:
   - Read `goals.plan.steps[]` (which Skills get called in order)
   - For each step, resolve the assigned agent + skill, call the handler
   - Stream progress to the live execution console (currently mocked in `Goals.tsx`)

4. **Real handlers.** Replace the `stub('linkedin_sourcer')` etc. in
   `handlers/sourcer.ts` etc. with calls into existing services:
   - `linkedin_sourcer` → existing Sniper LinkedIn service
   - `apollo_enrich` → `enrichWithApollo` from `services/apollo/enrichLead`
   - `outreach_writer` → existing `personalizeMessage` + `sendgrid` chain
   - etc.

## Why ship the layer before the integration?

Without this layer, every Skill addition required a code change to `rex/server.ts`.
With it:
- Adding a Skill = INSERT into `skills_catalog` + drop a handler file + register it
- Trust ladder + spend cap apply uniformly across every Skill, with one place to test
- Per-agent system prompts are first-class (no more "REX, pretend you're a Sourcer")
- Decisions get written automatically when actions are held — the Decisions page shows them without any new wiring

## Testing locally

```ts
import { loadAgentContext } from './agentLoader';
import { getSkillHandler } from './skills/registry';

const ctx = await loadAgentContext('<workspace-id>', '<user-id>', 'sourcer');
if (ctx) {
  const handler = getSkillHandler('linkedin_sourcer');
  const result = await handler!({ filter: 'senior backend NYC' }, ctx);
  console.log(result);
}
```
