/**
 * Researcher skill handlers — read-only enrichment / intel gathering.
 * Effectively always autopilot-safe (no outbound side effects).
 */

import type { SkillHandler, SkillResult } from '../registry';

const stub = (name: string): SkillHandler => async (input, _ctx): Promise<SkillResult> => {
  return { ok: true, data: { stub: true, skill: name, input } };
};

export const companyIntel  = stub('company_intel');
export const compBenchmark = stub('comp_benchmark');
export const newsWatch     = stub('news_watch');
