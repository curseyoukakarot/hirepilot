import express, { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const runSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  campaign_params: z.object({}).passthrough(), // Adjust as needed
});

// POST /api/phantombuster/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { user_id, campaign_params } = runSchema.parse(req.body);
    // Fetch the user's PhantomBuster API key from Supabase
    const { data, error } = await supabase
      .from('phantombuster_configs')
      .select('api_key')
      .eq('user_id', user_id)
      .single();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'PhantomBuster configuration not found' });
    }
    // Launch the Phantom using the user's API key
    const response = await axios.post('https://api.phantombuster.com/api/v2/agents/launch', {
      id: 'YOUR_PHANTOM_ID', // Replace with the correct Phantom ID
      argument: campaign_params,
    }, {
      headers: { 'X-Phantombuster-Key': data.api_key },
    });
    // Set up a webhook for the results
    // This is a placeholder; implement your webhook logic here
    res.json({ success: true, job_id: response.data.id });
  } catch (error: any) {
    console.error('PhantomBuster run error:', error);
    res.status(400).json({ error: error.message || 'Failed to run PhantomBuster job' });
  }
});

export default router; 