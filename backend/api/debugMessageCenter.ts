import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function debugMessageCenter(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.json({ error: 'user_id query parameter required' });
    }

    // Test the exact same query the Message Center uses
    const { data: sentMessages, error: sentError } = await supabaseDb
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(10);

    const { data: draftMessages, error: draftError } = await supabaseDb
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('sent_at', { ascending: false })
      .limit(10);

    const { data: allUserMessages, error: allError } = await supabaseDb
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Check what email_events exist for this user
    const { data: emailEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('[debugMessageCenter] Results for user:', userId, {
      sentMessages: sentMessages?.length || 0,
      draftMessages: draftMessages?.length || 0,
      allUserMessages: allUserMessages?.length || 0,
      emailEvents: emailEvents?.length || 0
    });

    return res.json({
      userId,
      sentMessages: {
        data: sentMessages || [],
        error: sentError?.message || null,
        count: sentMessages?.length || 0
      },
      draftMessages: {
        data: draftMessages || [],
        error: draftError?.message || null,
        count: draftMessages?.length || 0
      },
      allUserMessages: {
        data: allUserMessages || [],
        error: allError?.message || null,
        count: allUserMessages?.length || 0
      },
      emailEvents: {
        data: emailEvents || [],
        error: eventsError?.message || null,
        count: emailEvents?.length || 0
      }
    });

  } catch (error: any) {
    console.error('[debugMessageCenter] Error:', error);
    res.status(500).json({ error: error.message });
  }
} 