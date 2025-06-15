import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const updateSenderSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  default_sender: z.string().min(1, 'Default sender is required'),
});

// POST /api/sendgrid/update-sender
router.post('/update-sender', async (req: Request, res: Response) => {
  try {
    const { user_id, default_sender } = updateSenderSchema.parse(req.body);
    // Update the default sender in Supabase
    const { error } = await supabase
      .from('sendgrid_configs')
      .update({ default_sender })
      .eq('user_id', user_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error('SendGrid update-sender error:', error);
    res.status(400).json({ error: error.message || 'Failed to update default sender' });
  }
});

export default router; 