import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function debugMessages(req: Request, res: Response) {
  try {
    console.log('[debugMessages] Checking messages table structure and data');
    
    // For debugging - get user ID from query param or use any recent user
    const userId = req.query.user_id as string;

    // Try to fetch all messages (with or without user filter)
    let messagesQuery = supabaseDb
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (userId) {
      messagesQuery = messagesQuery.eq('user_id', userId);
    }
    
    const { data: messages, error: messagesError } = await messagesQuery;

    console.log('[debugMessages] Messages query result:', { messages, messagesError });

    // Try to get table info (this might not work in Supabase)
    const { data: tableInfo, error: tableError } = await supabaseDb
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public');

    console.log('[debugMessages] Table info result:', { tableInfo, tableError });

    // Get recent email_events
    let eventsQuery = supabaseDb
      .from('email_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (userId) {
      eventsQuery = eventsQuery.eq('user_id', userId);
    }
    
    const { data: emailEvents, error: eventsError } = await eventsQuery;

    console.log('[debugMessages] Email events result:', { emailEvents, eventsError });

    res.json({
      debug: {
        userId: userId || 'no user filter',
        timestamp: new Date().toISOString()
      },
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