import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import { sniperV1Queue } from '../queues/redis';
import {
  createJob,
  createTarget,
  getJob,
  getLastJobForTarget,
  getTarget,
  countJobItems,
  insertJobItems,
  listJobItems,
  listJobs,
  listTargets,
  setTargetStatus
} from '../services/sniperV1/db';
import { fetchSniperV1Settings, upsertSniperV1Settings } from '../services/sniperV1/settings';
import { getProvider } from '../services/sniperV1/providers';
import { getUserLinkedinAuth } from '../services/sniperV1/linkedinAuth';
import { sniperSupabaseDb } from '../services/sniperV1/supabase';

type ApiRequest = Request & { user?: { id: string }; teamId?: string };

function getUserId(req: ApiRequest): string | null {
  const uid = (req as any)?.user?.id || (req.headers['x-user-id'] as string | undefined);
  return uid ? String(uid) : null;
}

function getWorkspaceId(req: ApiRequest, userId: string): string {
  const teamId = (req as any).teamId;
  return teamId ? String(teamId) : userId;
}

async function requireCloudEngineEnabledOr409(workspaceId: string, res: Response): Promise<boolean> {
  const s = await fetchSniperV1Settings(workspaceId);
  if (!s.cloud_engine_enabled) {
    res.status(409).json({ error: 'Cloud Engine is disabled. Use Chrome Extension.' });
    return false;
  }
  return true;
}

function dayStringInTimezone(now: Date, tz: string): string {
  // Use en-CA for YYYY-MM-DD format.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now); // YYYY-MM-DD
}

export const sniperV1Router = Router();
sniperV1Router.use(requireAuth as any);

// ---------------- Targets ----------------
sniperV1Router.post('/targets', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      type: z.string().optional(),
      post_url: z.string().url(),
      name: z.string().min(1).max(160).optional(),
      auto_run: z.boolean().optional().default(true),
      provider: z.enum(['airtop', 'local_playwright']).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const postUrl = parsed.data.post_url;
    const name = parsed.data.name || `LinkedIn post: ${postUrl.slice(0, 80)}`;

    const target = await createTarget({ workspace_id: workspaceId, created_by: userId, name, post_url: postUrl });

    if (parsed.data.auto_run) {
      const provider = 'airtop' as any;
      const job = await createJob({
        workspace_id: workspaceId,
        created_by: userId,
        target_id: target.id,
        job_type: 'prospect_post_engagers',
        provider,
        input_json: { post_url: postUrl, limit: 200 }
      });
      await sniperV1Queue.add('sniper_v1', { jobId: job.id });
      return res.status(201).json({ target, queued_job_id: job.id });
    }

    return res.status(201).json({ target });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_target' });
  }
});

sniperV1Router.get('/targets', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const targets = await listTargets(workspaceId);
    const enriched = await Promise.all(
      targets.map(async (t) => {
        try {
          const lastJob = await getLastJobForTarget(t.id);
          if (!lastJob) {
            return {
              ...t,
              last_run_status: null,
              last_run_at: null,
              last_run_leads_found: null
            };
          }
          const leadsFound = await countJobItems(lastJob.id);
          return {
            ...t,
            last_run_status: lastJob.status === 'succeeded' ? 'success' : lastJob.status,
            last_run_at: lastJob.finished_at || lastJob.started_at || lastJob.created_at,
            last_run_leads_found: leadsFound
          };
        } catch {
          return {
            ...t,
            last_run_status: null,
            last_run_at: null,
            last_run_leads_found: null
          };
        }
      })
    );
    // Return array for v1 UI
    return res.json(enriched);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_targets' });
  }
});

sniperV1Router.post('/targets/:id/pause', async (req: ApiRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await setTargetStatus(id, 'paused');
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_pause' });
  }
});

sniperV1Router.post('/targets/:id/resume', async (req: ApiRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    await setTargetStatus(id, 'active');
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_resume' });
  }
});

sniperV1Router.post('/targets/:id/run', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const targetId = String(req.params.id);
    const target = await getTarget(targetId);
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (target.workspace_id !== workspaceId) return res.status(403).json({ error: 'forbidden' });
    if (target.status !== 'active') return res.status(409).json({ error: 'target_not_active' });

    const schema = z.object({
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      limit: z.number().int().min(1).max(1000).optional().default(200)
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = 'airtop' as any;
    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: target.id,
      job_type: 'prospect_post_engagers',
      provider,
      input_json: { post_url: target.post_url, limit: parsed.data.limit }
    });
    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_run_target' });
  }
});

// ---------------- Jobs ----------------
sniperV1Router.post('/jobs', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({
      target_id: z.string().uuid().nullable().optional(),
      job_type: z.enum(['prospect_post_engagers', 'send_connect_requests', 'send_messages']),
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      input_json: z.record(z.any()).default({})
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;
    const provider = 'airtop' as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: parsed.data.target_id ?? null,
      job_type: parsed.data.job_type as any,
      provider,
      input_json: parsed.data.input_json
    });

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_job' });
  }
});

