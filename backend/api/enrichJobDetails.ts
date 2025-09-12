import { Request, Response } from 'express';

export default async function enrichJobDetails(req: Request, res: Response) {
  try {
    const { description } = req.body || {};
    // Placeholder: simple heuristics. Replace with OpenAI/LangChain call if needed.
    const out: any = {
      department: 'Operations',
      location: 'Remote',
      experience_level: 'Senior',
      salary_range: '$100k - $140k',
    };
    if (typeof description === 'string') {
      if (/sf|san francisco|bay area/i.test(description)) out.location = 'San Francisco, CA';
      if (/marketing|growth/i.test(description)) out.department = 'Marketing';
      if (/junior|entry/i.test(description)) out.experience_level = 'Junior';
    }
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to enrich' });
  }
}
