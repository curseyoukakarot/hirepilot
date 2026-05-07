/**
 * Researcher skill handlers — read-only intel gathering.
 * Effectively always autopilot-safe (no outbound side effects, no spend
 * outside OpenAI tokens).
 */

import type { SkillHandler, SkillResult } from '../registry';
import { llmJSON as llmJSONShared } from '../llm';

async function llmJSON(system: string, user: string, max_tokens = 600): Promise<any> {
  return llmJSONShared({ system, user, max_tokens });
}

/**
 * Company Intel — funding stage, headcount, leadership changes, tech stack.
 * Currently uses OpenAI's prior knowledge (cheap, fast). When Browserbase
 * comes online, swap this for a live web pull.
 *
 * Input: { company, domain? }
 */
export const companyIntel: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { company, domain } = input || {};
  if (!company) return { ok: false, error: 'company_required' };
  try {
    const data = await llmJSON(
      `You are a recruiting researcher. Summarize what a recruiter needs to know about a company so they can pitch candidates well. Output JSON keys: stage, headcount_estimate, recent_leadership_change, tech_stack, last_funding, notable_signals (array of 3-5 short strings), confidence (0-1). Mark any inferred (vs. confirmed) values clearly with "(inferred)".`,
      `Company: ${company}${domain ? ' (' + domain + ')' : ''}.`,
      500,
    );
    return { ok: true, data: { ...data, source: 'llm_prior_knowledge', _disclaimer: 'Verify before quoting in outreach.' } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'company_intel_failed' };
  }
};

/**
 * Comp Benchmark — pulls a market salary range. Inferred unless real comp
 * data is wired (TODO: Levels.fyi/Glassdoor integration).
 *
 * Input: { role, level?, location?, equityType? }
 */
export const compBenchmark: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { role, level, location, equityType } = input || {};
  if (!role) return { ok: false, error: 'role_required' };
  try {
    const data = await llmJSON(
      `You produce a comp benchmark for recruiters. Output JSON: base_low, base_mid, base_high (USD), equity_pct_low, equity_pct_high, signing_typical, total_comp_low, total_comp_high, methodology (string), confidence (0-1). Be conservative; mark "(estimate — verify with Levels.fyi)".`,
      `Role: ${role}${level ? ' · level ' + level : ''}${location ? ' · ' + location : ''}${equityType ? ' · equity type: ' + equityType : ''}`,
      500,
    );
    return { ok: true, data: { ...data, source: 'llm_estimate', _disclaimer: 'Verify against Levels.fyi or Glassdoor before quoting.' } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'comp_benchmark_failed' };
  }
};

/**
 * News Watch — surfaces recent signals about a company (funding, layoffs,
 * exec changes). Currently LLM prior-knowledge; upgrade to Browserbase.
 *
 * Input: { company, sinceDays? }
 */
export const newsWatch: SkillHandler = async (input, _ctx): Promise<SkillResult> => {
  const { company, sinceDays = 90 } = input || {};
  if (!company) return { ok: false, error: 'company_required' };
  try {
    const data = await llmJSON(
      `You scan public signals (funding, exec moves, layoffs, product launches). Output JSON: signals (array of {date_estimate, type, summary, recruiting_relevance}), bottom_line (1-2 sentences). Don't fabricate dates.`,
      `Company: ${company}. Window: roughly the last ${sinceDays} days.`,
      550,
    );
    return { ok: true, data: { ...data, source: 'llm_prior_knowledge', _disclaimer: 'Cross-check with the company press page before acting.' } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'news_watch_failed' };
  }
};