sniperV1Router.get('/jobs', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const limit = Math.min(Number(req.query.limit || '50'), 200);
    const jobs = await listJobs(workspaceId, limit);
    return res.json(
      (jobs || []).map((j: any) => ({
        ...j,
        status: j.status === 'succeeded' ? 'success' : j.status
      }))
    );
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_jobs' });
  }
});

sniperV1Router.get('/jobs/:id', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const id = String(req.params.id);
    const job = await getJob(id);
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (job.workspace_id !== workspaceId) return res.status(403).json({ error: 'forbidden' });
    return res.json({ job });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_job' });
  }
});

sniperV1Router.get('/jobs/:id/items', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const id = String(req.params.id);
    const job = await getJob(id);
    if (!job) return res.status(404).json({ error: 'not_found' });
    if (job.workspace_id !== workspaceId) return res.status(403).json({ error: 'forbidden' });

    const limit = Math.min(Number(req.query.limit || '500'), 2000);
    const items = await listJobItems(id, limit);
    return res.json(items || []);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_items' });
  }
});

// ---------------- Convenience actions ----------------
sniperV1Router.get('/bulk_quota', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const DAILY_CONNECT_LIMIT = 20;
    const settings = await fetchSniperV1Settings(workspaceId);
    const tz = settings.timezone || 'UTC';
    const day = dayStringInTimezone(new Date(), tz);

    const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_daily_connects', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_day: day,
      p_delta: 0,
      p_limit: DAILY_CONNECT_LIMIT
    } as any);
    if (error) throw error;
    const row: any = Array.isArray(data) ? data[0] : data;
    const usedToday = Number(row?.used_today || 0);
    const remainingToday = Number(row?.remaining_today || Math.max(0, DAILY_CONNECT_LIMIT - usedToday));
    return res.json({
      limit_per_day: DAILY_CONNECT_LIMIT,
      used_today: usedToday,
      remaining_today: remainingToday,
      day,
      timezone: tz
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_quota' });
  }
});

