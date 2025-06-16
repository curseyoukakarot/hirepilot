import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/campaigns/lead-source
router.post('/lead-source', async (req: Request, res: Response) => {
  const { campaign_id, lead_source_type, payload } = req.body;
  console.log('[DEBUG] Incoming payload:', { campaign_id, lead_source_type, payload });
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .update({
        lead_source_type,
        lead_source_payload: payload,
      })
      .eq('id', campaign_id)
      .select('*')
      .throwOnError();
    console.log('[DEBUG] Update result:', { data });
    if (!data || data.length === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.status(200).json({ campaign: data[0] });
  } catch (err: any) {
    console.error('[ERROR] Save Lead Source:', err);
    res.status(500).json({ error: 'Failed to save lead source' });
    return;
  }
});

export default router; 