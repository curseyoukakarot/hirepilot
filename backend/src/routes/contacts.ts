import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function userRole(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  return String((data as any)?.role || '').toLowerCase();
}

// GET /api/contacts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const role = await userRole(userId);

    // Check permissions
    if (!['super_admin','superadmin'].includes(role)) {
      const { data: perms } = await supabase
        .from('deal_permissions')
        .select('can_view_clients')
        .eq('user_id', userId)
        .maybeSingle();
      if (!((perms as any)?.can_view_clients)) { res.status(403).json({ error: 'access_denied' }); return; }
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// POST /api/contacts
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const role = await userRole(userId);
    if (!['super_admin','superadmin'].includes(role)) {
      const { data: perms } = await supabase
        .from('deal_permissions')
        .select('can_view_clients')
        .eq('user_id', userId)
        .maybeSingle();
      if (!((perms as any)?.can_view_clients)) { res.status(403).json({ error: 'access_denied' }); return; }
    }

    const { client_id, name, title, email, phone, owner_id } = req.body || {};
    if (!client_id) { res.status(400).json({ error: 'client_id required' }); return; }
    const { data, error } = await supabase
      .from('contacts')
      .insert({ client_id, name, title, email, phone, owner_id: owner_id || userId, created_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const role = await userRole(userId);
    if (!['super_admin','superadmin'].includes(role)) {
      const { data: perms } = await supabase
        .from('deal_permissions')
        .select('can_view_clients')
        .eq('user_id', userId)
        .maybeSingle();
      if (!((perms as any)?.can_view_clients)) { res.status(403).json({ error: 'access_denied' }); return; }
    }

    const { id } = req.params;
    const { name, title, email, phone } = req.body || {};
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (title !== undefined) update.title = title;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;

    const { data, error } = await supabase
      .from('contacts')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


