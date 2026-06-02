import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { resolveAnalyticsScope } from '../lib/analyticsScope';

/**
 * Returns the actual inbound reply MESSAGES for a campaign (or `all`),
 * sourced from `email_replies`. This is the content behind the reply-rate
 * metric — the rate comes from `email_events`, the text comes from here.
 *
 * Scoping mirrors the analytics endpoints: results are limited to the
 * viewer's analytics scope (self / team pool), and team analytics-sharing
 * settings are enforced via resolveAnalyticsScope().
 *
 * Query params:
 *   - limit          (default 50, max 200)
 *   - offset         (default 0)
 *   - classification (optional exact filter, e.g. positive|neutral|negative)
 */

// Mirrors the column set used by the live /api/v2/inbox route, which reflects
// the production email_replies schema (includes drift columns not in the
// checked-in migration, e.g. classification / sender_email / created_at).
const REPLY_COLS =
  'id, user_id, lead_id, campaign_id, subject, text_body, html_body, from_email, sender_email, classification, classified_at, message_id, in_reply_to, reply_ts, created_at';

const LEAD_COLS =
  'id, first_name, last_name, name, email, title, company, linkedin_url, status';

export default async function campaignReplies(req: Request, res: Response) {
  const { id } = req.params;
  const viewerId = req.user?.id as string | undefined;
  if (!viewerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!id) {
    res.status(400).json({ error: 'Missing campaign id' });
    return;
  }

  const scope = await resolveAnalyticsScope(viewerId);
  if (!scope.allowed) {
    const code = 'code' in scope ? scope.code : 'analytics_denied';
    const status = code === 'analytics_sharing_disabled' ? 403 : 401;
    res.status(status).json({ error: code });
    return;
  }

  const targetUserIds = scope.targetUserIds && scope.targetUserIds.length
    ? scope.targetUserIds
    : [viewerId];

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const classification = String(req.query.classification || '').trim();

  try {
    let query = supabaseDb
      .from('email_replies')
      .select(REPLY_COLS, { count: 'exact' });

    if (targetUserIds.length === 1) {
      query = query.eq('user_id', targetUserIds[0]);
    } else {
      query = query.in('user_id', targetUserIds);
    }

    if (id !== 'all') {
      query = query.eq('campaign_id', id);
    }
    if (classification) {
      query = query.eq('classification', classification);
    }

    const { data: replies, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[campaignReplies] Query error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Hydrate the related lead for context (separate fetch, same pattern as
    // /api/v2/inbox — avoids relying on a PostgREST embed/FK being present).
    const leadIds = Array.from(
      new Set((replies || []).map((r: any) => r.lead_id).filter(Boolean))
    );
    let leadsById: Record<string, any> = {};
    if (leadIds.length) {
      const { data: leads } = await supabaseDb
        .from('leads')
        .select(LEAD_COLS)
        .in('id', leadIds);
      for (const l of (leads || []) as any[]) leadsById[l.id] = l;
    }

    const items = (replies || []).map((r: any) => ({
      ...r,
      lead: r.lead_id ? leadsById[r.lead_id] || null : null,
    }));

    res.json({
      campaign_id: id,
      total: count ?? items.length,
      limit,
      offset,
      replies: items,
    });
    return;
  } catch (err: any) {
    console.error('[campaignReplies] Error:', err);
    res.status(500).json({ error: err?.message || 'Failed to fetch campaign replies' });
    return;
  }
}
