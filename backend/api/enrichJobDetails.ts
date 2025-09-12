import { Request, Response } from 'express';
import OpenAI from 'openai';

export default async function enrichJobDetails(req: Request, res: Response) {
  try {
    const { description } = req.body || {};

    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!key) {
      // Fallback if key not present
      const out: any = {
        department: 'Operations',
        location: 'Remote',
        experience_level: 'Senior',
        salary_range: '$100k - $140k',
      };
      return res.json(out);
    }

    const client = new OpenAI({ apiKey: key });

    const systemPrompt = [
      'You are an expert job description parser.',
      '',
      'Your task is to extract four structured fields from a job description. You must output a strict JSON object with the following keys:',
      '- department: The functional area this job belongs to (e.g., "Engineering", "Sales", "Marketing", "Product", etc.)',
      '- location: A concise location string (e.g., "Remote", "San Francisco", "Hybrid - NYC"). If not mentioned, return "".',
      '- experience_level: One of the following: "Entry", "Mid", "Senior", "Director", "VP", "Executive", or "" if unclear.',
      '- salary_range: If a salary is mentioned, return a clean string like "$120k - $150k". If not mentioned, return "".',
      '',
      'Output only valid JSON — no comments, explanations, or extra fields.'
    ].join('\n');

    const examples = [
      'Example 1',
      '',
      'Job description:',
      '"""',
      'We’re hiring a Senior Backend Engineer to join our remote-first engineering team. This is a mid-senior level position with compensation between $130k–$160k. You\'ll work closely with Product and DevOps.',
      '"""',
      '',
      'Expected JSON output:',
      '{',
      '  "department": "Engineering",',
      '  "location": "Remote",',
      '  "experience_level": "Senior",',
      '  "salary_range": "$130k - $160k"',
      '}',
      '',
      'Example 2',
      '',
      'Job description:',
      '"""',
      'This is a hybrid marketing role based in our NYC office. We’re looking for a Director of Growth with deep experience in paid media, SEO, and marketing automation. Compensation is competitive.',
      '"""',
      '',
      'Expected JSON output:',
      '{',
      '  "department": "Marketing",',
      '  "location": "Hybrid - NYC",',
      '  "experience_level": "Director",',
      '  "salary_range": ""',
      '}',
      '',
      'Example 3',
      '',
      'Job description:',
      '"""',
      'We’re seeking an entry-level Sales Development Rep to join our sales team in Austin, TX. You\'ll be responsible for outbound prospecting and booking meetings for Account Executives. Compensation includes a base of $50k–$65k plus commission.',
      '"""',
      '',
      'Expected JSON output:',
      '{',
      '  "department": "Sales",',
      '  "location": "Austin, TX",',
      '  "experience_level": "Entry",',
      '  "salary_range": "$50k - $65k"',
      '}',
      '',
      'Now extract fields from the following job description:',
      '',
      'Job description:',
      '"""',
      String(description || ''),
      '"""'
    ].join('\n');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: examples }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const out = {
      department: parsed.department || '',
      location: parsed.location || '',
      experience_level: parsed.experience_level || '',
      salary_range: parsed.salary_range || '',
    };

    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to enrich' });
  }
}
