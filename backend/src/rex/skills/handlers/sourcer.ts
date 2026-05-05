/**
 * Sourcer skill handlers.
 *
 * These wrap existing HirePilot services (Sniper, Apollo, Hunter, Skrapp,
 * Browserbase) and feed their results back to REX. Sourcer Skills are
 * generally autopilot-safe (they don't send messages or spend money beyond
 * enrichment credits), so most pass through `guardActions` only when they
 * propose a multi-thousand-dollar enrichment batch.
 */

import type { SkillHandler, SkillResult } from '../registry';
import { guardActions } from '../guardrails';

const stub = (name: string): SkillHandler => async (input, ctx): Promise<SkillResult> => {
  // Until the real wiring drops in, propose the action and let guardrails decide.
  const guard = await guardActions(ctx, {
    decisionType: 'custom',
    payload: { skill: name, input },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId },
    reason: `${name} not yet wired — surfaced for human review.`,
  });
  if (guard.decision === 'hold') {
    return { ok: true, held: { decisionType: 'custom', reason: guard.reason, payload: { skill: name, input } } };
  }
  return { ok: true, data: { stub: true, skill: name, input } };
};

// TODO: replace stubs with real service calls. The names below match the
// existing rexToolFunctions exports and Sniper/Apollo/Hunter clients.
export const linkedinSourcer    = stub('linkedin_sourcer');
export const apolloEnrich       = stub('apollo_enrich');
export const icpResearcher      = stub('icp_researcher');
export const browserResearcher  = stub('browser_researcher');
export const hunterSkill        = stub('hunter_skill');
export const skrappSkill        = stub('skrapp_skill');
export const githubSourcer      = stub('github_sourcer');
export const twitterSourcer     = stub('twitter_sourcer');
