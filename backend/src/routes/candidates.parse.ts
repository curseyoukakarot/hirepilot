import { Router } from 'express';
import multer from 'multer';
import { extractTextFromBuffer } from '../ai/extractText';
import { parseResumeAI } from '../ai/parseResumeAI';
import { requireAuthUnified as requireAuth } from '../../middleware/requireAuthUnified';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const parseRouter = Router();

parseRouter.post('/api/candidates/parse', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) { res.status(400).json({ error: 'file missing' }); return; }
    const text = await extractTextFromBuffer(file.buffer, file.mimetype || 'application/octet-stream');
    const parsed = await parseResumeAI(text);
    // Normalize empty/undefined to 'Unknown' for UI compatibility
    const withDefaults = {
      name: parsed.name ?? 'Unknown',
      title: parsed.title ?? 'Unknown',
      email: parsed.email ?? 'Unknown',
      phone: parsed.phone ?? 'Unknown',
      linkedin: parsed.linkedin ?? 'Unknown',
      summary: parsed.summary ?? 'Unknown',
      skills: parsed.skills || [],
      soft_skills: parsed.soft_skills || [],
      tech: parsed.tech || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
    };
    res.json({ ok: true, parsed: withDefaults });
  } catch (e: any) {
    res.status(500).json({ error: 'parse_failed', detail: String(e?.message || e) });
  }
});


