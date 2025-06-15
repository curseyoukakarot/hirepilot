import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const saveSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  api_key: z.string().min(1, 'API key is required'),
});

// POST /api/phantombuster/save
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { user_id, api_key } = saveSchema.parse(req.body);
    // Upsert the PhantomBuster API key into Supabase
    const { error } = await supabase
      .from('phantombuster_configs')
      .upsert({ user_id, api_key }, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('PhantomBuster save error:', error);
    res.status(400).json({ error: error.message || 'Failed to save PhantomBuster API key' });
  }
});

export default router; 