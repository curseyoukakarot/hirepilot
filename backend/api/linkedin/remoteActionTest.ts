import type { Response } from 'express';
import type { ApiRequest } from '../../types/api';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { enqueueLinkedInRemoteAction } from '../../src/services/linkedinRemoteActions';
import { LinkedInRemoteActionType } from '../../src/services/brightdataBrowser';
import { brightDataBrowserConfig, isBrightDataBrowserEnabled } from '../../src/config/brightdata';
import {
  createLinkedInRemoteActionLog,
  listLatestLinkedInRemoteActionLogs,
  updateLinkedInRemoteActionLog
} from '../../src/services/linkedinRemoteActionLogs';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
}

function isProdEnv() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const railwayEnv = String(process.env.RAILWAY_ENVIRONMENT_NAME || '').toLowerCase();
  return nodeEnv === 'production' || railwayEnv === 'production';
}

async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    requireSupabaseEnv();
    const { data } = await db.from('users').select('role').eq('id', userId).maybeSingle();
    const roleLc = String((data as any)?.role || '').toLowerCase();
    return roleLc === 'super_admin' || roleLc === 'superadmin';
  } catch {
    return false;
  }
}

async function getEngineMode(userId: string): Promise<'local_browser' | 'brightdata_cloud'> {
  requireSupabaseEnv();
  try {
    const { data } = await db
      .from('user_settings')
      .select('linkedin_engine_mode,use_remote_linkedin_actions')
      .eq('user_id', userId)
      .maybeSingle();
    const raw = String((data as any)?.linkedin_engine_mode || '').toLowerCase();
    if (raw === 'brightdata_cloud') return 'brightdata_cloud';
    if (raw === 'local_browser') return 'local_browser';
    // Back-compat: old boolean flag
    const fallbackCloud = Boolean((data as any)?.use_remote_linkedin_actions);
    return fallbackCloud ? 'brightdata_cloud' : 'local_browser';
  } catch {
    return 'local_browser';
  }
}

async function hasCookie(userId: string): Promise<boolean> {
  requireSupabaseEnv();
  try {
    const { data: session } = await db
      .from('linkedin_sessions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if ((session as any)?.id) return true;
  } catch {}
  try {
    const { data: legacy } = await db
      .from('linkedin_cookies')
      .select('session_cookie')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .maybeSingle();
    return Boolean((legacy as any)?.session_cookie);
  } catch {
    return false;
  }
}

function validateLinkedInUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    const host = u.hostname.toLowerCase();
    if (host !== 'www.linkedin.com' && host !== 'linkedin.com') return null;
    if (!u.pathname.startsWith('/in/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const testBodySchema = z.object({
  linkedinUrl: z.string().min(10),
  action: z.enum(['connect_request', 'send_message']),
  message: z.string().optional()
});

export async function linkedinRemoteActionTest(req: ApiRequest, res: Response) {
  try {
    const userId = req.user?.id || (req.headers['x-user-id'] as string | undefined);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    requireSupabaseEnv();

    // Admin-only in prod unless explicitly allowed
    const allowInProd = String(process.env.ALLOW_REMOTE_ACTION_TESTS || 'false').toLowerCase() === 'true';
    const superAdmin = await isSuperAdmin(userId);
    if (isProdEnv() && !superAdmin && !allowInProd) {
      return res.status(403).json({ error: 'forbidden', message: 'Remote action tests are disabled in production.' });
    }

    const parsed = testBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Bright Data Browser flags
    const enabledFlag = String(process.env.BRIGHTDATA_BROWSER_ENABLED || 'false').toLowerCase() === 'true';
    if (!enabledFlag) {
      return res.status(409).json({
        error: 'brightdata_browser_disabled',
        message: 'Set BRIGHTDATA_BROWSER_ENABLED=true to run remote action tests.'
      });
    }
    if (!brightDataBrowserConfig.baseUrl || !isBrightDataBrowserEnabled()) {
      return res.status(409).json({
        error: 'brightdata_browser_not_configured',
        message:
          'BRIGHTDATA_BROWSER_BASE_URL must be configured along with either BRIGHTDATA_BROWSER_API_TOKEN (REST) or BRIGHTDATA_BROWSER_USERNAME/BRIGHTDATA_BROWSER_PASSWORD (Selenium).'
      });
    }

    const engineMode = await getEngineMode(userId);
    if (engineMode !== 'brightdata_cloud') {
      return res.status(409).json({
        error: 'engine_mode_not_cloud',
        message: 'Switch LinkedIn engine to Bright Data Cloud to run remote tests.',
        current_mode: engineMode
      });
    }

    const hasCookieOnFile = await hasCookie(userId);
    if (!hasCookieOnFile) {
      return res.status(412).json({
        error: 'linkedin_cookie_missing',
        message: 'No LinkedIn cookie found. Save a cookie in Settings first.'
      });
    }

    const linkedinUrl = validateLinkedInUrl(parsed.data.linkedinUrl);
    if (!linkedinUrl) {
      return res.status(400).json({ error: 'invalid_linkedin_url', message: 'Provide a valid LinkedIn profile URL (/in/...).'});
    }

    const rawMessage = typeof parsed.data.message === 'string' ? parsed.data.message.trim() : '';
    const message = rawMessage ? rawMessage.slice(0, 450) : undefined;
    const action = parsed.data.action as LinkedInRemoteActionType;
    if (action === 'send_message' && !message) {
      return res.status(400).json({ error: 'message_required', message: 'Message is required for send_message.' });
    }

    const logId = await createLinkedInRemoteActionLog({
      userId,
      action,
      linkedinUrl,
      status: 'queued'
    });

    const jobId = await enqueueLinkedInRemoteAction({
      userId,
      action,
      linkedinUrl,
      message,
      triggeredBy: 'remote_action_test',
      testRun: true,
      testLogId: logId
    });

    try {
      await updateLinkedInRemoteActionLog(logId, { job_id: jobId });
    } catch {}

    return res.status(202).json({ status: 'queued', jobId, action, linkedinUrl, logId });
  } catch (err: any) {
    console.error('[LinkedInRemoteActionTest] Failed to queue test action', err);
    return res.status(500).json({
      error: 'server_error',
      message: err?.message || 'Failed to queue remote action test'
    });
  }
}

export async function linkedinRemoteActionTestLatest(req: ApiRequest, res: Response) {
  try {
    const userId = req.user?.id || (req.headers['x-user-id'] as string | undefined);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const logs = await listLatestLinkedInRemoteActionLogs(userId, 10);
    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'server_error', message: err?.message || 'Failed to load logs' });
  }
}

