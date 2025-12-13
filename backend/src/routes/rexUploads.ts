import express, { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase';
import { extractTextFromBuffer } from '../ai/extractText';
import { requireAuth } from '../../middleware/authMiddleware';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const BUCKET = process.env.SUPABASE_REX_UPLOADS_BUCKET || 'rex-chat-uploads';

async function ensureBucket() {
  try {
    const { data } = await (supabase as any).storage.getBucket(BUCKET);
    if (data) return true;
  } catch {}
  try {
    await (supabase as any).storage.createBucket(BUCKET, { public: false });
  } catch {}
  try {
    const { data } = await (supabase as any).storage.getBucket(BUCKET);
    return !!data;
  } catch {
    return false;
  }
}

router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'missing_file' });

    const ok = await ensureBucket();
    if (!ok) return res.status(500).json({ error: 'storage_unavailable' });

    const safeName = String(file.originalname || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `attachments/${userId}/${Date.now()}_${safeName}`;
    let { data, error } = await (supabase as any).storage
      .from(BUCKET)
      .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
    if (error && /bucket not found/i.test(String(error.message || ''))) {
      await ensureBucket();
      const retry = await (supabase as any).storage
        .from(BUCKET)
        .upload(path, file.buffer, { upsert: false, contentType: file.mimetype || 'application/octet-stream' });
      data = retry.data;
      error = retry.error;
    }
    if (error) return res.status(400).json({ error: error.message || 'upload_failed' });

    // Extract text for immediate model consumption
    let text = '';
    try {
      text = await extractTextFromBuffer(file.buffer, file.mimetype || 'application/octet-stream');
    } catch (e: any) {
      text = '';
    }

    const signed = await (supabase as any).storage.from(BUCKET).createSignedUrl(data?.path || path, 60 * 60);

    res.json({
      ok: true,
      name: safeName,
      path: data?.path || path,
      url: signed?.data?.signedUrl || null,
      text,
      mime: file.mimetype || 'application/octet-stream',
      size: file.size,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'upload_failed' });
  }
});

export default router;

