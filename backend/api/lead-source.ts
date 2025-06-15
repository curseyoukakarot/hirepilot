import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import createHttpError from 'http-errors';

const router = Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.post('/lead-source', async (req, res) => {
  const { campaign_id, lead_source_type, payload } = req.body;
  console.log('[saveLeadSource] body ➜', req.body);

  const { data, error }: { data: any; error: any } = await supabaseAdmin
    .from('campaigns')
    .update({
      lead_source_type,
      lead_source_payload: payload,
    })
    .eq('id', campaign_id)
    .select('*')
    .throwOnError();

  if (error) throw createHttpError(500, error && 'message' in error ? error.message : String(error));
  console.log('[saveLeadSource] after update ➜', data[0]);
  res.json(data[0]);
});

export default router; 