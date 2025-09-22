import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Ensure a storage bucket exists and is public
router.post('/ensure-bucket', async (req: Request, res: Response) => {
  try {
    const { bucket } = req.body || {};
    const bucketName = String(bucket || '').trim();
    if (!bucketName) return res.status(400).json({ error: 'missing_bucket' });

    // Check if exists
    const { data: list } = await supabase.storage.listBuckets();
    const exists = (list || []).some((b: any) => b.name === bucketName);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(bucketName, { public: true });
      if (createErr) return res.status(500).json({ error: createErr.message });
    } else {
      // Make sure it's public
      try { await supabase.storage.updateBucket(bucketName, { public: true } as any); } catch {}
    }
    res.json({ ok: true, bucket: bucketName });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'ensure_failed' });
  }
});

export default router;


