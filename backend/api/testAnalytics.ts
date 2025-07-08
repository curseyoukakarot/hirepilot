import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function testAnalytics(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    
    if (!userId) {
      return res.json({ error: 'user_id query parameter required' });
    }

    // Insert a test analytics event
    const messageId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { data: testEvent, error: insertError } = await supabaseDb
      .from('email_events')
      .insert({
        user_id: userId,
        message_id: messageId,
        event_type: 'sent',
        provider: 'test',
        event_timestamp: new Date().toISOString(),
        metadata: {
          subject: 'Test Analytics Event',
          source: 'test_endpoint',
          to_email: 'test@example.com'
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('[testAnalytics] Insert error:', insertError);
      return res.json({ 
        success: false, 
        error: insertError.message,
        insertError
      });
    }

    // Fetch recent analytics events for this user
    const { data: recentEvents, error: fetchError } = await supabaseDb
      .from('email_events')
      .select('*')
      .eq('user_id', userId)
      .order('event_timestamp', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('[testAnalytics] Fetch error:', fetchError);
      return res.json({ 
        success: false, 
        error: fetchError.message,
        fetchError
      });
    }

    return res.json({
      success: true,
      testEvent,
      recentEvents,
      message: 'Analytics test completed successfully'
    });

  } catch (error: any) {
    console.error('[testAnalytics] Error:', error);
    res.status(500).json({ error: error.message });
  }
} 