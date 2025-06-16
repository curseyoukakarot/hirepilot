import express, { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const validateSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  user_id: z.string().min(1, 'User ID is required'),
});

// POST /api/phantombuster/validate
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { api_key, user_id } = validateSchema.parse(req.body);
    // Validate the PhantomBuster API key by making a test request
    const response = await axios.get('https://api.phantombuster.com/api/v2/agents/launch', {
      headers: { 'X-Phantombuster-Key': api_key },
    });
    if (response.status === 200) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid PhantomBuster API key' });
    }
  } catch (error: any) {
    console.error('PhantomBuster validation error:', error);
    res.status(400).json({ error: error.message || 'Failed to validate PhantomBuster API key' });
  }
});

router.post('/phantombuster/validate', async (req, res) => {
  const { api_key, user_id } = req.body;
  if (!api_key || !user_id) {
    res.status(400).json({ error: 'API key and user_id required' });
    return;
  }

  try {
    // 1. Validate the key by making a test API call
    const response = await axios.get('https://api.phantombuster.com/api/v2/agents/list', {
      headers: { Authorization: `Bearer ${api_key}` }
    });

    if (!response.data) {
      throw new Error('Invalid API key');
    }

    // 2. Store the API key in Supabase
    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert({
        user_id,
        phantom_buster_api_key: api_key,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      throw upsertError;
    }

    // 3. Return success response
    res.json({
      success: true,
      message: 'Phantombuster API key validated and stored successfully'
    });
  } catch (error: any) {
    console.error('Phantombuster validation error:', error);
    res.status(400).json({
      error: error.message || 'Failed to validate Phantombuster API key'
    });
  }
});

export default router; 