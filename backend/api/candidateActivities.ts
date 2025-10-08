import { Router, Response } from 'express';
import { ApiRequest } from '../types/api';
import { requireAuth } from '../middleware/authMiddleware';
import { supabaseDb as supabase } from '../lib/supabase';

const router = Router();

// POST /api/candidate-activities
// Create a candidate activity (used when a candidate has no linked lead)
router.post('/', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string | undefined;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { candidate_id, job_id, status, notes, activity_type, tags } = (req.body || {}) as {
      candidate_id?: string;
      job_id?: string | null;
      status?: string | null;
      notes?: string | null;
      activity_type?: string | null;
      tags?: string[] | null;
    };

    if (!candidate_id) {
      res.status(400).json({ success: false, message: 'candidate_id is required' });
      return;
    }

    // Verify access (owner or same-team/member rules similar to GET /api/activities)
    const { data: cand, error: candErr } = await supabase
      .from('candidates')
      .select('id, user_id')
      .eq('id', candidate_id)
      .single();
    if (candErr || !cand) { res.status(404).json({ success: false, message: 'Candidate not found' }); return; }

    if (cand.user_id !== userId) {
      // Fetch current user's team/role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('team_id, role')
        .eq('id', userId)
        .single();
      if (userError) { res.status(500).json({ success: false, message: 'Failed to fetch user data' }); return; }

      const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
      const sameTeamAsOwner = await supabase
        .from('users')
        .select('team_id')
        .eq('id', cand.user_id)
        .eq('team_id', userData.team_id)
        .single()
        .then(({ data }) => !!data);

      const canAccess = (userData.team_id && isAdmin) || (userData.team_id && sameTeamAsOwner);

      if (!canAccess) { res.status(403).json({ success: false, message: 'Access denied' }); return; }
    }

    const now = new Date().toISOString();
    const insertRow: any = {
      candidate_id,
      job_id: job_id || null,
      // Only persist status if it matches candidate_status enum; otherwise omit
      notes: notes || null,
      created_at: now,
      created_by: userId
    };

    const allowedStatuses = new Set(['sourced','contacted','interviewed','offered','hired','rejected']);
    const normalizedStatus = typeof status === 'string' && allowedStatuses.has(status) ? status : null;
    if (normalizedStatus) insertRow.status = normalizedStatus;

    const { data: row, error } = await supabase
      .from('candidate_activities')
      .insert(insertRow)
      .select('id, candidate_id, job_id, status, notes, created_at, created_by')
      .single();
    if (error) { res.status(500).json({ success: false, message: error.message || 'Failed to create candidate activity' }); return; }

    // Normalize to ActivityLogSection shape
    const activity = {
      id: `cand-${row.id}`,
      activity_type: (activity_type || 'Candidate'),
      tags: Array.isArray(tags) && tags.length ? tags : (row.status ? [row.status] : (activity_type ? [activity_type] : [])),
      notes: row.notes || null,
      activity_timestamp: row.created_at,
      created_at: row.created_at,
      updated_at: row.created_at,
      origin: 'candidate'
    };

    res.status(201).json({ success: true, activity });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Internal server error' });
  }
});

export default router;


