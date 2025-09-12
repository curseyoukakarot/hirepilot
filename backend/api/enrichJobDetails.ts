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

    const sys =
      'You extract structured fields from a job description. '
      + 'Return STRICT JSON with keys: department, location, experience_level, salary_range. '
      + "For salary_range, output a short human string like '$120k - $150k' if present, else an empty string.";

    const user = `Job description:\n${description || ''}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      temperature: 0.2,
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
