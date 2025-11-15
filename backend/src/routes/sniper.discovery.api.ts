import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseDb } from '../../lib/supabase';
import { Queue } from 'bullmq';
import { connection } from '../queues/redis';
import { requireAuth } from '../../middleware/authMiddleware';

const router = Router();

const discoveryQueue = new Queue('sniper:discovery', { connection });
const zoominfoQueue = new Queue('sniper:zoominfo_enrich', { connection });
const apolloQueue = new Queue('sniper:apollo_decision_makers', { connection });

type ApiRequest = Request & { user?: { id: string } };

// Helpers
function getUserId(req: ApiRequest): string | null {
  const uid = req.user?.id || (req.headers['x-user-id'] as string | undefined);
  return uid ? String(uid) : null;
}

// POST /api/sniper/runs
router.post('/sniper/runs', requireAuth as any, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const schema = z.object({
      workflow_slug: z.string().min(3),
      params: z.record(z.any())
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const { workflow_slug, params } = parsed.data;

    // Determine platform
    const source_platform =
      (params?.platform as string) ||
      (params?.mode ? 'tiktok' : 'unknown');

    // Insert run
    const { data: run, error: runErr } = await supabaseDb
      .from('sniper_runs')
      .insert({
        user_id: userId,
        workflow_slug,
        source_platform,
        params,
        status: 'queued'
      } as any)
      .select('*')
      .single();
    if (runErr) throw runErr;

    await discoveryQueue.add('discovery', {
      runId: run.id,
      userId,
      workflowSlug: workflow_slug,
      params
    });

    return res.status(202).json({ run_id: run.id, status: 'queued' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue' });
  }
});

// GET /api/sniper/runs/:id
router.get('/sniper/runs/:id', requireAuth as any, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const { data, error } = await supabaseDb
      .from('sniper_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'not_found' });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch' });
  }
});

// GET /api/sniper/runs/:id/results
router.get('/sniper/runs/:id/results', requireAuth as any, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);
    const sourceType = typeof req.query.source_type === 'string' ? req.query.source_type : undefined;
    const limit = Math.min(Number(req.query.limit || '200'), 1000);
    let q = supabaseDb
      .from('sniper_results')
      .select('*')
      .eq('run_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (sourceType) q = q.eq('source_type', sourceType);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ results: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch' });
  }
});

// POST /api/sniper/runs/:id/enrich_decision_makers
router.post('/sniper/runs/:id/enrich_decision_makers', requireAuth as any, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const id = String(req.params.id);

    const schema = z.object({
      company_filters: z.record(z.any()).optional(),
      job_ids: z.array(z.string()).optional(),
      use_zoominfo: z.boolean(),
      max_contacts_per_company: z.number().int().min(1).max(10).default(3)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    const { job_ids, use_zoominfo, max_contacts_per_company } = parsed.data;

    // Get run
    const { data: run, error: runErr } = await supabaseDb
      .from('sniper_runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) return res.status(404).json({ error: 'run_not_found' });

    // Collect companies from job postings in this run
    let r = supabaseDb
      .from('sniper_results')
      .select('id, normalized')
      .eq('run_id', id)
      .eq('user_id', userId)
      .in('source_type', ['indeed_job','zip_job','google_job']);
    if (job_ids?.length) r = r.in('id', job_ids);
    const { data: rows, error: rowsErr } = await r;
    if (rowsErr) throw rowsErr;
    const companies = (rows || [])
      .map((x: any) => ({
        company_name: x?.normalized?.company_name || '',
        company_domain: x?.normalized?.company_domain || null,
        location: x?.normalized?.location || null,
        job_title: x?.normalized?.job_title || null
      }))
      .filter(c => c.company_name);

    // Settings: zoominfo enabled?
    let zoominfoEnabled = false;
    try {
      const { data: zs } = await supabaseDb
        .from('zoominfo_enrichment_settings')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle();
      zoominfoEnabled = !!zs?.enabled;
    } catch {}
    // Explicit request overrides setting (but credits charged per rules in worker)
    if (use_zoominfo) zoominfoEnabled = true;

    let queued = 0;
    for (const c of companies) {
      // ZoomInfo path
      if (zoominfoEnabled) {
        await zoominfoQueue.add('zoominfo_enrich', {
          runId: id,
          userId,
          company_name: c.company_name,
          company_domain: c.company_domain,
          location: c.location,
          job_department: deriveDepartmentFromJobTitle(c.job_title),
          max_contacts: max_contacts_per_company,
          zoominfo_enabled: true
        });
      }
      // Always schedule Apollo fallback
      await apolloQueue.add('apollo_decision_makers', {
        runId: id,
        userId,
        company_name: c.company_name,
        company_domain: c.company_domain,
        contacts: [],
        max_contacts: max_contacts_per_company,
        zoominfo_enabled: zoominfoEnabled
      });
      queued += 1;
    }

    return res.json({ queued_companies: queued, run_id: id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue' });
  }
});

function deriveDepartmentFromJobTitle(title?: string | null): string | null {
  const t = String(title || '').toLowerCase();
  if (!t) return null;
  if (/\bsales|account|revenue|ae\b/.test(t)) return 'Sales';
  if (/\bengineer|developer|devops|sdet|cto|cto\b/.test(t)) return 'Engineering';
  if (/\bproduct\b/.test(t)) return 'Product';
  if (/\bmarketing|growth|demand\b/.test(t)) return 'Marketing';
  if (/\bhr|people|talent\b/.test(t)) return 'HR';
  return null;
}

export default router;


