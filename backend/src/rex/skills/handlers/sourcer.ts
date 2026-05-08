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

// (Stub helper removed — every Sourcer Skill is now wired below.)

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

/**
 * Browser Researcher — when Browserbase is enabled, spins up a live
 * session, navigates to the target's domain, scrapes the homepage +
 * about page text, then asks OpenAI to synthesize a recruiter brief
 * from the actual fetched content. Falls back to LLM prior-knowledge
 * if Browserbase isn't configured.
 *
 * Input: { target: { name?, company?, role?, urls?: string[] }, focus?: string }
 */
export const browserResearcher: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { target, focus } = input || {};
  if (!target || (!target.name && !target.company)) {
    return { ok: false, error: 'target_required' };
  }

  // Resolve a URL to research.
  let urls: string[] = Array.isArray(target.urls) ? target.urls.filter(Boolean) : [];
  if (!urls.length && target.company) {
    const slug = String(target.company).toLowerCase().replace(/[^a-z0-9]+/g, '');
    urls = [`https://${slug}.com`, `https://${slug}.com/about`];
  }

  // Try the live Browserbase path.
  let scrapedText: string | null = null;
  let scrapedFrom: string[] = [];
  let liveViewUrl: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bb = require('../../../services/sniperV1/agent/browserbaseClient');
    if (bb.browserbaseEnabled()) {
      const sessionId = await bb.createSession({});
      try {
        liveViewUrl = await bb.getLiveViewUrl(sessionId);
        const { browser, context, page } = await bb.connectPlaywright(sessionId);
        try {
          const collected: string[] = [];
          for (const url of urls.slice(0, 3)) {
            try {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 });
              const text = await page.evaluate(() => document.body?.innerText || '');
              if (text) {
                collected.push(`--- ${url} ---\n${String(text).slice(0, 3000)}`);
                scrapedFrom.push(url);
              }
            } catch (navErr: any) {
              console.warn('[browser_researcher] navigate failed:', url, navErr?.message);
            }
          }
          scrapedText = collected.join('\n\n');
        } finally {
          try { await context.close(); } catch {}
          try { await browser.close(); } catch {}
        }
      } finally {
        try { await bb.terminateSession(sessionId); } catch {}
      }
    }
  } catch (e: any) {
    console.warn('[browser_researcher] live path failed:', e?.message);
  }

  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You produce a recruiter-grade research brief. Output JSON: summary (1-2 sentences), recent_activity (array of {when, what, source}), pitch_angles (array of 3 short bullets), risks (array, max 3), confidence (0-1). When source content is provided in the user message, ground every claim in it. Mark anything you inferred with "(inferred)".`,
      user: scrapedText
        ? `Target: ${JSON.stringify(target)}\nFocus: ${focus || 'recruiting outreach'}\n\nScraped from ${scrapedFrom.join(', ')}:\n${scrapedText}`
        : `Target: ${JSON.stringify(target)}\nFocus: ${focus || 'recruiting outreach'}\n\nNo live scrape available — use prior knowledge.`,
      max_tokens: 800,
    });
    return {
      ok: true,
      data: {
        ...data,
        source: scrapedText ? 'browserbase_live' : 'llm_prior_knowledge',
        scraped_from: scrapedFrom,
        live_view_url: liveViewUrl,
        _disclaimer: scrapedText
          ? 'Brief grounded in scraped content as of session time.'
          : 'Browserbase not configured — verify on the target\'s public profile before quoting.',
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'browser_researcher_failed' };
  }
};

/**
 * GitHub Sourcer — when GITHUB_TOKEN is configured (env or user_settings),
 * runs real /search/users queries against the GitHub API and returns
 * actual matching profiles. Falls back to LLM-suggested search queries
 * otherwise.
 *
 * Input: { criteria: { language?, stack?, location?, seniority?, query? }, count?: number }
 */
export const githubSourcer: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { criteria, count = 10 } = input || {};
  if (!criteria) return { ok: false, error: 'criteria_required' };

  // Try a real GitHub API search if a token is available.
  let token: string | undefined = process.env.GITHUB_TOKEN;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../../../lib/supabase');
    const { data } = await supabase
      .from('user_settings')
      .select('github_token')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if ((data as any)?.github_token) token = (data as any).github_token;
  } catch {}

  if (token) {
    try {
      // Build a GitHub user-search query from criteria.
      const parts: string[] = [];
      if (criteria.query) parts.push(String(criteria.query));
      else {
        if (criteria.language) parts.push(`language:${criteria.language}`);
        if (criteria.location) parts.push(`location:"${String(criteria.location).replace(/"/g, '')}"`);
        if (criteria.stack) parts.push(String(criteria.stack));
      }
      const q = parts.join(' ').trim() || 'language:typescript';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fetch = (await import('node-fetch')).default as any;
      const url = `https://api.github.com/search/users?q=${encodeURIComponent(q)}&per_page=${Math.min(count, 30)}`;
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!resp.ok) throw new Error(`github_search_${resp.status}`);
      const json: any = await resp.json();
      const items = json.items || [];

      // Hydrate top profiles for richer bio data.
      const hydrated = await Promise.all(items.slice(0, Math.min(count, 10)).map(async (u: any) => {
        try {
          const ru = await fetch(u.url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
          if (!ru.ok) return u;
          const detail: any = await ru.json();
          return { ...u, bio: detail.bio, name: detail.name, location: detail.location, company: detail.company, blog: detail.blog, public_repos: detail.public_repos, followers: detail.followers, hireable: detail.hireable };
        } catch { return u; }
      }));

      return {
        ok: true,
        data: {
          source: 'github_api',
          query: q,
          total_count: json.total_count,
          profiles: hydrated.map((p: any) => ({
            login: p.login,
            html_url: p.html_url,
            avatar_url: p.avatar_url,
            name: p.name || null,
            bio: p.bio || null,
            location: p.location || null,
            company: p.company || null,
            blog: p.blog || null,
            public_repos: p.public_repos || null,
            followers: p.followers || null,
            hireable: p.hireable || null,
          })),
        },
      };
    } catch (e: any) {
      console.warn('[github_sourcer] api path failed, falling back:', e?.message);
    }
  }

  // Fallback: LLM-suggested queries.
  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You suggest GitHub-based search queries. Output JSON: search_queries (array of {query, where}), profile_signals (array of {what_to_look_for, why_it_matters}), bottom_line (string). Conservative: don't fabricate specific usernames.`,
      user: `Criteria: ${JSON.stringify(criteria)}\nWant: ${count} profile suggestions.`,
      max_tokens: 600,
    });
    return {
      ok: true,
      data: {
        ...data,
        source: 'llm_prior_knowledge',
        _disclaimer: 'GitHub token not configured — connect GITHUB_TOKEN under Settings → Integrations for live profile lookup.',
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'github_sourcer_failed' };
  }
};

