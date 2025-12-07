import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { encryptGCM } from '../lib/crypto';

function getUserId(req: Request): string | string[] | undefined {
  // Express attaches user via middleware; fallback to header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any).user?.id || req.headers['x-user-id'];
}

export function registerLinkedInSessionRoutes(app: Application) {
  app.post('/api/integrations/linkedin/session', async (req: Request, res: Response) => {
    const user_id = getUserId(req);
    if (!user_id || (Array.isArray(user_id) ? user_id.length === 0 : false)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const body = z.object({
      li_at: z.string().min(20),
      cookie: z.string().min(20),
      jsessionid: z.string().optional()
    }).safeParse(req.body);

    if (!body.success) {
      return res.status(400).json({ error: 'invalid_payload', details: body.error.flatten() });
    }

    const now = new Date().toISOString();
    const userIdValue = Array.isArray(user_id) ? user_id[0] : user_id;
    const encryptedCookie = JSON.stringify(encryptGCM(body.data.cookie));
    const encryptedLiAt = JSON.stringify(encryptGCM(body.data.li_at));
    const encryptedJSession = body.data.jsessionid ? JSON.stringify(encryptGCM(body.data.jsessionid)) : null;

    const payload = {
      user_id: userIdValue,
      enc_cookie: encryptedCookie,
      cookie_string: encryptedCookie,
      enc_li_at: encryptedLiAt,
      enc_jsessionid: encryptedJSession,
      updated_at: now,
      last_used_at: now,
      source: 'integration_api'
    };

    const { error } = await supabase
      .from('linkedin_sessions')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });

  app.get('/api/integrations/linkedin/session', async (req: Request, res: Response) => {
    const user_id = getUserId(req);
    if (!user_id || (Array.isArray(user_id) ? user_id.length === 0 : false)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { data, error } = await supabase
      .from('linkedin_sessions')
      .select('updated_at')
      .eq('user_id', Array.isArray(user_id) ? user_id[0] : user_id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ hasSession: !!data, updated_at: data?.updated_at ?? null });
  });
}


