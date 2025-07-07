import { ApiRequest } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { personalizeMessage } from '../utils/messageUtils';

/**
 * POST /api/messages/bulk-schedule
 * Body: { template_id, lead_ids, scheduled_at, sender }
 */
export default async function bulkSchedule(req: ApiRequest, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { template_id, lead_ids, scheduled_at, sender } = req.body;
  if (!template_id || !Array.isArray(lead_ids) || !lead_ids.length || !scheduled_at || !sender) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  try {
    // Fetch template content
    const { data: tmpl, error: tmplErr } = await supabaseDb
      .from('templates')
      .select('content')
      .eq('id', template_id)
      .eq('user_id', userId)
      .single();
    if (tmplErr || !tmpl) throw new Error('Template not found');

    // Fetch leads (owner check)
    const { data: leads, error: leadsErr } = await supabaseDb
      .from('leads')
      .select('*')
      .in('id', lead_ids)
      .eq('user_id', userId);
    if (leadsErr) throw leadsErr;

    const rows = leads.map((lead: any) => ({
      lead_id: lead.id,
      user_id: userId,
      template_id,
      channel: sender.provider,
      sender_meta: sender,
      content: personalizeMessage(tmpl.content, lead),
      status: 'scheduled',
      scheduled_at,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabaseDb.from('messages').insert(rows);
    if (error) throw error;

    res.status(201).json({ scheduled: rows.length, scheduled_at });
  } catch (e: any) {
    console.error('[bulkSchedule] error', e);
    res.status(500).json({ error: e.message || 'Failed to schedule bulk messages' });
  }
} 