sniperV1Router.post('/actions/connect', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      profile_urls: z.array(z.string().url()).min(1).max(500).optional(),
      requests: z.array(z.object({
        profile_url: z.string().url(),
        note: z.string().max(300).optional().nullable()
      })).min(1).max(500).optional(),
      note: z.string().max(300).optional().nullable(),
      scheduled_for: z.string().datetime().optional().nullable()
    }).refine((v) => Boolean(v.profile_urls?.length) || Boolean(v.requests?.length), { message: 'profile_urls or requests is required' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = 'airtop' as any;

    const DAILY_CONNECT_LIMIT = 20;

    const requests = (parsed.data.requests || []).map((r) => ({
      profile_url: r.profile_url,
      note: r.note ?? parsed.data.note ?? null
    }));
    const urls = (parsed.data.profile_urls || []).map((u) => ({ profile_url: u, note: parsed.data.note ?? null }));
    const merged = [...requests, ...urls];
    // Deduplicate by URL (keep first note)
    const seen = new Set<string>();
    const unique = merged.filter((r) => {
      const key = String(r.profile_url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Atomic daily quota reservation (per-user). Day boundary uses Sniper timezone (falls back to UTC).
    const settings = await fetchSniperV1Settings(workspaceId);
    const tz = settings.timezone || 'UTC';
    const day = dayStringInTimezone(new Date(), tz);
    try {
      const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_daily_connects', {
        p_user_id: userId,
        p_workspace_id: workspaceId,
        p_day: day,
        p_delta: unique.length,
        p_limit: DAILY_CONNECT_LIMIT
      } as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      const usedToday = Number(row?.used_today || 0);
      const remainingToday = Number(row?.remaining_today || Math.max(0, DAILY_CONNECT_LIMIT - usedToday));
      // include on response later
      (req as any)._sniperQuota = { usedToday, remainingToday, day, tz };
    } catch (e: any) {
      const msg = String(e?.message || '');
      const usedFromDetail = Number(e?.details || e?.detail || 0) || 0;
      if (msg.includes('daily_connect_limit_exceeded')) {
        return res.status(429).json({
          error: 'daily_connect_limit_exceeded',
          limit_per_day: DAILY_CONNECT_LIMIT,
          used_today: usedFromDetail,
          remaining_today: Math.max(0, DAILY_CONNECT_LIMIT - usedFromDetail),
          requested: unique.length
        });
      }
      throw e;
    }

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'send_connect_requests',
      provider,
      input_json: { note: parsed.data.note || null }
    });

    await insertJobItems(
      unique.map((r) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: r.profile_url,
        action_type: 'connect',
        scheduled_for: parsed.data.scheduled_for || null,
        status: 'queued',
        // Store per-item note for personalization; worker will prefer this over job.input_json.note
        result_json: r.note ? { note: r.note } : null
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    const q = (req as any)._sniperQuota || {};
    return res.status(202).json({
      queued: true,
      job_id: job.id,
      quota: {
        limit_per_day: DAILY_CONNECT_LIMIT,
        used_today: q.usedToday,
        remaining_today: q.remainingToday,
        day: q.day,
        timezone: q.tz
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_connects' });
  }
});

sniperV1Router.post('/actions/message', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      profile_urls: z.array(z.string().url()).min(1).max(500),
      message: z.string().min(1).max(3000),
      scheduled_for: z.string().datetime().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = 'airtop' as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'send_messages',
      provider,
      input_json: { message: parsed.data.message }
    });

    await insertJobItems(
      parsed.data.profile_urls.map((u) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: u,
        action_type: 'message',
        scheduled_for: parsed.data.scheduled_for || null,
        status: 'queued'
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_messages' });
  }
});

sniperV1Router.post('/actions/import_to_leads', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const teamId = (req as any).teamId ? String((req as any).teamId) : null;

    // Allowed even when Cloud Engine is OFF (DB-only).
    const schema = z.object({
      profile_urls: z.array(z.string().url()).min(1).max(2000)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    // Normalize + dedupe
    const urls = Array.from(new Set(parsed.data.profile_urls.map((u) => String(u).trim()).filter(Boolean)));
    if (!urls.length) return res.status(400).json({ error: 'no_profile_urls' });

    // Pull best-effort name/headline from latest extract results in this workspace.
    const { data: extracts, error: exErr } = await sniperSupabaseDb
      .from('sniper_job_items')
      .select('profile_url,result_json,created_at')
      .eq('workspace_id', workspaceId)
      .eq('action_type', 'extract')
      .in('profile_url', urls)
      .order('created_at', { ascending: false });
    if (exErr) throw exErr;
    const extractByUrl = new Map<string, any>();
    for (const row of extracts || []) {
      const u = String((row as any).profile_url || '');
      if (!u || extractByUrl.has(u)) continue; // first is newest due to order
      extractByUrl.set(u, (row as any).result_json || null);
    }

    // Fetch existing leads in this workspace scope (team workspace uses account_id, solo uses user_id).
    let q = sniperSupabaseDb.from('leads').select('id, linkedin_url, name, title, user_id, account_id').in('linkedin_url', urls);
    q = teamId ? q.eq('account_id', teamId) : q.eq('user_id', userId);
    const { data: existing, error: existErr } = await q;
    if (existErr) throw existErr;
    const existingByUrl = new Map<string, any>((existing || []).map((r: any) => [String(r.linkedin_url), r]));

    const inserts: any[] = [];
    const updates: Array<{ id: string; patch: any }> = [];

    for (const url of urls) {
      const meta = extractByUrl.get(url);
      const name = meta?.name ? String(meta.name).trim() : '';
      const headline = meta?.headline ? String(meta.headline).trim() : '';

      const found = existingByUrl.get(url);
      if (found) {
        const patch: any = {};
        if (name) patch.name = name;
        if (headline) patch.title = headline;
        if (Object.keys(patch).length) updates.push({ id: String(found.id), patch });
        continue;
      }

      inserts.push({
        user_id: userId,
        account_id: teamId,
        linkedin_url: url,
        name: name || url,
        title: headline || null,
        source: 'Sniper',
        enrichment_source: 'linkedin',
        enrichment_data: { source: 'sniper', name: name || null, headline: headline || null },
        status: 'New',
        created_at: new Date().toISOString()
      });
    }

    let inserted = 0;
    let updated = 0;

    if (inserts.length) {
      const { data: ins, error: insErr } = await sniperSupabaseDb.from('leads').insert(inserts as any).select('id');
      if (insErr) throw insErr;
      inserted = Array.isArray(ins) ? ins.length : 0;
    }

    for (const u of updates) {
      const { error: upErr } = await sniperSupabaseDb.from('leads').update(u.patch).eq('id', u.id);
      if (upErr) throw upErr;
      updated += 1;
    }

    return res.json({ inserted, updated });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_import_to_leads' });
  }
});

// ---------------- Settings ----------------
sniperV1Router.get('/settings', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const s = await fetchSniperV1Settings(workspaceId);
    return res.json({
      cloud_engine_enabled: Boolean(s.cloud_engine_enabled),
      provider: (s.cloud_engine_enabled ? 'airtop' : 'extension_only'),
      max_actions_per_day: s.max_actions_per_day,
      max_actions_per_hour: s.max_actions_per_hour,
      min_delay_seconds: s.min_delay_seconds,
      max_delay_seconds: s.max_delay_seconds,
      active_hours_start: String(s.active_hours_json?.start || '09:00'),
      active_hours_end: String(s.active_hours_json?.end || '17:00'),
      timezone: s.timezone,
      safety_mode: Boolean(s.safety_mode)
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_settings' });
  }
});

sniperV1Router.put('/settings', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({
      cloud_engine_enabled: z.boolean(),
      provider: z.enum(['airtop', 'extension_only']),
      max_actions_per_day: z.number().int().min(1).max(5000),
      max_actions_per_hour: z.number().int().min(1).max(500),
      min_delay_seconds: z.number().int().min(1).max(600),
      max_delay_seconds: z.number().int().min(1).max(1800),
      active_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
      active_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().min(1),
      safety_mode: z.boolean()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const existing = await fetchSniperV1Settings(workspaceId);

    const cloudEnabled = Boolean(parsed.data.cloud_engine_enabled);
    const patch: any = {
      workspace_id: workspaceId,
      cloud_engine_enabled: cloudEnabled,
      provider: cloudEnabled ? 'airtop' : 'extension_only',
      // v1 execution provider_preference is forced to airtop when cloud is enabled
      provider_preference: cloudEnabled ? 'airtop' : existing.provider_preference,
      max_actions_per_day: parsed.data.max_actions_per_day,
      max_actions_per_hour: parsed.data.max_actions_per_hour,
      min_delay_seconds: parsed.data.min_delay_seconds,
      max_delay_seconds: parsed.data.max_delay_seconds,
      timezone: parsed.data.timezone,
      safety_mode: parsed.data.safety_mode,
      active_hours_json: {
        days: existing.active_hours_json?.days || [1, 2, 3, 4, 5],
        start: parsed.data.active_hours_start,
        end: parsed.data.active_hours_end,
        runOnWeekends: Boolean(existing.active_hours_json?.runOnWeekends)
      }
    };

    await upsertSniperV1Settings(workspaceId, patch);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_settings' });
  }
});

// ---------------- Airtop LinkedIn auth (embedded live view) ----------------
sniperV1Router.post('/linkedin/auth/start', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const settings = await fetchSniperV1Settings(workspaceId);
    if (!settings.cloud_engine_enabled) {
      return res.status(409).json({ error: 'Cloud Engine is disabled. Use Chrome Extension.' });
    }

    // Embedded auth is Airtop-only (no user Airtop accounts; platform API key only)
    const provider = getProvider('airtop');
    if (!provider.startLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });

    const out = await provider.startLinkedInAuth({ userId, workspaceId });
    return res.json({ url: out.live_view_url, auth_session_id: out.auth_session_id, profile_id: out.airtop_profile_id });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('AIRTOP provider disabled')) {
      return res.status(503).json({
        error: 'AIRTOP provider disabled',
        hint: 'Set AIRTOP_PROVIDER_ENABLED=true and AIRTOP_API_KEY on the API service.'
      });
    }
    if (msg.includes('AIRTOP_API_KEY missing')) {
      return res.status(503).json({
        error: 'AIRTOP_API_KEY missing',
        hint: 'Set AIRTOP_API_KEY on the API service.'
      });
    }
    return res.status(500).json({ error: msg || 'failed_to_start_auth' });
  }
});

