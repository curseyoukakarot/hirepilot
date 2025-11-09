import express from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { LifecycleEventKey } from '../lib/emailEvents';
import { handleLifecycleEvent } from '../workers/featureTriggers';
import { supabase } from '../lib/supabase';

const router = express.Router();

const featureKeyMap: Record<string, LifecycleEventKey> = {
  deals: LifecycleEventKey.Deals,
  rex: LifecycleEventKey.REX,
  rex_agent: LifecycleEventKey.REX,
  workflows: LifecycleEventKey.Workflows,
  campaign_wizard: LifecycleEventKey.CampaignWizard,
  integrations: LifecycleEventKey.Integrations,
  founder: LifecycleEventKey.Founder,
};

// POST /api/events/feature-first-use { feature: 'deals'|'rex'|'workflows'|'campaign_wizard'|'integrations' }
router.post('/events/feature-first-use', requireAuth as any, async (req: any, res) => {
  try {
    const userId = req.user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' }); return;
    }
    const raw = String(req.body?.feature || '').toLowerCase().trim();
    const eventKey = featureKeyMap[raw];
    if (!eventKey) {
      res.status(400).json({ error: 'invalid_feature' }); return;
    }
    // Resolve user email + first name tokens
    const { data: userRow } = await supabase
      .from('users')
      .select('email, firstName, first_name')
      .eq('id', userId)
      .maybeSingle();
    const to = (userRow as any)?.email;
    if (!to) {
      res.status(400).json({ error: 'missing_user_email' }); return;
    }
    const firstName = (userRow as any)?.first_name || (userRow as any)?.firstName || 'there';
    const APP_URL = process.env.APP_URL || 'https://thehirepilot.com';
    const BLOG_URL = process.env.BLOG_URL || 'https://thehirepilot.com/blog';
    const tokens = { first_name: firstName, app_url: APP_URL, cta_url: APP_URL, article_url: BLOG_URL };
    const result = await handleLifecycleEvent({ userId, to, eventKey, tokens });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

export default router;


