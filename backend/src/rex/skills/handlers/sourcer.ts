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

/**
 * LinkedIn Sourcer — wraps the existing rexToolFunctions.sourceLeads with
 * source='linkedin'. Holds the action under suggest mode (so the user
 * approves the batch) and executes under autopilot if score + spend OK.
 *
 * Input: { campaignId?, filters: { title, location, keywords?, count? } }
 */
export const linkedinSourcer: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { campaignId = 'latest', filters = {} } = input || {};
  // Sourcing 100 leads ≈ ~$10 of enrichment; assume ~$0.10 per lead.
  const estCount = Math.min(Number(filters.count || 25), 200);
  const spendCents = estCount * 10;

  const guard = await guardActions(ctx, {
    decisionType: 'scale_recommendation',
    score: 100, // sourcing itself is high-confidence
    spendCents,
    payload: { skill: 'linkedin_sourcer', campaignId, filters, estimatedCount: estCount, estimatedSpendCents: spendCents },
    context: { agentRole: ctx.agentRole, workspaceId: ctx.workspaceId, surface: 'sourcing' },
    reason: `Run LinkedIn sourcing for ~${estCount} leads (~$${(spendCents / 100).toFixed(2)} in enrichment).`,
  });

  if (guard.decision === 'hold') {
    return {
      ok: true,
      held: {
        decisionType: 'scale_recommendation',
        reason: guard.reason,
        payload: { skill: 'linkedin_sourcer', campaignId, filters, estimatedCount: estCount, estimatedSpendCents: spendCents },
      },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { sourceLeads } = require('../../../../tools/rexToolFunctions');
    const result = await sourceLeads({
      userId: ctx.userId,
      campaignId,
      source: 'linkedin',
      filters,
    });
    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'linkedin_sourcer_failed' };
  }
};

/**
 * Apollo Enrich — wraps existing services/apollo/enrichLead.enrichWithApollo
 * for a single lead. Read-only enrichment is autopilot-safe (no guardrail).
 *
 * Input: { leadId, firstName?, lastName?, company?, linkedinUrl? }
 */
export const apolloEnrich: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { leadId, firstName, lastName, company, linkedinUrl } = input || {};
  if (!leadId) return { ok: false, error: 'leadId_required' };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enrichWithApollo } = require('../../../services/apollo/enrichLead');
    const enriched = await enrichWithApollo({
      leadId,
      userId: ctx.userId,
      firstName,
      lastName,
      company,
      linkedinUrl,
    });
    return { ok: true, data: enriched };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'apollo_enrich_failed' };
  }
};

/**
 * Hunter — finds an email by full name + company domain.
 * Read-only, autopilot-safe. Returns null if no email scores high enough.
 *
 * Input: { fullName, domain }
 */
export const hunterSkill: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { fullName, domain } = input || {};
  if (!fullName || !domain) return { ok: false, error: 'fullName_and_domain_required' };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getUserIntegrations } = require('../../../../utils/userIntegrationsHelper');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enrichWithHunter } = require('../../../../services/hunter');
    const integrations = await getUserIntegrations(ctx.userId);
    if (!integrations?.hunter_api_key) {
      return { ok: false, error: 'hunter_not_configured', message: 'Connect your Hunter.io API key under Settings → Integrations.' };
    }
    const email = await enrichWithHunter(integrations.hunter_api_key, fullName, domain);
    return { ok: true, data: { email } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'hunter_failed' };
  }
};

/**
 * Skrapp — email finder + validator.
 * Read-only, autopilot-safe.
 *
 * Input: { fullName, domain, companyName? }
 */
export const skrappSkill: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { fullName, domain, companyName } = input || {};
  if (!fullName || !domain) return { ok: false, error: 'fullName_and_domain_required' };

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getUserIntegrations } = require('../../../../utils/userIntegrationsHelper');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enrichWithSkrapp } = require('../../../../services/skrapp');
    const integrations = await getUserIntegrations(ctx.userId);
    if (!integrations?.skrapp_api_key) {
      return { ok: false, error: 'skrapp_not_configured', message: 'Connect your Skrapp.io API key under Settings → Integrations.' };
    }
    const email = await enrichWithSkrapp(integrations.skrapp_api_key, fullName, domain, companyName);
    return { ok: true, data: { email } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'skrapp_failed' };
  }
};

export const icpResearcher      = stub('icp_researcher');
export const browserResearcher  = stub('browser_researcher');
export const githubSourcer      = stub('github_sourcer');
export const twitterSourcer     = stub('twitter_sourcer');
