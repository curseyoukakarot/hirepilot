import express from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { z } from 'zod';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1) Validate key & return senders
router.post('/validate', async (req, res) => {
  const body = z.object({ apiKey: z.string().min(10) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Bad payload' });

  try {
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${body.data.apiKey}` },
    });
    const { data } = await sg.get('/verified_senders');
    res.json({ senders: data.results });
  } catch (err: any) {
    console.error(err.response?.data ?? err);
    res.status(400).json({ error: 'Invalid key or network trouble' });
  }
});

// 2) Save key + default sender (first-time connect)
router.post('/save', async (req, res) => {
  try {
    const { user_id, api_key, default_sender } = req.body;
    if (!user_id || !api_key || !default_sender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { error } = await supabase
      .from('user_sendgrid_keys')
      .upsert({
        user_id,
        api_key,
        default_sender,
        connected_at: new Date().toISOString()
      });
    if (error) {
      console.error('Error saving SendGrid configuration:', error);
      return res.status(500).json({ error: 'Failed to save SendGrid configuration' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error in sendgrid/save:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3) List senders again later
router.post('/get-senders', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  try {
    const { data: keyRow, error: keyError } = await supabase
      .from('user_sendgrid_keys')
      .select('api_key, default_sender')
      .eq('user_id', user_id)
      .single();
    if (keyError || !keyRow?.api_key) return res.status(400).json({ error: 'No SendGrid API key found' });
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${keyRow.api_key}` },
    });
    const { data } = await sg.get('/verified_senders');
    res.json({ senders: data.results, current_sender: keyRow.default_sender });
  } catch (err) {
    const error = err as any;
    console.error('get-senders error:', error.response?.data ?? error);
    res.status(400).json({ error: 'Failed to fetch senders' });
  }
});

// 4) Change default sender without disconnecting
router.patch('/sender', async (req, res) => {
  const { user_id, default_sender } = req.body;
  if (!user_id || !default_sender) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const { error } = await supabase
      .from('user_sendgrid_keys')
      .update({ default_sender })
      .eq('user_id', user_id);
    if (error) {
      console.error('update-sender error:', error);
      return res.status(500).json({ error: 'Failed to update sender' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('update-sender error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 