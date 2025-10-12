import { openai } from './openaiClient';
import { ParsedResumeSchema, type ParsedResume } from './schema';

const SYSTEM_PROMPT = `You are a hiring intelligence parser.
Return ONLY JSON matching the provided schema.
Extract from the resume text: name, title, email, phone, linkedin, summary (2–4 sentences),
skills (technical), soft_skills (communication/leadership/etc), tech (frameworks, tools),
experience (company, title, dates, description), education (school, degree, field, years).
Normalize dates if possible. If a field is unknown, omit it.`;

export async function parseResumeAI(plainText: string): Promise<ParsedResume> {
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `SCHEMA (TypeScript zod): ${ParsedResumeSchema.toString()}` },
      { role: 'user', content: `RESUME:\n${plainText}` },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? '{}';
  const json = JSON.parse(raw);
  return ParsedResumeSchema.parse(json);
}


