import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAuthed } from '../../_utils/tables';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { supabase } = getSupabaseAuthed(req);
    const { id } = req.query as { id: string };
    const body = (req.body && typeof req.body === 'string') ? JSON.parse(req.body) : (req.body || {});
    const incoming = Array.isArray(body?.collaborators) ? body.collaborators : [];

    // Get current user + role + team
    const { data: { user } } = await supabase.auth.getUser((req.headers.authorization || '').replace(/^Bearer\s+/i, '') as any);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { data: me } = await supabase.from('users').select('role, team_id').eq('id', user.id).maybeSingle();
    const roleLc = String(me?.role || '').toLowerCase();
    const isTeamAdmin = roleLc === 'team_admin';
    const isSuper = ['super_admin','superadmin'].includes(roleLc);
    if (!(isTeamAdmin || isSuper)) return res.status(403).json({ error: 'Only team admins can manage access' });

    // Fetch team members to restrict collaborator user_ids to same team
    let allowedIds: string[] = [];
    if (me?.team_id) {
      const { data: members } = await supabase.from('users').select('id, team_id').eq('team_id', me.team_id as any);
      allowedIds = (members || []).map((m: any) => m.id);
    } else {
      // If no team_id, allow only self
      allowedIds = [user.id];
    }

    const cleaned = incoming
      .map((c: any) => ({ user_id: String(c?.user_id || ''), role: (c?.role === 'edit' ? 'edit' : 'view') }))
      .filter((c: any) => c.user_id && allowedIds.includes(c.user_id));

    // Load current table to read existing collaborators
    const { data: tableRow, error: fetchErr } = await supabase
      .from('custom_tables')
      .select('id, collaborators')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!tableRow) return res.status(404).json({ error: 'Not found' });

    // Merge by user_id, prefer incoming role
    const existing: Array<{ user_id: string; role: string }> = Array.isArray((tableRow as any).collaborators) ? (tableRow as any).collaborators : [];
    const mergedMap = new Map<string, { user_id: string; role: string }>();
    for (const c of existing) mergedMap.set(String((c as any).user_id || ''), { user_id: String((c as any).user_id || ''), role: String((c as any).role || 'view') });
    for (const c of cleaned) mergedMap.set(c.user_id, { user_id: c.user_id, role: c.role });
    const merged = Array.from(mergedMap.values());

    const { data: updated, error } = await supabase
      .from('custom_tables')
      .update({ collaborators: merged, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);

    return res.status(200).json({ data: updated });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