/**
 * X / Twitter Sourcer — when X_BEARER_TOKEN is configured (env or
 * user_settings.x_bearer_token), runs a real recent-tweets search and
 * returns the authors as candidate suggestions. Falls back to LLM
 * search-angle suggestions otherwise.
 *
 * Input: { criteria: { topic?, tone?, location?, query? }, count?: number }
 */
export const twitterSourcer: SkillHandler = async (input, ctx): Promise<SkillResult> => {
  const { criteria, count = 10 } = input || {};
  if (!criteria) return { ok: false, error: 'criteria_required' };

  let bearer: string | undefined = process.env.X_BEARER_TOKEN;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('../../../lib/supabase');
    const { data } = await supabase
      .from('user_settings')
      .select('x_bearer_token')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if ((data as any)?.x_bearer_token) bearer = (data as any).x_bearer_token;
  } catch {}

  if (bearer) {
    try {
      const queryParts = [
        criteria.query || criteria.topic || '',
        criteria.tone ? criteria.tone : '',
        '-is:retweet lang:en',
      ].filter(Boolean);
      const q = queryParts.join(' ').trim() || 'hiring engineer -is:retweet lang:en';
      const max_results = Math.min(Math.max(Number(count) * 2, 10), 100);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fetch = (await import('node-fetch')).default as any;
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=${max_results}&tweet.fields=author_id,created_at,public_metrics&expansions=author_id&user.fields=name,username,description,location,public_metrics,verified`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
      if (!resp.ok) throw new Error(`x_search_${resp.status}`);
      const json: any = await resp.json();
      const usersById: Record<string, any> = {};
      for (const u of json.includes?.users || []) usersById[u.id] = u;

      // Dedupe authors, keep their best tweet.
      const byAuthor: Record<string, any> = {};
      for (const t of json.data || []) {
        if (!byAuthor[t.author_id]) byAuthor[t.author_id] = t;
      }
      const profiles = Object.values(byAuthor).slice(0, count).map((t: any) => {
        const u = usersById[t.author_id] || {};
        return {
          username: u.username,
          name: u.name,
          description: u.description,
          location: u.location,
          followers: u.public_metrics?.followers_count,
          verified: !!u.verified,
          tweet: t.text,
          tweet_url: u.username && t.id ? `https://x.com/${u.username}/status/${t.id}` : null,
          tweet_metrics: t.public_metrics,
        };
      });

      return {
        ok: true,
        data: {
          source: 'x_api',
          query: q,
          profiles,
          total_returned: profiles.length,
        },
      };
    } catch (e: any) {
      console.warn('[twitter_sourcer] api path failed, falling back:', e?.message);
    }
  }

  try {
    const { llmJSON } = await import('../llm');
    const data = await llmJSON({
      system: `You suggest X / Twitter search angles for finding candidates by post signal. Output JSON: search_queries (array of {query, why}), profile_archetypes (array of {who_to_look_for, signal}), bottom_line (string). Conservative: avoid specific handles unless you're certain they're public.`,
      user: `Criteria: ${JSON.stringify(criteria)}\nWant: ${count} suggestions.`,
      max_tokens: 600,
    });
    return {
      ok: true,
      data: {
        ...data,
        source: 'llm_prior_knowledge',
        _disclaimer: 'X bearer token not configured — set X_BEARER_TOKEN env or user_settings.x_bearer_token for live search.',
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'twitter_sourcer_failed' };
  }
};
