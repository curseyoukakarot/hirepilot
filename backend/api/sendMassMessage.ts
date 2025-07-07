import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../services/emailProviderService';
import { personalizeMessage } from '../utils/messageUtils';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('[sendMassMessage] Processing request with body:', JSON.stringify(req.body, null, 2));

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

      // Only insert into messages table if sendEmail didn't already do it
      // (the new sendEmail function inserts successful sends into messages table)
      if (!sent) {
        await supabase.from('messages').insert({
          lead_id,
          user_id: uid,
          template_id: tId,
          channel: ch || null,
          content,
          status: 'failed',
        });
      }

      results.push({ 
        lead_id, 
        status: sent ? 'sent' : 'failed',
        email: lead.email,
        error: sent ? null : 'Failed to send email - check email provider configuration'
      });
    }

    const response = {
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    };
    
    console.log('[sendMassMessage] Sending response:', response);
    res.json(response);
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

      // Only insert into messages table if sendEmail didn't already do it
      if (!sent) {
        await supabase.from('messages').insert({
          lead_id: lead.id,
          user_id,
          template_id,
          channel,
          content: personalizedMessage,
          status: 'failed',
        });
      }

      results.push({ 
        lead_id: lead.id, 
        status: sent ? 'sent' : 'failed',
        email: lead.email,
        error: sent ? null : 'Failed to send email - check email provider configuration'
      });
    }

    const response = {
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      details: results,
    };
    
    console.log('[sendMassMessage] Legacy payload - Sending response:', response);
    res.json(response);
  } catch (error: any) {
    console.error('Error in sendMassMessage:', error);
    res.status(500).json({ error: 'Failed to send mass message' });
    return;
  }
}
