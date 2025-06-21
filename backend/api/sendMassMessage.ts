import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailProviderService';
import { personalizeMessage } from '../utils/messageUtils';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Two payload shapes are supported:
  // 1) Legacy: { lead_ids, template_id, custom_content, channel, user_id }
  // 2) New: { messages: [{ lead_id, user_id, content, template_id, channel }] }

  const { messages } = req.body as any;

  if (Array.isArray(messages) && messages.length) {
    // NEW PAYLOAD ----------------------------------------------
    const results: any[] = [];

    for (const msg of messages) {
      const { lead_id, user_id: uid, content, template_id: tId, channel: ch } = msg;
      if (!lead_id || !uid || !content) {
        results.push({ lead_id, status: 'failed', error: 'missing_fields' });
        continue;
      }

      // Fetch lead restricted to owner
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .eq('user_id', uid)
        .single();

      if (leadError || !lead) {
        results.push({ lead_id, status: 'failed', error: 'lead_not_found' });
        continue;
      }

      const sent = await sendEmail(lead, content, uid);

      await supabase.from('messages').insert({
        lead_id,
        user_id: uid,
        template_id: tId,
        channel: ch || null,
        content,
        status: sent ? 'sent' : 'failed',
      });

      results.push({ lead_id, status: sent ? 'sent' : 'failed' });
    }

    res.json({
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    });
    return;
  }

  // LEGACY PAYLOAD ----------------------------------------------
  const { lead_ids, template_id, custom_content, channel, user_id } = req.body;

  if (!lead_ids || !template_id || !custom_content || !channel || !user_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Fetch leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .in('id', lead_ids);

    if (leadsError) throw leadsError;

    // Get template content if provided
    let templateContent = custom_content;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('content')
        .eq('id', template_id)
        .single();

      if (templateError) throw templateError;
      templateContent = template.content;
    }

    const results = [];

    for (const lead of leads) {
      const personalizedMessage = personalizeMessage(templateContent, lead);

      const sent = await sendEmail(lead, personalizedMessage, user_id);

      await supabase.from('messages').insert({
        lead_id: lead.id,
        user_id,
        template_id,
        channel,
        content: personalizedMessage,
        status: sent ? 'sent' : 'failed',
      });

      results.push({ lead_id: lead.id, status: sent ? 'sent' : 'failed' });
    }

    res.json({
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    });
  } catch (error: any) {
    console.error('Error in sendMassMessage:', error);
    res.status(500).json({ error: 'Failed to send mass message' });
    return;
  }
}
