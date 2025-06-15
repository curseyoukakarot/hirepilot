import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const checkSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
});

// POST /api/linkedin/check-cookie
router.post('/check-cookie', async (req: Request, res: Response) => {
  try {
    const { user_id } = checkSchema.parse(req.body);
    const { data, error } = await supabase
      .from('linkedin_cookies')
      .select('session_cookie')
      .eq('user_id', user_id)
      .single();
    if (error || !data?.session_cookie) {
      return res.json({ exists: false });
    }
    res.json({ exists: true });
  } catch (error: any) {
    console.error('LinkedIn check-cookie error:', error);
    res.status(400).json({ exists: false, error: error.message || 'Failed to check LinkedIn session cookie' });
  }
});

export default router; 