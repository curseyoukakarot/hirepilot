import { z } from 'zod';
import { chatLLM } from '../../../lib/llm';

export const ProposeQueryVariantsSchema = z.object({
  variants: z.array(z.object({
    rank: z.number().int().min(1).max(6),
    apollo_params: z.object({
      person_titles: z.array(z.string().min(1)).optional(),
      person_locations: z.array(z.string().min(1)).optional(),
      q_keywords: z.string().optional(),
      page_strategy: z.object({
        start_page: z.number().int().min(1).max(50),
        max_pages: z.number().int().min(1).max(10),
      }),
    }),
    expansion_level: z.object({
      location: z.enum(['metro', 'region', 'state', 'country']),
      titles: z.enum(['strict', 'adjacent']),
    }),
    reason: z.string().min(1),
  })).min(3).max(6),
});

export const JudgeResultsQualitySchema = z.object({
  quality_score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  decision: z.enum(['ACCEPT_RESULTS', 'ITERATE', 'FALLBACK', 'NOTIFY_USER']),
  failure_mode: z.enum([
    'too_narrow',
    'geo_mismatch',
    'title_drift',
    'deliverability_low',
    'duplicates_high',
    'irrelevant_industries',
    'other',
  ]),
  reasons_good: z.array(z.string()).default([]),
  reasons_bad: z.array(z.string()).default([]),
  recommended_adjustment: z.object({
    type: z.enum([
      'paginate',
      'broaden_location',
      'tighten_titles',
      'broaden_titles',
      'relax_keywords',
      'change_email_policy',
    ]),
    notes: z.string().default(''),
  }).optional(),
});

export type ProposeQueryVariants = z.infer<typeof ProposeQueryVariantsSchema>;
export type JudgeResultsQuality = z.infer<typeof JudgeResultsQualitySchema>;

function safeJsonParse(raw: string): unknown {
  const s = String(raw || '').trim();
  if (!s) throw new Error('empty');
  // Strip ```json fences if present
  const stripped = s
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(stripped);
}

export async function callGptJsonWithRetry<T>(
  args: {
    name: string;
    schema: z.ZodType<T>;
    system: string;
    user: string;
    maxAttempts?: number; // default 2 (first + one correction)
  }
): Promise<{ ok: true; value: T } | { ok: false; error: string; raw?: string }> {
  const max = Math.max(1, Math.min(args.maxAttempts ?? 2, 2));
  let lastRaw = '';
  let lastErr = '';

  for (let attempt = 1; attempt <= max; attempt++) {
    const correction = attempt === 1
      ? ''
      : `\n\nThe previous output was invalid JSON for schema "${args.name}". Return ONLY corrected JSON, no commentary.\nPrevious output:\n${lastRaw}\n\nError:\n${lastErr}\n`;

    const raw = await chatLLM([
      { role: 'system', content: `${args.system}\n\nYou MUST return strict JSON only. No markdown, no code fences.` },
      { role: 'user', content: `${args.user}${correction}` },
    ]);
    lastRaw = raw;

    try {
      const parsed = safeJsonParse(raw);
      const validated = args.schema.parse(parsed);
      return { ok: true, value: validated };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  return { ok: false, error: `invalid_gpt_output:${args.name}:${lastErr}`, raw: lastRaw };
}

export const PROMPT_PROPOSE_QUERY_VARIANTS = `
You are HirePilot's Agentic Scheduler Sourcing assistant.

Task:
- Propose 3 to 6 ranked Apollo.io query variants (rank 1 = best) for sourcing people that match the persona.
- You must obey exclusions and guardrails.
- Always include ONE baseline-like variant that stays close to persona constraints.
- Include page_strategy so we don't repeatedly pull only page 1 across runs.

Output: strict JSON matching the provided schema.`;

export const PROMPT_JUDGE_RESULTS_QUALITY = `
You are HirePilot's Sourcing Quality Judge.

Task:
- Evaluate whether the search results fit the persona using the provided metrics and sample leads.
- Decide one of: ACCEPT_RESULTS, ITERATE, FALLBACK, NOTIFY_USER.
- Provide quality_score (0-100) and confidence (0-1).
- If ITERATE, provide recommended_adjustment hints.

Output: strict JSON matching the provided schema.`;

