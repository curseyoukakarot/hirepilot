import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId } from '../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { supabase, userId } = await requireUserId(req);

    if (req.method === 'GET') {
      // RLS-enforced visibility will include owner and collaborators
      const { data, error } = await supabase
        .from('custom_tables')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ data: data || [] });
    }

    if (req.method === 'POST') {
      const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
      const name = String(body.name || 'Untitled Table').slice(0, 200);
      const schema_json = Array.isArray(body.schema_json) ? body.schema_json : [];
      const data_json = Array.isArray(body.initial_data) ? body.initial_data : [];
      const collaborators = Array.isArray(body.collaborators) ? body.collaborators : [];
      const { data, error } = await supabase
        .from('custom_tables')
        .insert({
          user_id: userId,
          name,
          schema_json,
          data_json,
          collaborators,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ data });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


