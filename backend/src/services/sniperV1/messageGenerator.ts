import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProfileContext = {
  profile_url: string;
  name?: string | null;
  headline?: string | null;
  company_name?: string | null;
  open_jobs?: string[] | null;
};

export type GenerateMessagesArgs = {
  profiles: ProfileContext[];
  promptTemplate: string;
  userContext: string;
  mode: 'connect_note' | 'message';
};

export type GeneratedMessage = {
  profile_url: string;
  generated_message: string;
};

/* ------------------------------------------------------------------ */
/*  Default prompt templates                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_CONNECT_NOTE_TEMPLATE = `Write a brief, personalized LinkedIn connection note for this person.

About the sender:
{{user_context}}

Prospect details:
- Name: {{name}}
- Headline: {{headline}}
- Company: {{company}}

Guidelines:
- Be warm and professional
- Reference something specific about them or their role
- Keep it under 280 characters (LinkedIn limit is 300)
- Include a clear reason for connecting
- Don't be salesy or pushy
- Write ONLY the note text, nothing else`;

export const DEFAULT_MESSAGE_TEMPLATE = `Write a professional LinkedIn outreach message for this person.

About the sender:
{{user_context}}

Prospect details:
- Name: {{name}}
- Headline: {{headline}}
- Company: {{company}}

Guidelines:
- Be professional and genuine
- Reference their background or role specifically
- Include a clear, soft call-to-action
- Keep it concise (2-4 sentences)
- Don't be overly salesy
- Write ONLY the message text, nothing else`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fillTemplate(template: string, profile: ProfileContext, userContext: string): string {
  const openJobsText = profile.open_jobs?.length
    ? profile.open_jobs.join(', ')
    : 'Not available';

  return template
    .replace(/\{\{user_context\}\}/gi, userContext || 'Not provided')
    .replace(/\{\{name\}\}/gi, profile.name || 'Unknown')
    .replace(/\{\{headline\}\}/gi, profile.headline || 'Not available')
    .replace(/\{\{company\}\}/gi, profile.company_name || 'Not available')
    .replace(/\{\{open_jobs\}\}/gi, openJobsText)
    .replace(/\{\{profile_url\}\}/gi, profile.profile_url || '');
}

/* ------------------------------------------------------------------ */
/*  Core generation (batched)                                          */
/* ------------------------------------------------------------------ */

const BATCH_SIZE = 10;

async function generateBatch(
  profiles: ProfileContext[],
  promptTemplate: string,
  userContext: string,
  mode: 'connect_note' | 'message',
): Promise<GeneratedMessage[]> {
  if (profiles.length === 0) return [];

  const maxLen = mode === 'connect_note' ? 300 : 3000;
  const modeLabel = mode === 'connect_note' ? 'connection note' : 'message';

  // For a single profile, use simple single-message generation
  if (profiles.length === 1) {
    const p = profiles[0];
    const filledPrompt = fillTemplate(promptTemplate, p, userContext);

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert LinkedIn outreach writer. Generate a single ${modeLabel} (max ${maxLen} characters). Output ONLY the ${modeLabel} text — no quotes, no labels, no explanation.`,
        },
        { role: 'user', content: filledPrompt },
      ],
      temperature: 0.7,
      max_tokens: mode === 'connect_note' ? 150 : 500,
    });

    const text = (resp.choices[0]?.message?.content || '').trim().slice(0, maxLen);
    return [{ profile_url: p.profile_url, generated_message: text }];
  }

  // For multiple profiles, batch into a single API call
  const profileDescriptions = profiles.map((p, i) => {
    let desc = `[${i + 1}] Name: ${p.name || 'Unknown'} | Headline: ${p.headline || 'N/A'} | Company: ${p.company_name || 'N/A'} | URL: ${p.profile_url}`;
    if (p.open_jobs?.length) desc += ` | Open Jobs: ${p.open_jobs.join(', ')}`;
    return desc;
  }).join('\n');

  const filledTemplate = promptTemplate
    .replace(/\{\{user_context\}\}/gi, userContext || 'Not provided')
    .replace(/\{\{name\}\}/gi, '(see each profile below)')
    .replace(/\{\{headline\}\}/gi, '(see each profile below)')
    .replace(/\{\{company\}\}/gi, '(see each profile below)')
    .replace(/\{\{open_jobs\}\}/gi, '(see each profile below)')
    .replace(/\{\{profile_url\}\}/gi, '(see each profile below)');

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert LinkedIn outreach writer. Generate personalized ${modeLabel}s (max ${maxLen} chars each).

You will receive a template/instructions and multiple prospect profiles. Generate one unique, personalized ${modeLabel} for each prospect.

Reply ONLY with valid JSON — an array of objects:
[{"index": 1, "message": "the personalized ${modeLabel}"}, ...]

Do NOT include any text outside the JSON array. Each message must be unique and tailored to that specific prospect.`,
      },
      {
        role: 'user',
        content: `## Instructions/Template:\n${filledTemplate}\n\n## Prospects:\n${profileDescriptions}`,
      },
    ],
    temperature: 0.7,
    max_tokens: profiles.length * (mode === 'connect_note' ? 200 : 600),
  });

  const content = (resp.choices[0]?.message?.content || '').trim();

  try {
    // Parse the JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('no_json_array');
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; message: string }>;

    return profiles.map((p, i) => {
      const match = parsed.find((m) => m.index === i + 1);
      return {
        profile_url: p.profile_url,
        generated_message: (match?.message || '').trim().slice(0, maxLen),
      };
    });
  } catch {
    // Fallback: if JSON parsing fails, try to split by numbered lines
    const lines = content.split(/\n/).filter((l) => l.trim());
    return profiles.map((p, i) => {
      const line = lines[i] || '';
      // Remove numbering prefix like "[1]" or "1."
      const cleaned = line.replace(/^\[?\d+\]?\.?\s*/, '').trim().slice(0, maxLen);
      return { profile_url: p.profile_url, generated_message: cleaned };
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function generateMessages(args: GenerateMessagesArgs): Promise<GeneratedMessage[]> {
  const { profiles, promptTemplate, userContext, mode } = args;
  if (!profiles.length) return [];

  const results: GeneratedMessage[] = [];
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    const batchResults = await generateBatch(batch, promptTemplate, userContext, mode);
    results.push(...batchResults);
  }

  return results;
}
