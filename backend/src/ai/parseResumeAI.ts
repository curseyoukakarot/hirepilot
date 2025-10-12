import { openai } from './openaiClient';
import { ParsedResumeSchema, type ParsedResume } from './schema';

const SYSTEM_PROMPT = `You are a hiring intelligence parser.
Return ONLY valid JSON conforming exactly to the provided schema properties and types.
Rules:
- Use non-null strings; if unknown, use "" (empty string) not null and not the word "Unknown".
- All arrays must be present, even if empty: skills[], soft_skills[], tech[], experience[], education[].
- Dates can be natural language strings (e.g., "Jan 2022") for start_date/end_date.
- Do not include any text outside JSON. No markdown, no code fences.`;

const SCHEMA_MESSAGE = `SCHEMA:\n{
  "name": "string",
  "title": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "summary": "string",
  "skills": ["string"],
  "soft_skills": ["string"],
  "tech": ["string"],
  "experience": [
    { "company":"string", "title":"string", "start_date":"string", "end_date":"string", "location":"string", "description":"string" }
  ],
  "education": [
    { "school":"string", "degree":"string", "field":"string", "start_year": "number", "end_year": "number" }
  ]
}`;

export async function parseResumeAI(plainText: string): Promise<{ parsed: ParsedResume; raw: string }> {
  const MAX = 100000;

  async function call(messages: any[]) {
    return openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    });
  }

  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: SCHEMA_MESSAGE },
    { role: 'user', content: 'RESUME TEXT:\n' + String(plainText || '').slice(0, MAX) },
  ];

  let resp = await call(baseMessages);
  let raw = resp.choices?.[0]?.message?.content || '{}';
  let jsonStr = raw;

  // Retry once if invalid JSON
  try { JSON.parse(jsonStr || '{}'); }
  catch {
    resp = await call([
      ...baseMessages,
      { role: 'assistant', content: raw },
      { role: 'user', content: 'Your last output was invalid JSON. Fix it and return ONLY valid JSON conforming to the schema.' },
    ]);
    raw = resp.choices?.[0]?.message?.content || '{}';
    jsonStr = raw;
  }

  const json = JSON.parse(jsonStr || '{}');
  const parsed = ParsedResumeSchema.parse(json);
  // Coerce nulls to undefined for simple fields
  const fix = (s: any) => (s == null ? undefined : s);
  const out: ParsedResume = {
    name: fix(parsed.name),
    title: fix(parsed.title),
    email: fix(parsed.email),
    phone: fix(parsed.phone),
    linkedin: fix(parsed.linkedin),
    summary: fix(parsed.summary),
    skills: parsed.skills || [],
    soft_skills: parsed.soft_skills || [],
    tech: parsed.tech || [],
    experience: parsed.experience || [],
    education: parsed.education || [],
  } as any;
  return { parsed: out, raw };
}


