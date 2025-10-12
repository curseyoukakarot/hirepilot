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
    res.json({ ok: true, parsed });
  } catch (e: any) {
    res.status(500).json({ error: 'parse_failed', detail: String(e?.message || e) });
  }
});


