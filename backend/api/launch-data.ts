import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import createHttpError from 'http-errors';

const router = Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

router.get('/:id/launch-data', async (req, res) => {
  const { id } = req.params;

  const { data: campaign, error: cErr } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, lead_source_type, lead_source_payload')
    .eq('id', id)
    .single();
  if (cErr) throw createHttpError(500, cErr.message);

  const { data: settings, error: sErr } = await supabaseAdmin
    .from('user_settings')
    .select('linkedin_cookie')
    .eq('user_id', campaign.user_id)
    .single();
  if (sErr) throw createHttpError(500, sErr.message);

  console.log('[launch-data] campaign:', campaign);
  console.log('[launch-data] linkedin_cookie:', settings.linkedin_cookie);

  res.json({
    campaign,
    integrations: { linkedin_cookie: settings.linkedin_cookie },
  });
});

export default router; 