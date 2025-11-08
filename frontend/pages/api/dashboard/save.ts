import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

type Json = { [key: string]: any } | any[] | string | number | boolean | null;

function json(res: NextApiResponse, status: number, body: Json) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  let userId = '';
  try {
    const secret = process.env.SUPABASE_JWT_SECRET as string;
    const decoded: any = jwt.verify(token, secret);
    userId = String(decoded?.sub || '');
    if (!userId) throw new Error('no sub');
  } catch (_e) {
    return json(res, 401, { error: 'Invalid token' });
  }

  const layout = (req.body && (req.body.layout ?? null)) as any;
  if (!Array.isArray(layout)) {
    return json(res, 400, { error: 'Invalid layout' });
  }

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server not configured' });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Upsert by user_id
  const { error } = await admin
    .from('user_dashboards')
    .upsert(
      { user_id: userId, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    return json(res, 500, { error: error.message || 'save failed' });
  }
  return json(res, 200, { ok: true });
}

import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const layout = body?.layout;
    if (!Array.isArray(layout)) return res.status(400).json({ error: 'layout must be an array' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Update-if-exists, else insert (table may not have a unique constraint on user_id)
    const { data: existing } = await supabase
      .from('user_dashboards')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('user_dashboards')
        .update({ layout, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from('user_dashboards')
        .insert({ user_id: user.id, layout, updated_at: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


