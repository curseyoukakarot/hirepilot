import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import { sniperV1Queue } from '../queues/redis';
import {
  createJob,
  createTarget,
  getJob,
  getTarget,
  insertJobItems,
  listJobItems,
  listJobs,
  listTargets,
  setTargetStatus
} from '../services/sniperV1/db';
import { fetchSniperV1Settings, upsertSniperV1Settings } from '../services/sniperV1/settings';
import { getProvider } from '../services/sniperV1/providers';
import { getUserLinkedinAuth } from '../services/sniperV1/linkedinAuth';

type ApiRequest = Request & { user?: { id: string }; teamId?: string };

function getUserId(req: ApiRequest): string | null {
  const uid = (req as any)?.user?.id || (req.headers['x-user-id'] as string | undefined);
  return uid ? String(uid) : null;
}

function getWorkspaceId(req: ApiRequest, userId: string): string {
  const teamId = (req as any).teamId;
  return teamId ? String(teamId) : userId;
}

export const sniperV1Router = Router();
sniperV1Router.use(requireAuth as any);

// ---------------- Targets ----------------
sniperV1Router.post('/targets', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({
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
      const settings = await fetchSniperV1Settings(workspaceId);
      const provider = (parsed.data.provider || settings.provider_preference) as any;
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
    return res.json({ targets });
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

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (parsed.data.provider || settings.provider_preference) as any;
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

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (parsed.data.provider || settings.provider_preference) as any;

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
    return res.json({ jobs });
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
    return res.json({ items });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_items' });
  }
});

// ---------------- Convenience actions ----------------
sniperV1Router.post('/actions/connect', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      profile_urls: z.array(z.string().url()).min(1).max(500),
      note: z.string().max(300).optional().nullable(),
      scheduled_for: z.string().datetime().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (parsed.data.provider || settings.provider_preference) as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'send_connect_requests',
      provider,
      input_json: { note: parsed.data.note || null }
    });

    await insertJobItems(
      parsed.data.profile_urls.map((u) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: u,
        action_type: 'connect',
        scheduled_for: parsed.data.scheduled_for || null,
        status: 'queued'
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_connects' });
  }
});

sniperV1Router.post('/actions/message', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      profile_urls: z.array(z.string().url()).min(1).max(500),
      message: z.string().min(1).max(3000),
      scheduled_for: z.string().datetime().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (parsed.data.provider || settings.provider_preference) as any;

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

// ---------------- Settings ----------------
sniperV1Router.get('/settings', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const settings = await fetchSniperV1Settings(workspaceId);
    return res.json(settings);
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
      provider_preference: z.enum(['airtop', 'local_playwright']).optional(),
      max_actions_per_day: z.number().int().min(1).max(5000).optional(),
      max_actions_per_hour: z.number().int().min(1).max(500).optional(),
      min_delay_seconds: z.number().int().min(1).max(600).optional(),
      max_delay_seconds: z.number().int().min(1).max(1800).optional(),
      active_hours_json: z.any().optional(),
      timezone: z.string().optional(),
      safety_mode: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const updated = await upsertSniperV1Settings(workspaceId, { workspace_id: workspaceId, ...parsed.data } as any);
    return res.json({ ok: true, settings: updated });
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

    // Embedded auth is Airtop-only (no user Airtop accounts; platform API key only)
    const provider = getProvider('airtop');
    if (!provider.startLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });

    const out = await provider.startLinkedInAuth({ userId, workspaceId });
    return res.json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_start_auth' });
  }
});

sniperV1Router.post('/linkedin/auth/complete', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const schema = z.object({ auth_session_id: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = getProvider('airtop');
    if (!provider.completeLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });
    const out = await provider.completeLinkedInAuth({ userId, workspaceId, authSessionId: parsed.data.auth_session_id });
    return res.json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_complete_auth' });
  }
});

sniperV1Router.get('/linkedin/auth/status', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    const row = await getUserLinkedinAuth(userId, workspaceId);
    return res.json({
      status: row?.status || 'needs_reauth',
      airtop_profile_id: row?.airtop_profile_id || null,
      airtop_last_auth_at: row?.airtop_last_auth_at || null
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_auth_status' });
  }
});

export default sniperV1Router;


