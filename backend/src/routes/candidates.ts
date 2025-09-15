import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';
import { supabase } from '../lib/supabase';

const router = express.Router();

const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];

// Verify ownership helper
async function ensureCandidateOwnership(candidateId: string, userId: string) {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, user_id')
    .eq('id', candidateId)
    .single();
  if (error || !data) return { ok: false, error: 'Candidate not found' };
  if (data.user_id !== userId) return { ok: false, error: 'Access denied' };
  return { ok: true };
}

// PUT /api/candidates/:id - update candidate fields (limited)
router.put('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[PUT /api/candidates/:id] body=', req.body);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing candidate id' });

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) return res.status(404).json({ error: own.error });

    const { status, first_name, last_name, email, phone, notes } = req.body || {};
    const update: any = {};
    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}` });
      }
      update.status = status;
    }
    if (first_name !== undefined) update.first_name = first_name;
    if (last_name !== undefined) update.last_name = last_name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update candidate' });

    // Sync changes to the corresponding lead record if it exists
    if (data.lead_id) {
      const leadUpdate: any = {};
      if (first_name !== undefined) leadUpdate.first_name = first_name;
      if (last_name !== undefined) leadUpdate.last_name = last_name;
      if (email !== undefined) leadUpdate.email = email;
      if (phone !== undefined) leadUpdate.phone = phone;
      
      // Only update lead if there are fields to sync
      if (Object.keys(leadUpdate).length > 0) {
        try {
          await supabase
            .from('leads')
            .update(leadUpdate)
            .eq('id', data.lead_id)
            .eq('user_id', userId);
        } catch (leadSyncError) {
          console.warn('Failed to sync candidate update to lead:', leadSyncError);
          // Don't fail the candidate update if lead sync fails
        }
      }
    }

    try {
      const { emitZapEvent, ZAP_EVENT_TYPES } = await import('../../lib/zapEventEmitter');
      await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_UPDATED, eventData: data, sourceTable: 'candidates', sourceId: data.id });
    } catch {}

    return res.json(data);
  } catch (e) {
    console.error('Update candidate error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/candidates/:id - delete candidate
router.delete('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[DELETE /api/candidates/:id] id=', req.params.id);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing candidate id' });

    const own = await ensureCandidateOwnership(id, userId);
    if (!own.ok) return res.status(404).json({ error: own.error });

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to delete candidate' });

    try {
      const { emitZapEvent, ZAP_EVENT_TYPES } = await import('../../lib/zapEventEmitter');
      await emitZapEvent({ userId, eventType: ZAP_EVENT_TYPES.CANDIDATE_UPDATED, eventData: { id, action: 'deleted' }, sourceTable: 'candidates', sourceId: id });
    } catch {}

    return res.json({ success: true });
  } catch (e) {
    console.error('Delete candidate error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/bulk-status { ids: string[], status: string }
router.post('/bulk-status', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids, status } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });
    if (!ALLOWED_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { error } = await supabase
      .from('candidates')
      .update({ status })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to update status' });
    return res.json({ success: true });
  } catch (e) {
    console.error('Bulk status error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/bulk-delete { ids: string[] }
router.post('/bulk-delete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Missing ids' });

    const { error } = await supabase
      .from('candidates')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to delete candidates' });
    return res.json({ success: true });
  } catch (e) {
    console.error('Bulk delete error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

