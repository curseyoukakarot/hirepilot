import { Router, Request, Response } from 'express';
import axios from 'axios';
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
  setTargetStatus,
  updateJob,
  updateJobItem
} from '../services/sniperV1/db';
import { fetchSniperV1Settings, upsertSniperV1Settings } from '../services/sniperV1/settings';
import { getProvider } from '../services/sniperV1/providers';
import { getUserLinkedinAuth } from '../services/sniperV1/linkedinAuth';
import { sniperSupabaseDb } from '../services/sniperV1/supabase';
import { invokeAgentWebhook, pollInvocationResult, safeOutputParse } from '../services/airtop/agentWebhooks';
import { canAttemptLinkedinConnect } from '../services/sniperV1/connectThrottle';
import { recordActionUsage } from '../services/sniperV1/throttle';
import { notifyConnectQueued, notifyConnectResult } from '../services/sniperV1/connectNotifications';
import { normalizeLinkedinProfileUrl } from '../utils/linkedinUrl';

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

function requireEnv(name: string): string {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function requireEnvAny(names: string[]): string {
  for (const name of names) {
    const v = String(process.env[name] || '').trim();
    if (v) return v;
  }
  throw new Error(`Missing ${names[0]}`);
}

function normalizeAirtopStatus(raw: string): { ok: boolean; status: string } {
  const s = String(raw || '').toUpperCase();
  if (['SENT', 'ALREADY_PENDING', 'ALREADY_CONNECTED'].includes(s)) {
    return { ok: true, status: s };
  }
  if (s === 'AUTH_REQUIRED') {
    return { ok: false, status: s };
  }
  return { ok: false, status: s || 'FAILED' };
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
      const targetSettings = await fetchSniperV1Settings(workspaceId);
      const provider = (targetSettings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;
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

    const sniperSettings = await fetchSniperV1Settings(workspaceId);
    const provider = (sniperSettings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;
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
      job_type: z.enum(['prospect_post_engagers', 'send_connect_requests', 'send_messages', 'people_search', 'jobs_intent', 'sn_lead_search', 'sn_send_connect', 'sn_send_inmail', 'sn_send_message']),
      provider: z.enum(['airtop', 'local_playwright']).optional(),
      input_json: z.record(z.any()).default({})
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;
    const jobSettings = await fetchSniperV1Settings(workspaceId);
    const provider = (jobSettings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;

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

    const settings = await fetchSniperV1Settings(workspaceId);
    const tz = settings.timezone || 'UTC';
    const day = dayStringInTimezone(new Date(), tz);

    const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_action_usage', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_day: day,
      p_connect_delta: 0,
      p_connect_limit: settings.max_connects_per_day,
      p_workspace_connect_limit: settings.max_workspace_connects_per_day,
      p_message_limit: settings.max_messages_per_day,
      p_workspace_message_limit: settings.max_workspace_messages_per_day,
      p_profile_limit: settings.max_page_interactions_per_day,
      p_workspace_profile_limit: settings.max_workspace_page_interactions_per_day,
      p_job_page_limit: settings.max_page_interactions_per_day,
      p_workspace_job_page_limit: settings.max_workspace_page_interactions_per_day
    } as any);
    if (error) throw error;
    const row: any = Array.isArray(data) ? data[0] : data;
    const usedToday = Number(row?.user_connects || 0);
    const remainingToday = Math.max(0, settings.max_connects_per_day - usedToday);
    return res.json({
      limit_per_day: settings.max_connects_per_day,
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
      profile_urls: z.array(z.string().min(1)).min(1).max(500).optional(),
      requests: z.array(z.object({
        profile_url: z.string().min(1),
        note: z.string().max(300).optional().nullable()
      })).min(1).max(500).optional(),
      note: z.string().max(300).optional().nullable(),
      scheduled_for: z.string().datetime().optional().nullable()
    }).refine((v) => Boolean(v.profile_urls?.length) || Boolean(v.requests?.length), { message: 'profile_urls or requests is required' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const connectSettings = await fetchSniperV1Settings(workspaceId);
    const provider = (connectSettings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;
    const isAgenticBrowser = connectSettings.provider === 'agentic_browser';

    const requests = (parsed.data.requests || []).map((r) => ({
      profile_url: r.profile_url,
      note: r.note ?? parsed.data.note ?? null
    }));
    const urls = (parsed.data.profile_urls || []).map((u) => ({ profile_url: u, note: parsed.data.note ?? null }));
    const merged = [...requests, ...urls];

    // Normalize URLs and deduplicate by normalized URL (invalid URLs are kept for failed-marking)
    const seen = new Set<string>();
    const processed: Array<{ profile_url: string; note: string | null; normalized: string | null }> = [];
    for (const r of merged) {
      const original = String(r.profile_url).trim();
      const normalized = normalizeLinkedinProfileUrl(original);
      const key = normalized ?? original;
      if (seen.has(key)) continue;
      seen.add(key);
      processed.push({ profile_url: original, note: r.note ?? parsed.data.note ?? null, normalized });
    }

    const validCount = processed.filter((p) => p.normalized !== null).length;
    const throttle = await canAttemptLinkedinConnect({ workspaceId, userId, respectActiveHours: false });
    if (!throttle.ok) {
      console.log('[sniper-connect] throttle block', { userId, workspaceId, reason: throttle.reason, cooldownSeconds: throttle.cooldownSeconds });
      return res.status(429).json({
        error: throttle.reason || 'connect_throttled',
        cooldown_seconds: throttle.cooldownSeconds,
        limit_per_day: throttle.limit,
        remaining_today: throttle.remaining,
        requested: validCount
      });
    }
    if (validCount > throttle.remaining) {
      console.log('[sniper-connect] throttle block', { userId, workspaceId, reason: 'daily_connect_limit_exceeded', remaining: throttle.remaining });
      return res.status(429).json({
        error: 'daily_connect_limit_exceeded',
        cooldown_seconds: 60 * 60,
        limit_per_day: throttle.limit,
        remaining_today: throttle.remaining,
        requested: validCount
      });
    }
    (req as any)._sniperQuota = {
      usedToday: Math.max(0, throttle.limit - throttle.remaining),
      remainingToday: throttle.remaining,
      day: dayStringInTimezone(new Date(), throttle.settings.timezone || 'UTC'),
      tz: throttle.settings.timezone || 'UTC'
    };

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'send_connect_requests',
      provider,
      input_json: { note: parsed.data.note || null, execution_mode: isAgenticBrowser ? 'agentic_browser' : 'airtop_webhook' }
    });

    await insertJobItems(
      processed.map((p) => {
        if (p.normalized === null) {
          return {
            job_id: job.id,
            workspace_id: workspaceId,
            profile_url: p.profile_url,
            action_type: 'connect' as const,
            scheduled_for: parsed.data.scheduled_for || null,
            status: 'failed' as const,
            result_json: p.note ? { note: p.note } : null,
            error_code: 'invalid_profile_url',
            error_message: 'Invalid LinkedIn profile URL'
          };
        }
        if (p.profile_url !== p.normalized) {
          console.log('[sniper-connect] LinkedIn profile URL normalized', { original: p.profile_url, normalized: p.normalized });
        }
        return {
          job_id: job.id,
          workspace_id: workspaceId,
          profile_url: p.normalized,
          action_type: 'connect' as const,
          scheduled_for: parsed.data.scheduled_for || null,
          status: 'queued' as const,
          result_json: p.note ? { note: p.note } : null
        };
      })
    );

    const q = (req as any)._sniperQuota || {};
    const shouldQueueOnly = Boolean(throttle.outsideActiveHours);

    // --- Agentic Browser: always queue to BullMQ, skip Airtop webhooks/Zapier ---
    if (isAgenticBrowser) {
      const validItems = processed.filter((p) => p.normalized !== null);
      if (validItems.length === 0) {
        return res.status(400).json({
          error: 'invalid_profile_url',
          message: 'All LinkedIn profile URLs are invalid',
          failed_count: processed.filter((p) => p.normalized === null).length
        });
      }

      await sniperV1Queue.add('sniper_v1', { jobId: job.id });

      await notifyConnectQueued({
        userId,
        workspaceId,
        jobId: job.id,
        totalTargets: validItems.length,
        profileUrl: validItems.length === 1 ? validItems[0].normalized! : null,
        note: (validItems.length === 1 ? validItems[0].note : parsed.data.note) || null,
        estimatedRate: String(throttle.settings.max_actions_per_hour || ''),
        isBulk: validItems.length > 1
      });

      return res.status(202).json({
        queued: true,
        job_id: job.id,
        queued_reason: shouldQueueOnly ? 'outside_active_hours' : undefined,
        queue_source: 'agentic_browser',
        quota: {
          limit_per_day: throttle.settings.max_connects_per_day,
          used_today: q.usedToday,
          remaining_today: q.remainingToday,
          day: q.day,
          timezone: q.tz
        }
      });
    }

    // --- Airtop path: Zapier / single-profile webhook / batch webhook ---
    const zapierWebhookUrl = String(process.env.AIRTOP_ZAPIER_WEBHOOK_URL || '').trim();
    // TEMP: Google Sheets staging for Airtop testing
    if (zapierWebhookUrl) {
      const items = await listJobItems(job.id, processed.length);
      const queuedItems = items.filter((item) => item.status === 'queued');
      if (queuedItems.length === 0) {
        return res.status(400).json({
          error: 'invalid_profile_url',
          message: 'All LinkedIn profile URLs are invalid',
          failed_count: processed.filter((p) => p.normalized === null).length
        });
      }
      await Promise.all(
        queuedItems.map((item) =>
          axios.post(
            zapierWebhookUrl,
            {
              batch_run_id: job.id,
              task_id: item.id,
              profile_url: item.profile_url,
              message: item?.result_json?.note || parsed.data.note || null
            },
            { timeout: 15_000 }
          )
        )
      );

      const firstQueued = queuedItems[0];
      await notifyConnectQueued({
        userId,
        workspaceId,
        jobId: job.id,
        totalTargets: queuedItems.length,
        profileUrl: queuedItems.length === 1 && firstQueued ? firstQueued.profile_url : null,
        note: (queuedItems.length === 1 && firstQueued?.result_json?.note) || parsed.data.note || null,
        estimatedRate: String(throttle.settings.max_actions_per_hour || ''),
        isBulk: queuedItems.length > 1
      });

      return res.status(202).json({
        queued: true,
        job_id: job.id,
        queued_reason: shouldQueueOnly ? 'outside_active_hours' : undefined,
        queue_source: 'zapier_sheets',
        tasks: queuedItems.map((item) => ({
          task_id: item.id,
          batch_run_id: job.id,
          profile_url: item.profile_url
        })),
        quota: {
          limit_per_day: throttle.settings.max_connects_per_day,
          used_today: q.usedToday,
          remaining_today: q.remainingToday,
          day: q.day,
          timezone: q.tz
        }
      });
    }

    // Single profile: execute immediately via Airtop Single-Profile webhook.
    if (processed.length === 1 && !shouldQueueOnly) {
      const singleItem = processed[0];
      if (singleItem.normalized === null) {
        return res.status(400).json({
          error: 'invalid_profile_url',
          message: 'Invalid LinkedIn profile URL',
          profile_url: singleItem.profile_url
        });
      }
      const singleAgentId = requireEnvAny([
        'AIRTOP_LINKEDIN_CONNECT_SINGLE_AGENT_ID',
        'AIRTOP_LINKEDIN_CONNECT_AGENT_ID'
      ]);
      const singleWebhookId = requireEnvAny([
        'AIRTOP_LINKEDIN_CONNECT_SINGLE_WEBHOOK_ID',
        'AIRTOP_LINKEDIN_CONNECT_WEBHOOK_ID'
      ]);
      const itemRows = await listJobItems(job.id, 1);
      const item = itemRows?.[0];
      if (!item) {
        throw new Error('connect_item_not_found');
      }

      if (singleItem.profile_url !== singleItem.normalized) {
        console.log('[sniper-connect] LinkedIn profile URL normalized', { original: singleItem.profile_url, normalized: singleItem.normalized });
      }
      const { invocationId } = await invokeAgentWebhook({
        agentId: singleAgentId,
        webhookId: singleWebhookId,
        configVars: {
          profile_url: item.profile_url,
          note: item?.result_json?.note || parsed.data.note || null,
          send_without_note_if_blocked: true,
          max_attempts: 3,
          dry_run: false,
          verification_mode: 'either',
          timeout_seconds: 180,
          task_id: item.id
        }
      });
      console.log('[airtop] single connect invocation', { invocationId, jobId: job.id });

      const result = await pollInvocationResult({
        agentId: singleAgentId,
        invocationId,
        timeoutSeconds: 180,
        pollIntervalMs: 2000
      });
      const output = safeOutputParse(result.output);
      const normalized = normalizeAirtopStatus(output?.status);
      const itemStatus =
        normalized.status === 'SENT' ? 'succeeded_verified' :
        normalized.status === 'ALREADY_CONNECTED' ? 'succeeded_noop_already_connected' :
        normalized.status === 'ALREADY_PENDING' ? 'succeeded_noop_already_pending' :
        normalized.status === 'AUTH_REQUIRED' ? 'paused_cooldown' :
        'failed';

      await updateJobItem(item.id, {
        status: itemStatus as any,
        result_json: {
          ...(typeof output === 'object' && output ? output : { output }),
          invocationId,
          finished_at: new Date().toISOString()
        },
        error_code: normalized.status === 'AUTH_REQUIRED' ? 'auth_required' : null,
        error_message: normalized.ok ? null : (output?.error || output?.message || 'Airtop connect failed')
      } as any);

      if (normalized.status === 'AUTH_REQUIRED') {
        await updateJob(job.id, {
          status: 'paused_cooldown' as any,
          error_code: 'needs_reauth',
          error_message: 'LinkedIn auth required',
          finished_at: null
        } as any);
      } else {
        await updateJob(job.id, {
          status: normalized.ok ? 'succeeded' : 'failed',
          finished_at: new Date().toISOString()
        } as any);
        try {
          await recordActionUsage({ userId, workspaceId, settings: throttle.settings, actionType: 'connect' });
        } catch (e: any) {
          console.warn('[sniper-connect] usage record failed', e?.message || e);
        }
      }

      if (normalized.ok) {
        await notifyConnectResult({
          userId,
          workspaceId,
          jobId: job.id,
          profileUrl: item.profile_url,
          finalStatus: normalized.status,
          message: output?.message || output?.error || null,
          note: item?.result_json?.note || parsed.data.note || null
        });
      }

      return res.status(200).json({
        queued: false,
        job_id: job.id,
        invocation_id: invocationId,
        status: itemStatus,
        quota: {
          limit_per_day: throttle.settings.max_connects_per_day,
          used_today: q.usedToday,
          remaining_today: q.remainingToday,
          day: q.day,
          timezone: q.tz
        }
      });
    }

    // Bulk: trigger Airtop Batch Worker once and let it pull tasks.
    const validProcessedBatch = processed.filter((p) => p.normalized !== null);
    if (validProcessedBatch.length === 0) {
      return res.status(400).json({
        error: 'invalid_profile_url',
        message: 'All LinkedIn profile URLs are invalid',
        failed_count: processed.filter((p) => p.normalized === null).length
      });
    }
    const batchAgentId = requireEnvAny([
      'AIRTOP_LINKEDIN_CONNECT_BATCH_AGENT_ID',
      'AIRTOP_LINKEDIN_CONNECT_AGENT_ID'
    ]);
    const batchWebhookId = requireEnvAny([
      'AIRTOP_LINKEDIN_CONNECT_BATCH_WEBHOOK_ID',
      'AIRTOP_LINKEDIN_CONNECT_WEBHOOK_ID'
    ]);
    const baseUrl = String(process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL || process.env.BACKEND_BASE_URL || '').trim();
    const batchApiKey = requireEnvAny(['AIRTOP_BATCH_API_KEY', 'AIRTOP_API_KEY']);
    const batchGoogleSheetUrl = String(
      process.env.AIRTOP_LINKEDIN_CONNECT_BATCH_GOOGLE_SHEET_URL ||
      process.env.AIRTOP_LINKEDIN_CONNECT_GOOGLE_SHEET_URL ||
      ''
    ).trim();
    if (!batchGoogleSheetUrl && !baseUrl) {
      throw new Error('Missing BACKEND_PUBLIC_URL or AIRTOP_LINKEDIN_CONNECT_BATCH_GOOGLE_SHEET_URL for batch worker');
    }

    const configVars = batchGoogleSheetUrl
      ? { googleSheetUrl: batchGoogleSheetUrl }
      : {
          batch_run_id: job.id,
          base_url: baseUrl,
          api_key: batchApiKey,
          timeout_seconds: 3600
        };

    const { invocationId } = await invokeAgentWebhook({
      agentId: batchAgentId,
      webhookId: batchWebhookId,
      configVars
    });
    console.log('[airtop] batch connect invocation', { invocationId, jobId: job.id });

    await notifyConnectQueued({
      userId,
      workspaceId,
      jobId: job.id,
      totalTargets: validProcessedBatch.length,
      profileUrl: validProcessedBatch.length === 1 ? validProcessedBatch[0].normalized! : null,
      note: (validProcessedBatch.length === 1 ? validProcessedBatch[0].note : parsed.data.note) || null,
      estimatedRate: String(throttle.settings.max_actions_per_hour || ''),
      isBulk: validProcessedBatch.length > 1
    });

    return res.status(202).json({
      queued: true,
      job_id: job.id,
      invocation_id: invocationId,
      queued_reason: shouldQueueOnly ? 'outside_active_hours' : undefined,
      quota: {
        limit_per_day: throttle.settings.max_connects_per_day,
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

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (settings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;
    const tz = settings.timezone || 'UTC';
    const day = dayStringInTimezone(new Date(), tz);

    const { data, error } = await sniperSupabaseDb.rpc('sniper_reserve_action_usage', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
      p_day: day,
      p_message_delta: 0,
      p_connect_limit: settings.max_connects_per_day,
      p_workspace_connect_limit: settings.max_workspace_connects_per_day,
      p_message_limit: settings.max_messages_per_day,
      p_workspace_message_limit: settings.max_workspace_messages_per_day,
      p_profile_limit: settings.max_page_interactions_per_day,
      p_workspace_profile_limit: settings.max_workspace_page_interactions_per_day,
      p_job_page_limit: settings.max_page_interactions_per_day,
      p_workspace_job_page_limit: settings.max_workspace_page_interactions_per_day
    } as any);
    if (error) throw error;
    const row: any = Array.isArray(data) ? data[0] : data;
    const usedToday = Number(row?.user_messages || 0);
    const usedWorkspace = Number(row?.workspace_messages || 0);
    if (usedToday + parsed.data.profile_urls.length > settings.max_messages_per_day) {
      return res.status(429).json({
        error: 'daily_message_limit_exceeded',
        limit_per_day: settings.max_messages_per_day,
        used_today: usedToday,
        remaining_today: Math.max(0, settings.max_messages_per_day - usedToday),
        requested: parsed.data.profile_urls.length,
        scope: 'user'
      });
    }
    if (usedWorkspace + parsed.data.profile_urls.length > settings.max_workspace_messages_per_day) {
      return res.status(429).json({
        error: 'daily_message_limit_exceeded',
        limit_per_day: settings.max_workspace_messages_per_day,
        used_today: usedWorkspace,
        remaining_today: Math.max(0, settings.max_workspace_messages_per_day - usedWorkspace),
        requested: parsed.data.profile_urls.length,
        scope: 'workspace'
      });
    }
    (req as any)._sniperQuota = {
      usedToday,
      remainingToday: Math.max(0, settings.max_messages_per_day - usedToday),
      day,
      tz
    };

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
    const q = (req as any)._sniperQuota || {};
    return res.status(202).json({
      queued: true,
      job_id: job.id,
      quota: {
        limit_per_day: settings.max_messages_per_day,
        used_today: q.usedToday,
        remaining_today: q.remainingToday,
        day: q.day,
        timezone: q.tz
      }
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_messages' });
  }
});

// ─────────── Sales Navigator: Connect ───────────
sniperV1Router.post('/actions/sn-connect', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      profile_urls: z.array(z.string().min(1)).min(1).max(500),
      note: z.string().max(300).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (settings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'sn_send_connect',
      provider,
      input_json: { note: parsed.data.note || null },
    });

    await insertJobItems(
      parsed.data.profile_urls.map((u) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: u,
        action_type: 'connect' as const,
        scheduled_for: null,
        status: 'queued' as const,
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_sn_connect' });
  }
});

// ─────────── Sales Navigator: InMail ───────────
sniperV1Router.post('/actions/sn-inmail', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      profile_urls: z.array(z.string().min(1)).min(1).max(500),
      subject: z.string().min(1).max(200),
      message: z.string().min(1).max(1900),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (settings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'sn_send_inmail',
      provider,
      input_json: { subject: parsed.data.subject, message: parsed.data.message },
    });

    await insertJobItems(
      parsed.data.profile_urls.map((u) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: u,
        action_type: 'inmail' as const,
        scheduled_for: null,
        status: 'queued' as const,
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_sn_inmail' });
  }
});

// ─────────── Sales Navigator: Message ───────────
sniperV1Router.post('/actions/sn-message', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);
    if (!(await requireCloudEngineEnabledOr409(workspaceId, res))) return;

    const schema = z.object({
      profile_urls: z.array(z.string().url()).min(1).max(500),
      message: z.string().min(1).max(3000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const settings = await fetchSniperV1Settings(workspaceId);
    const provider = (settings.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') as any;

    const job = await createJob({
      workspace_id: workspaceId,
      created_by: userId,
      target_id: null,
      job_type: 'sn_send_message',
      provider,
      input_json: { message: parsed.data.message },
    });

    await insertJobItems(
      parsed.data.profile_urls.map((u) => ({
        job_id: job.id,
        workspace_id: workspaceId,
        profile_url: u,
        action_type: 'message' as const,
        scheduled_for: null,
        status: 'queued' as const,
      }))
    );

    await sniperV1Queue.add('sniper_v1', { jobId: job.id });
    return res.status(202).json({ queued: true, job_id: job.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_queue_sn_message' });
  }
});

sniperV1Router.post('/actions/import_to_leads', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    // Allowed even when Cloud Engine is OFF (DB-only).
    const schema = z.object({
      profile_urls: z.array(z.string().url()).min(1).max(2000),
      campaign_id: z.string().uuid().optional().nullable()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    // Normalize + dedupe
    const urls = Array.from(new Set(parsed.data.profile_urls.map((u) => String(u).trim()).filter(Boolean)));
    if (!urls.length) return res.status(400).json({ error: 'no_profile_urls' });
    const campaignId = parsed.data.campaign_id ? String(parsed.data.campaign_id) : null;

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

    // Fetch existing leads in this workspace scope.
    const { data: existing, error: existErr } = await sniperSupabaseDb
      .from('leads')
      .select('id, linkedin_url, name, title, user_id, workspace_id, campaign_id')
      .eq('workspace_id', workspaceId)
      .in('linkedin_url', urls);
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
        if (campaignId && !found.campaign_id) patch.campaign_id = campaignId;
        if (Object.keys(patch).length) updates.push({ id: String(found.id), patch });
        continue;
      }

      inserts.push({
        user_id: userId,
        workspace_id: workspaceId,
        linkedin_url: url,
        name: name || url,
        title: headline || null,
        campaign_id: campaignId,
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
      provider: s.provider || (s.cloud_engine_enabled ? 'agentic_browser' : 'extension_only'),
      max_actions_per_day: s.max_actions_per_day,
      max_actions_per_hour: s.max_actions_per_hour,
      min_delay_seconds: s.min_delay_seconds,
      max_delay_seconds: s.max_delay_seconds,
      active_hours_start: String(s.active_hours_json?.start || '09:00'),
      active_hours_end: String(s.active_hours_json?.end || '17:00'),
      run_on_weekends: Boolean(s.active_hours_json?.runOnWeekends),
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
      provider: z.enum(['airtop', 'extension_only', 'agentic_browser']),
      max_actions_per_day: z.number().int().min(1).max(5000),
      max_actions_per_hour: z.number().int().min(1).max(500),
      min_delay_seconds: z.number().int().min(1).max(600),
      max_delay_seconds: z.number().int().min(1).max(1800),
      active_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
      active_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
      run_on_weekends: z.boolean(),
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
      provider: cloudEnabled ? parsed.data.provider : 'extension_only',
      provider_preference: cloudEnabled ? (parsed.data.provider === 'agentic_browser' ? 'agentic_browser' : 'airtop') : existing.provider_preference,
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
        runOnWeekends: Boolean(parsed.data.run_on_weekends)
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
    return res.json({ url: out.live_view_url, auth_session_id: out.auth_session_id, profile_id: (out as any).airtop_profile_id || null });
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
    const settings = await fetchSniperV1Settings(workspaceId);

    const airtopConnected = Boolean(row?.status === 'ok' && row?.airtop_profile_id);
    const browserbaseConnected = Boolean(row?.status === 'ok' && row?.browserbase_context_id);
    const connected = settings.provider === 'agentic_browser' ? browserbaseConnected : airtopConnected;

    return res.json({
      connected,
      provider: settings.provider,
      profile_id: row?.airtop_profile_id || null,
      browserbase_context_id: row?.browserbase_context_id || null,
      airtop_connected: airtopConnected,
      browserbase_connected: browserbaseConnected,
      last_checked_at: new Date().toISOString()
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed_to_fetch_auth_status' });
  }
});

// ---------------- Browserbase LinkedIn auth ----------------
sniperV1Router.post('/linkedin/auth/start-browserbase', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const settings = await fetchSniperV1Settings(workspaceId);
    if (!settings.cloud_engine_enabled) {
      return res.status(409).json({ error: 'Cloud Engine is disabled. Enable it in settings first.' });
    }

    const provider = getProvider('agentic_browser');
    if (!provider.startLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });

    const out = await provider.startLinkedInAuth({ userId, workspaceId });
    return res.json({
      live_view_url: out.live_view_url,
      auth_session_id: out.auth_session_id,
      browserbase_session_id: (out as any).browserbase_session_id || null,
      browserbase_context_id: (out as any).browserbase_context_id || null,
    });
  } catch (e: any) {
    const msg = String(e?.message || '');
    const stack = String(e?.stack || '').slice(0, 500);
    console.error('[sniper-browserbase-auth] start-browserbase failed:', msg, stack);
    if (msg.includes('BROWSERBASE provider disabled')) {
      return res.status(503).json({
        error: 'Browserbase provider disabled',
        hint: 'Set BROWSERBASE_PROVIDER_ENABLED=true, BROWSERBASE_API_KEY, and BROWSERBASE_PROJECT_ID.'
      });
    }
    return res.status(500).json({ error: msg || 'failed_to_start_browserbase_auth', details: stack });
  }
});

sniperV1Router.post('/linkedin/auth/complete-browserbase', async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const workspaceId = getWorkspaceId(req, userId);

    const settings = await fetchSniperV1Settings(workspaceId);
    if (!settings.cloud_engine_enabled) {
      return res.status(409).json({ error: 'Cloud Engine is disabled.' });
    }

    const schema = z.object({ auth_session_id: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

    const provider = getProvider('agentic_browser');
    if (!provider.completeLinkedInAuth) return res.status(400).json({ error: 'provider_does_not_support_embedded_auth' });
    const out = await provider.completeLinkedInAuth({ userId, workspaceId, authSessionId: parsed.data.auth_session_id });
    return res.json(out);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('BROWSERBASE provider disabled')) {
      return res.status(503).json({
        error: 'Browserbase provider disabled',
        hint: 'Set BROWSERBASE_PROVIDER_ENABLED=true, BROWSERBASE_API_KEY, and BROWSERBASE_PROJECT_ID.'
      });
    }
    if (msg.includes('LINKEDIN_AUTH_REQUIRED')) {
      return res.status(400).json({ error: 'LinkedIn login not detected. Please log in via the live view and try again.' });
    }
    console.error('[sniper-browserbase-auth] complete-browserbase failed:', msg, String(e?.stack || '').slice(0, 500));
    return res.status(500).json({ error: msg || 'failed_to_complete_browserbase_auth', details: String(e?.stack || '').slice(0, 500) });
  }
});

export default sniperV1Router;


