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
      { role: 'user', content: 'SCHEMA:\n' + JSON.stringify(ParsedResumeSchema.shape, null, 2) },
      { role: 'user', content: 'Return only JSON for this resume text:\n' + plainText.slice(0, 120000) },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? '{}';
  const json = JSON.parse(raw || '{}');
  const parsed = ParsedResumeSchema.parse(json);
  // Coerce nulls to undefined for simple fields
  const fix = (s: any) => (s == null ? undefined : s);
  return {
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
}


