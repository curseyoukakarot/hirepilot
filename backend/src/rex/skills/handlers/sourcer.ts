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
 * Apollo Enrich — wraps services/apollo/enrichLead.enrichWithApollo for a
 * single lead. Apollo is a HOUSE ACCOUNT shared across all users:
 *
 *   - If the user has connected their PERSONAL Apollo API key
 *     (user_settings.apollo_api_key) → no platform credits charged.
 *   - Otherwise the platform's SUPER_ADMIN_APOLLO_API_KEY is used and
 *     1 credit is deducted per enrichment.
 *
 * This handler enforces the gate. Without it, REX/v2 would bypass the
 * credit system entirely for users on the house account.
 *
 * Input: { leadId, firstName?, lastName?, company?, linkedinUrl? }
 */
const APOLLO_ENRICH_CREDIT_COST = 1;

export const apolloEnrich: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { leadId, firstName, lastName, company, linkedinUrl } = input || {};
  if (!leadId) return { ok: false, error: 'leadId_required' };

  // 1) Detect whether the user is on the house Apollo account or their own.
  let usingHouseApollo = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../../../lib/supabase');
    const { data: settings } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if ((settings as any)?.apollo_api_key) usingHouseApollo = false;
  } catch {
    // If user_settings lookup fails, default to charging (safer for the platform)
    usingHouseApollo = true;
  }

  // 2) Pre-check credits if on the house account.
  if (usingHouseApollo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CreditService } = require('../../../../services/creditService');
      const ok = await CreditService.hasSufficientCredits(ctx.userId, APOLLO_ENRICH_CREDIT_COST);
      if (!ok) {
        return {
          ok: false,
          error: 'insufficient_credits',
          message: `Apollo house enrichment costs ${APOLLO_ENRICH_CREDIT_COST} credit. You're out of credits — top up under Settings → Billing, or connect your own Apollo API key for unlimited free enrichment.`,
        };
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'credit_check_failed' };
    }
  }

  // 3) Run enrichment.
  let enriched: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { enrichWithApollo } = require('../../../services/apollo/enrichLead');
    enriched = await enrichWithApollo({
      leadId,
      userId: ctx.userId,
      firstName,
      lastName,
      company,
      linkedinUrl,
    });
  } catch (e: any) {
    return { ok: false, error: e?.message || 'apollo_enrich_failed' };
  }

  // 4) Deduct credits ONLY if the platform's super-admin key actually backed
  //    this call. enrichWithApollo returns api_key_info telling us which key
  //    was used; trust it over our pre-detection in case enrichment fell
  //    through to the house key after the user's personal key failed.
  const usedHouseKey = enriched?.api_key_info?.using_personal_key === false;
  let creditsCharged = 0;
  if (usedHouseKey && enriched?.success) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CreditService } = require('../../../../services/creditService');
      await CreditService.deductCredits(
        ctx.userId,
        APOLLO_ENRICH_CREDIT_COST,
        'api_usage',
        `REX apollo_enrich (house account): lead ${leadId}`,
      );
      creditsCharged = APOLLO_ENRICH_CREDIT_COST;
    } catch (creditErr: any) {
      // Non-fatal: log but don't fail the enrichment the user already got.
      console.warn('[apollo_enrich] credit deduction failed:', creditErr?.message || creditErr);
    }
  }

  return {
    ok: true,
    data: {
      ...enriched,
      _credit_meta: {
        using_house_apollo: usedHouseKey,
        credits_charged: creditsCharged,
      },
    },
  };
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

/**
 * ICP Researcher — builds an ideal-customer-profile fingerprint from a set
 * of "top responders" (leads who replied positively). Uses OpenAI to extract
 * the common patterns (titles, seniority bands, tech stacks, company sizes).
 *
 * Input: { topResponders: Array<{ first_name, last_name, title, company, ... }>, focus?: string }
 */
export const icpResearcher: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { topResponders = [], focus } = input || {};
  if (!Array.isArray(topResponders) || topResponders.length === 0) {
    return { ok: false, error: 'top_responders_required', message: 'Pass at least 3 responders to fingerprint.' };
  }
  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You are a recruiter's ICP analyst. Look at a set of leads who replied positively and extract the pattern. Output JSON: titles (array), seniority_bands (array), tech_signals (array), company_size_band (string), industries (array), tone_notes (string), search_query_template (string — paste-ready Apollo title query). Confidence (0-1). Keep arrays under 6 items.`,
      user: `Focus: ${focus || 'general'}\n\nResponders:\n${topResponders.slice(0, 25).map((r: any, i: number) =>
        `${i + 1}. ${r.first_name || ''} ${r.last_name || ''} — ${r.title || ''} @ ${r.company || ''}`,
      ).join('\n')}`,
      max_tokens: 600,
    });
    return { ok: true, data: { ...data, sample_size: topResponders.length } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'icp_researcher_failed' };
  }
};

export const browserResearcher  = stub('browser_researcher');
export const githubSourcer      = stub('github_sourcer');
export const twitterSourcer     = stub('twitter_sourcer');
