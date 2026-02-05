import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authMiddleware';
import { jobseekerAgentQueue } from '../queues/redis';
import {
  createRun,
  getRun,
  listRuns,
  listRunItems,
  fetchCloudEngineSettings,
  upsertCloudEngineSettings
} from '../services/jobseekerAgent/db';
import { getProvider } from '../services/sniperV1/providers';
import { getUserLinkedinAuth } from '../services/sniperV1/linkedinAuth';

type ApiRequest = Request & { user?: { id: string } };

function getUserId(req: ApiRequest): string | null {
  const uid = (req as any)?.user?.id || (req.headers['x-user-id'] as string | undefined);
  return uid ? String(uid) : null;
}

function getWorkspaceId(userId: string): string {
  // Job seeker portal is single-user scoped; use userId as workspace id.
  return userId;
}

export const jobseekerAgentRouter = Router();
jobseekerAgentRouter.use(requireAuth as any);

// ---------------- Runs ----------------
jobseekerAgentRouter.post('/agent/runs', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(userId);

    const schema = z.object({
      search_url: z.string().url(),
      job_limit: z.number().int().min(1).max(2000).optional(),
      priority: z.enum(['standard', 'high', 'urgent']).optional(),
      context: z.string().max(4000).optional(),
      schedule_enabled: z.boolean().optional(),
      schedule_cron: z.string().optional(),
      next_run_at: z.string().datetime().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const run = await createRun({
      user_id: userId,
      workspace_id: workspaceId,
      status: 'queued',
      search_url: parsed.data.search_url,
      job_limit: parsed.data.job_limit ?? 100,
      priority: parsed.data.priority ?? 'standard',
      context: parsed.data.context ?? null,
      schedule_enabled: Boolean(parsed.data.schedule_enabled),
      schedule_cron: parsed.data.schedule_cron ?? null,
      next_run_at: parsed.data.next_run_at ?? null,
      progress_json: {},
      stats_json: {}
    });

    await jobseekerAgentQueue.add('jobseeker_agent_run', { runId: run.id });
    return res.status(202).json({ queued: true, run });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_create_run' });
  }
});

jobseekerAgentRouter.get('/agent/runs', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const runs = await listRuns(userId, { status, limit });
    return res.json(runs);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_runs' });
  }
});

jobseekerAgentRouter.get('/agent/runs/:id', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const run = await getRun(String(req.params.id || ''));
    if (!run || run.user_id !== userId) return res.status(404).json({ error: 'not_found' });
    return res.json(run);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_get_run' });
  }
});

jobseekerAgentRouter.get('/agent/runs/:id/items', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const run = await getRun(String(req.params.id || ''));
    if (!run || run.user_id !== userId) return res.status(404).json({ error: 'not_found' });
    const type = req.query.type ? String(req.query.type) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await listRunItems(run.id, { type, limit });
    return res.json(items);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_list_items' });
  }
});

// ---------------- Cloud Engine Settings ----------------
jobseekerAgentRouter.get('/settings/cloud-engine', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(userId);
    const settings = await fetchCloudEngineSettings(userId, workspaceId);
    const auth = await getUserLinkedinAuth(userId, workspaceId).catch(() => null);
    const connected = Boolean(auth?.status === 'ok' && auth?.airtop_profile_id);
    return res.json({
      settings,
      connected,
      profile_id: auth?.airtop_profile_id || settings.airtop_profile_id || null
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_get_settings' });
  }
});

jobseekerAgentRouter.patch('/settings/cloud-engine', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(userId);

    const schema = z.object({
      daily_job_page_limit: z.number().int().min(1).max(5000).optional(),
      daily_profile_limit: z.number().int().min(1).max(5000).optional(),
      max_concurrency: z.number().int().min(1).max(5).optional(),
      cooldown_minutes: z.number().int().min(5).max(720).optional(),
      notify_email: z.boolean().optional(),
      notify_inapp: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await upsertCloudEngineSettings(userId, workspaceId, parsed.data as any);
    return res.json({ settings });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_update_settings' });
  }
});

jobseekerAgentRouter.post('/settings/cloud-engine/connect', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(userId);

    const schema = z.object({ auth_session_id: z.string().uuid().optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = getProvider('airtop');
    if (parsed.data.auth_session_id) {
      if (!provider.completeLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });
      const out = await provider.completeLinkedInAuth({
        userId,
        workspaceId,
        authSessionId: parsed.data.auth_session_id
      });
      await upsertCloudEngineSettings(userId, workspaceId, {
        airtop_profile_id: out.airtop_profile_id,
        status: 'ok',
        connected_at: new Date().toISOString()
      } as any);
      return res.json(out);
    }

    if (!provider.startLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });
    const out = await provider.startLinkedInAuth({ userId, workspaceId });
    await upsertCloudEngineSettings(userId, workspaceId, {
      airtop_profile_id: out.airtop_profile_id,
      status: 'needs_reauth'
    } as any);
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
    return res.status(500).json({ error: msg || 'failed_to_connect' });
  }
});

export default jobseekerAgentRouter;
