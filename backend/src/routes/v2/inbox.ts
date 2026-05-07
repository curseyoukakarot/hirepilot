/**
 * v2 — /api/v2/inbox
 * Recent email_replies in the active workspace, with the joined lead.
 *
 * GET /api/v2/inbox             list (default 30)
 * GET /api/v2/inbox/:replyId    one thread (the reply + the lead)
 *
 * Workspace-scoping: replies don't have a workspace_id column, so we scope
 * indirectly by the lead's user_id (matching the active member set) plus
 * the user's own replies. Conservative — under-shows rather than over-shows.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { requireAuth } from '../../../middleware/authMiddleware';
import activeWorkspace from '../../middleware/activeWorkspace';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const REPLY_COLS =
  'id, user_id, lead_id, campaign_id, subject, text_body, html_body, classification, classified_at, sender_email, message_id, in_reply_to, created_at';

const LEAD_COLS =
  'id, first_name, last_name, name, email, title, company, linkedin_url, status';

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    // Pull recent replies the user has access to. We cast a wide net by user
    // id (their own outreach replies). Workspace-wide team-pool semantics can
    // be added later by joining workspace_members.
    const { data: replies, error } = await supabase
      .from('email_replies')
      .select(REPLY_COLS)
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });

    const leadIds = Array.from(new Set((replies || []).map((r: any) => r.lead_id).filter(Boolean)));
    let leadsById: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select(LEAD_COLS)
        .in('id', leadIds);
      for (const l of (leads || []) as any[]) leadsById[l.id] = l;
    }

    return res.json({
      threads: (replies || []).map((r: any) => ({
        ...r,
        lead: r.lead_id ? leadsById[r.lead_id] || null : null,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'list_inbox_failed' });
  }
});

router.get('/:replyId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthenticated' });

    const { data: reply, error } = await supabase
      .from('email_replies')
      .select(REPLY_COLS)
      .eq('id', req.params.replyId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!reply) return res.status(404).json({ error: 'reply_not_found' });
    if ((reply as any).user_id !== userId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    let lead: any = null;
    if ((reply as any).lead_id) {
      const { data } = await supabase
        .from('leads')
        .select(LEAD_COLS)
        .eq('id', (reply as any).lead_id)
        .maybeSingle();
      lead = data || null;
    }
    return res.json({ thread: { ...reply, lead } });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'get_inbox_failed' });
  }
});

export default router;
