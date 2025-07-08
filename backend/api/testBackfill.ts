import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function testBackfill(req: Request, res: Response) {
  try {
    // Check messages that should be updated
    const { data: messagesToUpdate, error: checkError } = await supabaseDb
      .from('messages')
      .select('id, sender, avatar, time, preview, status, sent_at, created_at, content, subject, to_email, recipient')
      .or('sender.is.null,avatar.is.null,time.is.null,preview.is.null')
      .in('status', ['sent', 'draft', 'trash'])
      .limit(10);

    console.log('[testBackfill] Messages to update:', messagesToUpdate);

    if (checkError) {
      console.error('[testBackfill] Check error:', checkError);
      return res.json({ error: checkError.message, messagesToUpdate: [] });
    }

    // Try updating one message manually to test
    if (messagesToUpdate && messagesToUpdate.length > 0) {
      const testMessage = messagesToUpdate[0];
      
      // Create proper preview and time
      const preview = testMessage.content ? 
        testMessage.content.replace(/<[^>]+>/g, '').slice(0, 100) : 
        (testMessage.subject || 'No preview');
      
      const time = testMessage.sent_at ? 
        new Date(testMessage.sent_at).toLocaleTimeString() : 
        new Date(testMessage.created_at).toLocaleTimeString();
      
      const { data: updateResult, error: updateError } = await supabaseDb
        .from('messages')
        .update({
          sender: 'You',
          avatar: 'https://ui-avatars.com/api/?name=You&background=random',
          preview: preview,
          time: time,
          read: true,
          unread: false,
          recipient: testMessage.to_email || testMessage.recipient,
          updated_at: new Date().toISOString()
        })
        .eq('id', testMessage.id)
        .select();

      console.log('[testBackfill] Update result:', updateResult);
      console.log('[testBackfill] Update error:', updateError);

      // Try to run a bulk update for all messages that need it
      const { data: bulkUpdate, error: bulkError } = await supabaseDb
        .from('messages')
        .update({
          sender: 'You',
          avatar: 'https://ui-avatars.com/api/?name=You&background=random',
          read: true,
          unread: false,
          updated_at: new Date().toISOString()
        })
        .or('sender.is.null,avatar.is.null,time.is.null,preview.is.null')
        .in('status', ['sent', 'draft', 'trash'])
        .select();

      return res.json({
        messagesToUpdate: messagesToUpdate,
        testUpdate: {
          result: updateResult,
          error: updateError?.message || null
        },
        bulkUpdate: {
          result: bulkUpdate,
          error: bulkError?.message || null,
          count: bulkUpdate?.length || 0
        }
      });
    }

    res.json({
      messagesToUpdate: messagesToUpdate || [],
      message: 'No messages found to update'
    });

  } catch (error: any) {
    console.error('[testBackfill] Error:', error);
    res.status(500).json({ error: error.message });
  }
} 