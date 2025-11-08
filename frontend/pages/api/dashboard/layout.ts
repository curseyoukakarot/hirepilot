import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

type Json = { [key: string]: any } | any[] | string | number | boolean | null;

function json(res: NextApiResponse, status: number, body: Json) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY as string;
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server not configured' });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from('user_dashboards')
    .select('layout')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && (error as any).code !== 'PGRST116') {
    return json(res, 500, { error: error.message || 'failed' });
  }
  return json(res, 200, { layout: (data && (data as any).layout) || [] });
}

import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('user_dashboards')
      .select('layout')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });

    // Default preset if none
    const defaultLayout = [
      { widget_id: 'Hiring Funnel', position: { x: 0, y: 0 } },
      { widget_id: 'Reply Rate Chart', position: { x: 1, y: 0 } },
      { widget_id: 'Open Rate Widget', position: { x: 2, y: 0 } },
      { widget_id: 'Revenue Forecast', position: { x: 0, y: 1 } },
      { widget_id: 'Deal Pipeline', position: { x: 1, y: 1 } },
      { widget_id: 'Team Performance', position: { x: 2, y: 1 } },
    ];

    return res.status(200).json({ layout: data?.layout || defaultLayout });
  } catch (e: any) {
    return res.status(e?.statusCode || 500).json({ error: e?.message || 'Failed' });
  }
}


