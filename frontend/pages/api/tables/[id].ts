import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed } from '../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('custom_tables')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ data });
    }

    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


