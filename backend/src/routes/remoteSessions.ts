import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { encryptGCM } from '../lib/crypto';

const router = Router();

function authUser(req: Request): string | null {
  // Prefer middleware-attached user; fallback to x-user-id header
  const uid = (req as any)?.user?.id || req.headers['x-user-id'];
  if (!uid) return null;
  return Array.isArray(uid) ? uid[0] : String(uid);
}

// Light validator for base64-encoded session JSON
function validateSessionPayload(decoded: string) {
  try {
    const obj = JSON.parse(decoded);
    // Accept either cookies array or li_at string inside
    if (Array.isArray(obj?.cookies)) return true;
    if (typeof obj?.li_at === 'string' && obj.li_at.length > 10) return true;
    // Some exporters wrap under data
    if (Array.isArray(obj?.data?.cookies)) return true;
    return false;
  } catch {
    return false;
  }
}

// GET /api/remote-sessions — list current user's sessions (redacted)
router.get('/remote-sessions', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { data, error } = await supabase
      .from('remote_sessions')
      .select('id,name,metadata,last_tested_at,created_at,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return res.json({ sessions: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list' });
  }
});

// POST /api/remote-sessions — store encrypted session blob
router.post('/remote-sessions', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const parsed = z.object({
      accountId: z.string().min(3).optional(),
      userId: z.string().min(3),
      sessionName: z.string().min(2),
      sessionData: z.string().min(8), // base64 blob
      metadata: z.any().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    if (parsed.data.userId !== userId) return res.status(403).json({ error: 'forbidden' });

    // Decode base64 and lightly validate
    let decoded = '';
    try {
      decoded = Buffer.from(parsed.data.sessionData, 'base64').toString('utf8');
    } catch {
      return res.status(400).json({ error: 'invalid_base64' });
    }
    if (!validateSessionPayload(decoded)) return res.status(400).json({ error: 'invalid_session_blob' });

    // Encrypt with AES-256-GCM and store ciphertext only
    const encrypted = encryptGCM(decoded);
    const ciphertextBuf = Buffer.from(JSON.stringify(encrypted), 'utf8');

    const insert = {
      account_id: parsed.data.accountId || null,
      user_id: userId,
      name: parsed.data.sessionName,
      encrypted_session_data: ciphertextBuf as unknown as any,
      metadata: parsed.data.metadata || null,
      health: null,
      last_tested_at: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any;

    const { data, error } = await supabase
      .from('remote_sessions')
      .insert(insert)
      .select('id')
      .single();
    if (error) throw error;

    return res.status(201).json({ sessionId: data?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_store' });
  }
});

// POST /api/remote-sessions/:id/test — queue validation and stamp last_tested_at
router.post('/remote-sessions/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const id = String((req.params as any)?.id || '');
    if (!id) return res.status(400).json({ error: 'missing_id' });

    // Confirm ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('remote_sessions')
      .select('id,user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== userId) return res.status(404).json({ error: 'not_found' });

    const { error } = await supabase
      .from('remote_sessions')
      .update({ last_tested_at: new Date().toISOString(), health: { status: 'queued' } })
      .eq('id', id);
    if (error) throw error;

    // TODO: enqueue a validation job (browserless HEAD to linkedin)
    return res.json({ ok: true, queued: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_test' });
  }
});

export default router;


