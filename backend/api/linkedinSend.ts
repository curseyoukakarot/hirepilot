import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkedin_url, message, campaign_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!linkedin_url) {
      return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    // Validate URL format (basic check)
    if (!linkedin_url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
    }

    // Validate message length if provided
    if (message && message.length > 300) {
      return res.status(400).json({ error: 'Message cannot exceed 300 characters' });
    }

    // Check user's daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: dailyCount, error: countError } = await supabase
      .from('linkedin_outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    if (countError) {
      console.error('Error checking daily count:', countError);
      return res.status(500).json({ error: 'Failed to check daily limit' });
    }

    const DAILY_LIMIT = 10;
    if (dailyCount >= DAILY_LIMIT) {
      return res.status(429).json({ 
        error: `Daily limit of ${DAILY_LIMIT} LinkedIn requests reached. Try again tomorrow.` 
      });
    }

    // Check for duplicate LinkedIn URL for this user (to prevent spam)
    const { data: existingRequest, error: duplicateError } = await supabase
      .from('linkedin_outreach_queue')
      .select('id, status')
      .eq('user_id', userId)
      .eq('linkedin_url', linkedin_url)
      .neq('status', 'failed')
      .limit(1);

    if (duplicateError) {
      console.error('Error checking for duplicates:', duplicateError);
      return res.status(500).json({ error: 'Failed to check for duplicate requests' });
    }

    if (existingRequest && existingRequest.length > 0) {
      const status = existingRequest[0].status;
      return res.status(409).json({ 
        error: `LinkedIn request for this profile is already ${status === 'pending' ? 'queued' : 'sent'}` 
      });
    }

    // Insert into queue (schedule immediately by default)
    const scheduledAt = new Date();
    
    const { data: queueItem, error: insertError } = await supabase
      .from('linkedin_outreach_queue')
      .insert({
        user_id: userId,
        campaign_id: campaign_id || null,
        linkedin_url: linkedin_url,
        message: message?.trim() || null,
        scheduled_at: scheduledAt.toISOString(),
        credit_cost: 20, // Default cost for LinkedIn requests
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting LinkedIn request:', insertError);
      return res.status(500).json({ error: 'Failed to queue LinkedIn request' });
    }

    // TODO: Deduct credits from user's account here
    // You might want to implement credit deduction logic similar to other features

    res.status(201).json({
      success: true,
      message: 'LinkedIn request queued successfully',
      queueItem: {
        id: queueItem.id,
        scheduled_at: queueItem.scheduled_at,
        status: queueItem.status
      }
    });

  } catch (error) {
    console.error('LinkedIn send API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 