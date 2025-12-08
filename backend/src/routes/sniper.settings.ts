import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { DEFAULT_SNIPER_SETTINGS } from '../services/sniperSettings';

const router = Router();

function authUser(req: Request): string | null {
  const uid = (req as any)?.user?.id || req.headers['x-user-id'];
  if (!uid) return null;
  return Array.isArray(uid) ? uid[0] : String(uid);
}

// Settings schema (simplified to match example)
const SettingsSchema = z.object({
  globalActive: z.boolean().default(true),
  timezone: z.string().default('America/Chicago'),
  workingHours: z.object({ start: z.string(), end: z.string(), days: z.array(z.number()), runOnWeekends: z.boolean() }),
  warmup: z.object({ enabled: z.boolean(), weeks: z.number(), currentWeek: z.number(), speed: z.number() }),
  sources: z.object({
    linkedin: z.object({
      profileViewsPerDay: z.number(),
      connectionInvitesPerDay: z.number(),
      messagesPerDay: z.number(),
      inMailsPerDay: z.number(),
      concurrency: z.number(),
      actionsPerMinute: z.number()
    })
  }).passthrough(),
  creditBudget: z.object({ dailyMax: z.number() }),
  safety: z.object({ maxTouchesPerPerson: z.number(), doNotContactDomains: z.array(z.string()) }),
  primaryJobBoard: z.enum(['linkedin_jobs', 'ziprecruiter']).default('linkedin_jobs'),
  autoCreateTables: z.boolean().default(false),
  defaultEnrichment: z.enum(['apollo_only', 'apollo_brightdata']).default('apollo_only')
});

// GET /api/sniper/settings
router.get('/sniper/settings', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const accountId = (req.query.accountId as string) || null;
    if (!accountId) {
      // Fallback: try to infer account via users table
      // Keeping simple: return defaults if none provided
      return res.json(DEFAULT_SNIPER_SETTINGS);
    }
    const { data, error } = await supabase
      .from('sniper_settings')
      .select('settings')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    const s = (data as any)?.settings || DEFAULT_SNIPER_SETTINGS;
    return res.json(s);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch' });
  }
});

// PUT /api/sniper/settings
router.put('/sniper/settings', async (req: Request, res: Response) => {
  try {
    const userId = authUser(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const body = z.object({ accountId: z.string(), settings: SettingsSchema }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'invalid_payload', details: body.error.flatten() });
    const { accountId, settings } = body.data;

    // Fetch previous for audit
    const { data: prev } = await supabase
      .from('sniper_settings')
      .select('settings')
      .eq('account_id', accountId)
      .maybeSingle();

    // Upsert
    const upsert = await supabase
      .from('sniper_settings')
      .upsert({ account_id: accountId, user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: 'account_id' })
      .select('id')
      .single();
    if (upsert.error) throw upsert.error;

    // Audit log
    await supabase
      .from('sniper_settings_audit')
      .insert({ account_id: accountId, user_id: userId, before: (prev as any)?.settings || null, after: settings });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update' });
  }
});

export default router;


