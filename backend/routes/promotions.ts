import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { CreditService } from '../services/creditService';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromAuth(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function hasPhCookie(req: express.Request) {
  const cookie = String(req.headers.cookie || '');
  return /hp_ref=ph/.test(cookie) || /hp_ph_promo=1/.test(cookie);
}

// Idempotently grant Product Hunt promo credits (500) once per user
router.post('/grant-ph', async (req, res) => {
  try {
    const user = await getUserFromAuth(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Require PH cookie signal unless explicitly bypassed by header (for admin tools)
    const allowWithoutCookie = req.headers['x-allow-no-ph-cookie'] === '1';
    if (!allowWithoutCookie && !hasPhCookie(req)) {
      return res.status(400).json({ error: 'PH promo not detected' });
    }

    // Check if already granted
    const { data: existing, error: findErr } = await supabase
      .from('credit_usage_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'credit')
      .eq('description', 'ph_promo_2025')
      .maybeSingle();

    if (findErr) {
      console.error('Promo lookup error', findErr);
    }
    if (existing) {
      return res.json({ ok: true, alreadyGranted: true });
    }

    // Log promo credit and add to balance
    const { error: logErr } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: user.id,
        amount: 500,
        type: 'credit',
        source: 'promotion',
        description: 'ph_promo_2025'
      });
    if (logErr) {
      console.error('Promo log error', logErr);
      // continue; not fatal
    }

    const ok = await CreditService.addCredits(user.id, 500);
    if (!ok) return res.status(500).json({ error: 'Failed to add credits' });

    return res.json({ ok: true, granted: 500 });
  } catch (e) {
    console.error('grant-ph error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;


