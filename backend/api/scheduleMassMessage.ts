import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import { createZapEvent, EVENT_TYPES } from '../src/lib/events';

export default async function scheduleMassMessage(req: Request, res: Response) {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    // Store scheduled messages in the database
    const scheduledMessages = messages.map(msg => ({
      user_id: msg.user_id,
      lead_id: msg.lead_id,
      content: msg.content,
      template_id: msg.template_id,
      channel: msg.channel,
      scheduled_for: msg.scheduled_for,
      status: 'scheduled',
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabaseDb
      .from('scheduled_messages')
      .insert(scheduledMessages)
      .select();

    if (error) {
      console.error('Error scheduling messages:', error);
      res.status(500).json({ error: 'Failed to schedule messages' });
      return;
    }

    console.log(`✅ Scheduled ${data.length} messages`);
    // Emit automation event
    try {
      // Derive user id from first message if present
      const uid = Array.isArray(messages) && messages[0]?.user_id ? String(messages[0].user_id) : undefined;
      if (uid) {
        await createZapEvent({
          event_type: EVENT_TYPES.message_batch_scheduled,
          user_id: uid,
          entity: 'message_batch',
          entity_id: undefined,
          payload: { count: data.length }
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      scheduled: data.length,
      message: `Successfully scheduled ${data.length} messages`
    });

  } catch (error) {
    console.error('Error in scheduleMassMessage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 