import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getSendersSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
});

// POST /api/sendgrid/get-senders
router.post('/get-senders', async (req: Request, res: Response) => {
  try {
    const { user_id } = getSendersSchema.parse(req.body);
    // Fetch the user's SendGrid API key from Supabase
    const { data, error } = await supabase
      .from('sendgrid_configs')
      .select('api_key, default_sender')
      .eq('user_id', user_id)
      .single();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'SendGrid configuration not found' });
      return;
    }
    // Fetch verified senders from SendGrid
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${data.api_key}` },
    });
    const response = await sg.get('/verified_senders');
    const senders = response.data.results || [];
    res.json({ senders, current_sender: data.default_sender });
  } catch (error: any) {
    console.error('SendGrid get-senders error:', error.response?.data ?? error);
    res.status(400).json({ error: error.message || 'Failed to fetch senders' });
  }
});

export default router; 