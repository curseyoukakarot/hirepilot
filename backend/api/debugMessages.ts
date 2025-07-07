import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function debugMessages(req: Request, res: Response) {
  try {
    console.log('[debugMessages] Checking messages table structure and data');
    
    // Get user ID
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Try to fetch all messages for this user to see what we get
    const { data: messages, error: messagesError } = await supabaseDb
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('[debugMessages] Messages query result:', { messages, messagesError });

    // Try to get table info (this might not work in Supabase)
    const { data: tableInfo, error: tableError } = await supabaseDb
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public');

    console.log('[debugMessages] Table info result:', { tableInfo, tableError });

    // Get recent email_events
    const { data: emailEvents, error: eventsError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('[debugMessages] Email events result:', { emailEvents, eventsError });

    res.json({
      messages: messages || [],
      messagesCount: messages?.length || 0,
      messagesError: messagesError?.message || null,
      tableInfo: tableInfo || [],
      tableError: tableError?.message || null,
      emailEvents: emailEvents || [],
      eventsCount: emailEvents?.length || 0,
      eventsError: eventsError?.message || null
    });

  } catch (error: any) {
    console.error('[debugMessages] Error:', error);
    res.status(500).json({ error: error.message });
  }
} 