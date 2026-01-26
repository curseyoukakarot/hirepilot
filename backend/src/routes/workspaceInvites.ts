import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';

const router = Router();

// GET /api/workspace-invites/:token
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'invalid_token' });

    const { data: invite, error } = await supabase
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, expires_at, invited_by, created_at')
      .eq('token', token)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!invite?.id) return res.status(404).json({ error: 'invite_not_found' });

    const expired =
      invite.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;

    const [{ data: workspace }, { data: inviter }] = await Promise.all([
      supabase.from('workspaces').select('id,name').eq('id', invite.workspace_id).maybeSingle(),
      invite.invited_by
        ? supabase.from('users').select('id,first_name,last_name,email').eq('id', invite.invited_by).maybeSingle()
        : Promise.resolve({ data: null })
    ] as any);

    return res.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expires_at: invite.expires_at,
      is_expired: expired,
      workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
      invited_by: inviter
        ? {
            first_name: (inviter as any).first_name || '',
            last_name: (inviter as any).last_name || '',
            email: (inviter as any).email || ''
          }
        : null
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

// POST /api/workspace-invites/:token/accept
router.post('/:token/accept', requireAuth as any, async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim();
    const userId = (req as any)?.user?.id as string | undefined;
    const userEmail = String((req as any)?.user?.email || '').toLowerCase();
    if (!token) return res.status(400).json({ error: 'invalid_token' });
    if (!userId || !userEmail) return res.status(401).json({ error: 'unauthorized' });

    const { data: invite, error } = await supabase
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!invite?.id) return res.status(404).json({ error: 'invite_not_found' });
    if (String(invite.email || '').toLowerCase() !== userEmail) {
      return res.status(403).json({ error: 'email_mismatch' });
    }
    const expired = invite.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;
    if (expired) return res.status(400).json({ error: 'invite_expired' });

    const role = String(invite.role || 'member').toLowerCase();
    const memberRole = role === 'admin' ? 'admin' : 'member';

    await supabase
      .from('workspace_members')
      .upsert(
        [{ workspace_id: invite.workspace_id, user_id: userId, role: memberRole, status: 'active' }],
        { onConflict: 'workspace_id,user_id' } as any
      );

    await supabase
      .from('workspace_invites')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', invite.id);

    return res.json({ success: true, workspace_id: invite.workspace_id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

export default router;
