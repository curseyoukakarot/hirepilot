import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { supabase } from '../lib/supabase';

const router = Router();
const slackWebhook = process.env.SLACK_WEBHOOK_URL!;

router.post('/send', async (req: Request, res: Response) => {
    const { id, message, user } = req.body;

    if (!id || !message || !user) {
      return res.status(400).json({ error: 'Lead ID, message, and user are required' });
    }
    
  try {
    // Simulate send delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update Supabase lead status
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'Messaged' })
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase update error:', error);
      return res.status(500).json({ error: 'Failed to update lead status' });
    }

    // ✅ Send Slack notification
    await axios.post(slackWebhook, {
        text: `📧 ${user} reached out to a lead successfully!`,
      });      

    res.status(200).json({ success: true, message: `Outreach sent to lead ${id}` });
  } catch (error) {
    console.error('❌ Error sending outreach:', error);
    res.status(500).json({ error: 'Failed to send outreach' });
  }
});

export default router;