sniperV1Router.post('/linkedin/auth/complete', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const settings = await fetchSniperV1Settings(workspaceId);
    if (!settings.cloud_engine_enabled) {
      return res.status(409).json({ error: 'Cloud Engine is disabled. Use Chrome Extension.' });
    }

    const schema = z.object({ auth_session_id: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = getProvider('airtop');
    if (!provider.completeLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });
    const out = await provider.completeLinkedInAuth({ userId, workspaceId, authSessionId: parsed.data.auth_session_id });
    return res.json(out);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('AIRTOP provider disabled')) {
      return res.status(503).json({
        error: 'AIRTOP provider disabled',
        hint: 'Set AIRTOP_PROVIDER_ENABLED=true and AIRTOP_API_KEY on the API service.'
      });
    }
    if (msg.includes('AIRTOP_API_KEY missing')) {
      return res.status(503).json({
        error: 'AIRTOP_API_KEY missing',
        hint: 'Set AIRTOP_API_KEY on the API service.'
      });
    }
    return res.status(500).json({ error: msg || 'failed_to_complete_auth' });
  }
});

sniperV1Router.get('/linkedin/auth/status', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const row = await getUserLinkedinAuth(userId, workspaceId);
    const connected = Boolean(row?.status === 'ok' && row?.airtop_profile_id);
    return res.json({
      connected,
      profile_id: row?.airtop_profile_id || null,
      last_checked_at: new Date().toISOString()
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_auth_status' });
  }
});

export default sniperV1Router;


