import { openai } from '../../ai/openaiClient';

type InferenceResult = {
  target_titles: string[];
  fallback_titles: string[];
  function: string;
  seniority: string;
  reasoning_short: string;
};

function safeJsonFromText(text: string): any | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeTitles(list: any): string[] {
  if (!Array.isArray(list)) return [];
  const out = list
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return Array.from(new Set(out)).slice(0, 12);
}

function fallbackTitlesFromJob(jobTitle: string | null, company: string | null): string[] {
  const title = String(jobTitle || '').toLowerCase();
  const fallback = new Set<string>();
  if (title.includes('product')) {
    fallback.add('Head of Product');
    fallback.add('VP Product');
    fallback.add('Director of Product');
    fallback.add('Product Lead');
  } else if (title.includes('engineering') || title.includes('software') || title.includes('developer')) {
    fallback.add('VP Engineering');
    fallback.add('Director of Engineering');
    fallback.add('Engineering Manager');
    fallback.add('Head of Engineering');
  } else if (title.includes('design')) {
    fallback.add('Head of Design');
    fallback.add('Design Director');
    fallback.add('UX Manager');
  } else if (title.includes('marketing')) {
    fallback.add('VP Marketing');
    fallback.add('Director of Marketing');
    fallback.add('Head of Growth');
  } else if (title.includes('data') || title.includes('analytics')) {
    fallback.add('Head of Data');
    fallback.add('Director of Analytics');
    fallback.add('Data Science Manager');
  } else if (title.includes('sales')) {
    fallback.add('VP Sales');
    fallback.add('Sales Director');
    fallback.add('Head of Sales');
  } else {
    fallback.add('Hiring Manager');
    fallback.add('Recruiting Manager');
    fallback.add('Talent Acquisition');
  }
  if (company) fallback.add(`Hiring Manager ${company}`);
  return Array.from(fallback).slice(0, 8);
}

export async function inferHiringManagerTitles(args: {
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  descriptionSnippet: string | null;
  context: string | null;
}) {
  const fallbackTitles = fallbackTitlesFromJob(args.jobTitle, args.company);
  const messages = [
    {
      role: 'system',
      content:
        'You are a recruiting strategist. Return only valid JSON matching the schema. Do not include markdown or extra text.'
    },
    {
      role: 'user',
      content: JSON.stringify({
        job_title: args.jobTitle,
        company: args.company,
        location: args.location,
        description_snippet: args.descriptionSnippet,
        seeker_context: args.context
      })
    }
  ];
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_JOBSEEKER_MODEL || 'gpt-5.2',
        temperature: 0.2,
        max_tokens: 400,
        messages
      });
      const raw = completion?.choices?.[0]?.message?.content || '';
      const json = safeJsonFromText(raw);
      if (!json) throw new Error('invalid_json');
      const result: InferenceResult = {
        target_titles: normalizeTitles(json.target_titles),
        fallback_titles: normalizeTitles(json.fallback_titles),
        function: String(json.function || ''),
        seniority: String(json.seniority || ''),
        reasoning_short: String(json.reasoning_short || '')
      };
      if (!result.target_titles.length) {
        result.target_titles = fallbackTitles.slice(0, 4);
      }
      if (!result.fallback_titles.length) {
        result.fallback_titles = fallbackTitles;
      }
      if (!result.function) result.function = 'unknown';
      if (!result.seniority) result.seniority = 'unknown';
      if (!result.reasoning_short) result.reasoning_short = 'Heuristic fallback used.';
      return { ok: true, result };
    } catch (e: any) {
      lastErr = e;
    }
  }
  const result: InferenceResult = {
    target_titles: fallbackTitles.slice(0, 4),
    fallback_titles: fallbackTitles,
    function: 'unknown',
    seniority: 'unknown',
    reasoning_short: `Fallback: ${String(lastErr?.message || 'inference_failed')}`
  };
  return { ok: false, result };
}

export async function rerankTargets(args: {
  jobTitle: string | null;
  company: string | null;
  targets: Array<{ name?: string | null; title?: string | null; profile_url: string; score: number }>;
}) {
  if (!args.targets.length || args.targets.length > 25) {
    return args.targets;
  }
  try {
    const messages = [
      {
        role: 'system',
        content:
          'You are ranking hiring manager candidates. Return JSON: { "ranked": [ { "profile_url": "...", "score": 0-100 } ] }.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          job_title: args.jobTitle,
          company: args.company,
          candidates: args.targets.map((t) => ({
            profile_url: t.profile_url,
            name: t.name,
            title: t.title,
            score_hint: t.score
          }))
        })
      }
    ];
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_JOBSEEKER_RANK_MODEL || 'gpt-5.2',
      temperature: 0.1,
      max_tokens: 300,
      messages
    });
    const raw = completion?.choices?.[0]?.message?.content || '';
    const json = safeJsonFromText(raw);
    if (!json || !Array.isArray(json.ranked)) return args.targets;
    const scoreByUrl = new Map<string, number>();
    for (const r of json.ranked) {
      const url = String(r?.profile_url || '');
      const score = Number(r?.score);
      if (url && Number.isFinite(score)) scoreByUrl.set(url, Math.max(0, Math.min(100, Math.round(score))));
    }
    return args.targets.map((t) => ({
      ...t,
      score: scoreByUrl.get(t.profile_url) ?? t.score
    }));
  } catch {
    return args.targets;
  }
}
