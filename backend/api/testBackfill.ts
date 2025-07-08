import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function testBackfill(req: Request, res: Response) {
  try {
    // Check messages that should be updated
    const { data: messagesToUpdate, error: checkError } = await supabaseDb
      .from('messages')
      .select('id, sender, avatar, time, preview, status, sent_at, created_at')
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
      const { data: updateResult, error: updateError } = await supabaseDb
        .from('messages')
        .update({
          sender: 'You',
          avatar: 'https://ui-avatars.com/api/?name=You&background=random',
          preview: 'Test preview',
          time: '12:00:00 PM',
          read: true,
          unread: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', testMessage.id)
        .select();

      console.log('[testBackfill] Update result:', updateResult);
      console.log('[testBackfill] Update error:', updateError);

      return res.json({
        messagesToUpdate: messagesToUpdate,
        testUpdate: {
          result: updateResult,
          error: updateError?.message || null
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