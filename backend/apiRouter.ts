import { Router } from "express";
import { requireAuth } from './middleware/authMiddleware';
import requireAuthUnified from './middleware/requireAuthUnified';
import { ApiRequest } from './types/api';

import getCampaigns from "./api/getCampaigns";
import saveMessage from "./api/saveMessage";
import sendMassMessage from "./api/sendMassMessage";
import saveTemplate from "./api/saveTemplate";
import getTemplates from "./api/getTemplates";
import updateTemplate from "./api/updateTemplate";
import deleteTemplate from "./api/deleteTemplate";
import pipelineStages from "./api/pipelineStages";
import messageRouter from './routers/messageRouter';
import { launchCampaign } from './api/campaigns/launch';
import { pollPhantomBusterResults, debugPhantomBusterWebhook, debugSearchLeads, testDirectPhantomBuster, fetchExistingPhantomResults } from './api/campaign';
import campaignPerformance from './api/campaignPerformance';
import jobCampaigns from './api/jobCampaigns';
import userPerformance from './api/userPerformance';
import analyticsTimeSeries from './api/analyticsTimeSeries';
import scheduleMassMessage from './api/scheduleMassMessage';
import debugTrialEmails from './api/debugTrialEmails';
import triggerTrialEmails from './api/triggerTrialEmails';
import testTrialEmail from './api/testTrialEmail';

import sendSlackNotification from './api/sendSlackNotification';
import startTrial from './api/startTrial';
import zapierRouter from './api/zapierRouter';
import createApikey from './api/createApikey';
import getApiKeys from './api/getApiKeys';
import deleteApiKey from './api/deleteApiKey';
import userIntegrationsRouter from './api/userIntegrations';
import webhooksRouter from './api/webhooksRouter';
import bulkScheduleMessages from './api/bulkScheduleMessages';
import sequencesRouter from './api/sequences';
import testBackfill from './api/testBackfill';
import debugMessageCenter from './api/debugMessageCenter';
import testAnalytics from './api/testAnalytics';
import testGmailConnection from './api/testGmailConnection';
import testLeadStatusUpdate from './api/testLeadStatusUpdate';
import enrichJobDetails from './api/enrichJobDetails';
import sendGuestInvite from './api/sendGuestInvite';
import guestExists from './src/api/guestExists';
import guestSignup from './api/guestSignup';
import guestUpsert from './api/guestUpsert';
import guestStatus from './api/guestStatus';
import getJob from './api/getJob';
import advancedInfo from './api/advancedInfo';
import authDebug from './api/authDebug';
import jobsShareRouter from './api/jobsShare';
import supportCreate from './api/support/create';
import supportSearch from './api/support/search';
import supportIngest from './api/support/ingest';
import supportSuggest from './api/support/suggest';
import supportAnswer from './api/support/answer';
// Temporary: admin tools for support
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import testEnrichmentProviders from './api/testEnrichmentProviders';
import debugCampaignMetrics from './api/debugCampaignMetrics';
import backfillCampaignAttribution from './api/backfillCampaignAttribution';
import linkedinSend from './api/linkedinSend';
import linkedinDailyCount from './api/linkedinDailyCount';
import puppetLinkedInRequest from './api/linkedin/puppetRequest';
import playwrightLinkedInRequest from './api/linkedin/playwrightRequest';
import sendLinkedInConnect from './api/linkedin/sendConnect';
import recordLinkedInConnect from './api/linkedin/recordConnect';
import n8nLinkedInConnect from './api/n8n/linkedinConnect';
import linkedinRemoteActionHandler from './api/linkedin/remoteAction';
import { linkedinRemoteActionTest, linkedinRemoteActionTestLatest } from './api/linkedin/remoteActionTest';
import getUserCredits from './api/getUserCredits';
import creditsPurchase from './api/creditsPurchase';
import healthCheck from './api/health';
// Import Decodo LinkedIn trigger
import linkedinTriggerRouter from './src/routes/campaigns/linkedin/trigger';
import linkedInCookieRouter from './src/routes/cookies/storeLinkedInCookie';
import adminUsersRouter from './src/routes/adminUsers';
import { slack as slackClient } from './src/services/slack';
import fieldsHandler from './api/fields';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { notifySlack } from './lib/slack';
import { runFullBackfillLoop, processBatchSoftTimed } from './workers/emailAttributionCore';
import { sniperV1Router } from './src/routes/sniper.v1';
import jobseekerAgentRouter from './src/routes/jobseeker.agent';

// LinkedIn session admin router
const linkedinSessionAdmin = require('./api/linkedinSessionAdmin');

const router = Router();
const useUnified = String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true';
const requireAuthFlag = (useUnified ? (requireAuthUnified as any) : (requireAuth as any));

export type ApiHandler = (req: ApiRequest, res: Response) => Promise<void>;

// Health check endpoint for Railway
router.get('/health', healthCheck);

// Sniper v1 API (targets/jobs/actions/settings/auth)
// Mounted here (in addition to server-level mounting) to ensure /api/sniper/* is always registered
// in deployments where apiRouter is the canonical /api entrypoint.
router.use('/sniper', sniperV1Router);
// Job seeker agent API
router.use('/jobseeker', jobseekerAgentRouter);

// List Slack channels for the authenticated user's workspace (via bot token)
router.get('/slack/channels', requireAuthFlag, async (req, res) => {
  try {
    // Prefer user-connected token if stored (workspace-specific), fallback to bot token
    const userId = (req as any)?.user?.id;
    let token: string | null = null;
    try {
      const { createClient } = require('@supabase/supabase-js');
      const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await admin.from('user_settings').select('slack_access_token').eq('user_id', userId).maybeSingle();
      token = data?.slack_access_token || null;
    } catch {}

    const web = token ? new (require('@slack/web-api').WebClient)(token) : slackClient;

    const channels: Array<{ id: string; name: string; is_member?: boolean }> = [] as any;
    let cursor: string | undefined = undefined;
    do {
      const result: any = await (web as any).conversations.list({
        // include ims and mpims if token permits; Slack ignores unknown types
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: true,
        limit: 200,
        cursor
      });
      const batch = (result?.channels || []).map((c: any) => ({ id: c.id, name: c.name, is_member: c.is_member }));
      channels.push(...batch);
      cursor = result?.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return res.json({ channels });
  } catch (e: any) {
    try { console.error('Failed to list Slack channels', e?.message || e); } catch {}
    return res.status(500).json({ error: 'Failed to list Slack channels' });
  }
});

// Canonical fields endpoint for Sandbox modal
router.get('/fields', fieldsHandler);

// Get campaigns
router.get("/getCampaigns", requireAuthFlag, getCampaigns);

// Add after other routes
router.patch("/updateTemplate/:id", requireAuth, updateTemplate);
router.delete("/deleteTemplate/:id", requireAuth, deleteTemplate);

// Save a message
router.post("/saveMessage", saveMessage);

// Send mass message
router.post("/sendMassMessage", sendMassMessage);

// Save a template
router.post("/saveTemplate", saveTemplate);

// Get templates
router.get("/getTemplates", getTemplates);

// Pipeline stages
router.use("/pipeline-stages", requireAuth, pipelineStages);

// Add this line where other routers are registered
router.use('/message', messageRouter);
// Job share + apply
router.use('/jobs', jobsShareRouter);

// Team routes are mounted at the server level to keep invite acceptance public.

router.post('/campaigns/:id/launch', launchCampaign);

// LinkedIn trigger endpoint for Sales Navigator campaigns using Decodo
router.use('/campaigns/linkedin', linkedinTriggerRouter);
// Test endpoint for direct PhantomBuster integration (remove after testing)
router.post('/campaigns/linkedin/test-direct', requireAuth, testDirectPhantomBuster);
// Fetch existing PhantomBuster results for campaigns that already ran
router.get('/campaigns/:campaignId/fetch-existing-results', requireAuth, fetchExistingPhantomResults);
router.get('/campaigns/executions/:executionId/poll', requireAuth, pollPhantomBusterResults);
router.post('/campaigns/executions/:executionId/debug-webhook', requireAuth, debugPhantomBusterWebhook);
router.get('/campaigns/debug/search-leads', requireAuth, debugSearchLeads);

// Add campaign performance endpoint
router.get('/campaigns/:id/performance', requireAuthFlag, campaignPerformance);
// Public: campaigns attached to a job
router.get('/jobs/:id/campaigns', jobCampaigns);

// Add user performance endpoint
router.get('/users/:id/performance', userPerformance);

// Add analytics time series endpoint
router.get('/analytics/time-series', requireAuthFlag, analyticsTimeSeries);
// Overview line-series (service role aggregation)
import overviewSeries from './api/overviewSeries';
router.get('/analytics/overview-series', requireAuthFlag, overviewSeries);

// Add schedule mass message endpoint
router.post('/scheduleMassMessage', scheduleMassMessage);

// LinkedIn outreach endpoints
router.post('/linkedin/send', requireAuth, linkedinSend);
router.post('/linkedin/puppet-request', requireAuth, puppetLinkedInRequest);
router.post('/linkedin/playwright-request', requireAuth, playwrightLinkedInRequest);
router.get('/linkedin/daily-count', requireAuth, linkedinDailyCount);
router.post('/linkedin/remote-action', requireAuthFlag, linkedinRemoteActionHandler);
router.post('/linkedin/remote-action/test', requireAuthFlag, linkedinRemoteActionTest);
router.get('/linkedin/remote-action/test/latest', requireAuthFlag, linkedinRemoteActionTestLatest);

// n8n automation endpoints
router.post('/linkedin/send-connect', requireAuth, sendLinkedInConnect);
router.post('/n8n/linkedin-connect', n8nLinkedInConnect); // Public webhook for n8n
router.post('/linkedin/record-connect', requireAuth, recordLinkedInConnect);

// Proxy assignment endpoints
import { 
  getUserAssignedProxy, 
  assignProxyToUser as assignProxyAPI, 
  getProxyAssignment, 
  reassignProxy, 
  updateProxyPerformance,
  getAllProxyAssignments,
  getAvailableProxies,
  forceAssignProxy 
} from './api/puppet/proxyAssignment';

// Proxy health monitoring endpoints
import {
  checkProxyHealth,
  getProxyHealthMetrics,
  recordJobOutcome,
  evaluateProxyHealth,
  getProxyHealthOverview,
  getFailingProxies,
  reEnableProxy,
  sendTestNotification,
  getMyProxyHealthStatus
} from './api/puppet/proxyHealthMonitoring';

// Puppet health stats endpoints
import puppetHealthStatsRouter from './api/puppet/healthStats';

// Admin proxy management endpoints
import {
  testProxy,
  getAllProxies,
  getProxyStats,
  getProxyTestHistory,
  updateProxyStatus,
  reassignProxy as adminReassignProxy,
  batchTestProxies,
  addProxy,
  deleteProxy
} from './api/admin/proxyManagement';

router.get('/puppet/proxy/assigned', requireAuth, getUserAssignedProxy);
router.post('/puppet/proxy/assign', requireAuth, assignProxyAPI);
router.get('/puppet/proxy/assignment', requireAuth, getProxyAssignment);
router.post('/puppet/proxy/reassign', requireAuth, reassignProxy);
router.post('/puppet/proxy/performance', requireAuth, updateProxyPerformance);
router.get('/puppet/proxy/admin/assignments', requireAuth, getAllProxyAssignments);
router.get('/puppet/proxy/admin/available', requireAuth, getAvailableProxies);
router.post('/puppet/proxy/admin/force-assign', requireAuth, forceAssignProxy);

// Proxy health monitoring endpoints
router.get('/puppet/proxy/health/check/:proxyId', requireAuth, checkProxyHealth);
router.get('/puppet/proxy/health/metrics/:proxyId', requireAuth, getProxyHealthMetrics);
router.post('/puppet/proxy/health/record-outcome', requireAuth, recordJobOutcome);
router.post('/puppet/proxy/health/evaluate/:proxyId', requireAuth, evaluateProxyHealth);
router.get('/puppet/proxy/health/my-status', requireAuth, getMyProxyHealthStatus);
router.get('/puppet/proxy/health/admin/overview', requireAuth, getProxyHealthOverview);
router.get('/puppet/proxy/health/admin/failing', requireAuth, getFailingProxies);
router.post('/puppet/proxy/health/admin/re-enable', requireAuth, reEnableProxy);
router.post('/puppet/proxy/health/admin/test-notification', requireAuth, sendTestNotification);

// Admin proxy management endpoints
router.post('/admin/proxies/test', requireAuth, testProxy);
router.get('/admin/proxies', requireAuth, getAllProxies);
router.get('/admin/proxies/stats', requireAuth, getProxyStats);
router.get('/admin/proxies/:proxyId/history', requireAuth, getProxyTestHistory);
router.post('/admin/proxies/:proxyId/status', requireAuth, updateProxyStatus);
router.post('/admin/proxies/:proxyId/reassign', requireAuth, adminReassignProxy);
router.post('/admin/proxies/batch-test', requireAuth, batchTestProxies);
router.post('/admin/proxies/add', requireAuth, addProxy);
router.delete('/admin/proxies/:proxyId', requireAuth, deleteProxy);

// Puppet health stats endpoints for admin dashboard
router.use('/puppet', requireAuth, puppetHealthStatsRouter);

// User account endpoints
router.get('/user/credits', requireAuth, getUserCredits);
router.post('/credits/purchase', requireAuth, creditsPurchase);

// Add debug trial emails endpoint
router.get('/debug-trial-emails', debugTrialEmails);

// Add trigger trial emails endpoint
router.post('/trigger-trial-emails', triggerTrialEmails);

// Add test trial email endpoint
router.post('/test-trial-email', testTrialEmail);



// Add alias route for DELETE endpoint
router.delete('/delete/:id', (req, res) => {
  res.redirect(307, `/api/campaigns/${req.params.id}`);
});

// Start 7-day Starter trial
router.post('/startTrial', startTrial);

// Slack notification endpoint (internal)
router.post('/sendSlackNotification', sendSlackNotification);

router.use('/zapier', zapierRouter);

router.post('/apiKeys', requireAuth, createApikey);
router.get('/apiKeys', requireAuth, getApiKeys);
router.delete('/apiKeys/:id', requireAuth, deleteApiKey);

// User integrations (Hunter.io, Skrapp.io API keys)
router.use('/user-integrations', userIntegrationsRouter);

router.use('/webhooks', webhooksRouter);

router.post('/messages/bulk-schedule', requireAuth, bulkScheduleMessages);
router.use('/', sequencesRouter);

// Temporary test endpoint for debugging backfill
router.get('/test/backfill', testBackfill);

// Debug endpoint for Message Center queries
router.get('/test/message-center', debugMessageCenter);
// Test analytics tracking
router.get('/test/analytics', testAnalytics);

// Test Gmail connection for debugging
router.get('/test/gmail-connection', testGmailConnection);

// Test lead status update trigger
router.get('/test/lead-status-update', testLeadStatusUpdate);

// Job details enrichment
router.post('/enrich-job-details', enrichJobDetails);

// Guest invite (backend route alternative to Supabase RPC)
router.post('/send-guest-invite', sendGuestInvite);
router.get('/guest-exists', guestExists);

// Guest signup (admin create confirmed user)
router.post('/guest-signup', guestSignup);
router.post('/guest-upsert', guestUpsert);
router.post('/guest-status', guestStatus);

// Safe job fetch for guests avoiding PostgREST single-object errors
router.get('/jobs/:id', getJob);
router.get('/advanced-info', requireAuthFlag, advancedInfo);
router.get('/auth-debug', authDebug);

// Support: create ticket endpoint used by Support Agent
router.post('/support/create', supportCreate);
router.post('/support/search', supportSearch);
router.post('/support/ingest', supportIngest);
router.post('/support/suggest', supportSuggest);
router.post('/support/answer', supportAnswer);

// Admin-only helper: reset guest password (support-only; add real admin auth in production)
// Simple admin gate: require bearer and user role from Supabase to be an admin-like role
async function requireAdmin(req: Request, res: Response): Promise<{ ok: boolean, admin: any | null }> {
  try {
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) return { ok: false, admin: null };
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) { res.status(401).json({ error: 'Missing or invalid bearer token' }); return { ok: false, admin: null }; }
    const token = auth.split(' ')[1];
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) { res.status(401).json({ error: 'Invalid or expired token' }); return { ok: false, admin: null }; }

    // 1) Role derived from user_metadata (legacy)
    const roleFromMetadata = String((data.user.user_metadata as any)?.role || '').toLowerCase().replace(/\s|-/g, '_');

    // 2) Allowed roles from app_metadata (preferred for JWT-gated apps)
    const allowedRolesRaw = ((data.user.app_metadata as any)?.allowed_roles || []) as string[];
    const allowedRoles = Array.isArray(allowedRolesRaw)
      ? allowedRolesRaw.map(r => String(r || '').toLowerCase().replace(/\s|-/g, '_'))
      : [];

    // 3) Role from database users table
    let roleFromDb: string | null = null;
    try {
      const { data: dbUser } = await admin
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      roleFromDb = dbUser?.role ? String(dbUser.role).toLowerCase().replace(/\s|-/g, '_') : null;
    } catch {}

    const adminRoles = ['admin','super_admin','owner','account_owner','team_admin','org_admin'];
    const isAdmin =
      allowedRoles.includes('super_admin') ||
      allowedRoles.includes('admin') ||
      (roleFromDb ? adminRoles.includes(roleFromDb) : false) ||
      adminRoles.includes(roleFromMetadata);

    if (!isAdmin) { res.status(403).json({ error: 'Admin only' }); return { ok: false, admin: null }; }
    return { ok: true, admin };
  } catch {
    res.status(500).json({ error: 'Admin check failed' });
    return { ok: false, admin: null };
  }
}

router.post('/admin/reset-guest-password', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    const { email, newPassword } = req.body || {};
    if (!email || !newPassword) return res.status(400).json({ error: 'Missing email or newPassword' });
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // Lookup user by email via Admin REST (for parity with other codepaths)
    const adminBase = `${url}/auth/v1`;
    const headers: any = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    const resp = await fetch(`${adminBase}/admin/users?email=${encodeURIComponent(String(email).trim().toLowerCase())}`, { headers });
    if (!resp.ok) return res.status(resp.status).json({ error: await resp.text() });
    const body = await resp.json();
    const user = Array.isArray(body?.users) ? body.users[0] : (body?.id ? body : null);
    if (!user?.id) return res.status(404).json({ error: 'User not found' });
    const upd = await fetch(`${adminBase}/admin/users/${user.id}`, { method: 'PUT', headers, body: JSON.stringify({ password: String(newPassword) }) });
    if (!upd.ok) return res.status(upd.status).json({ error: await upd.text() });
    return res.json({ success: true, userId: user.id });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'reset-guest-password failed' });
  }
});

// Admin-only: backfill missing auth users for collaborators by email
router.post('/admin/backfill-guests', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    const { emails } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'Provide emails[]' });
    const normalized = emails.map((e: string) => String(e || '').trim().toLowerCase()).filter(Boolean);
    const admin = gate.admin;
    const results: any[] = [];
    for (const email of normalized) {
      // Check if exists
      let existing: any | null = null;
      for (let page = 1; page <= 20 && !existing; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) break;
        existing = (data?.users || []).find((u: any) => String(u.email || '').toLowerCase() === email) || null;
        if ((data?.users || []).length < 1000) break;
      }
      if (existing?.id) {
        results.push({ email, status: 'exists', id: existing.id });
        continue;
      }
      // Create minimal guest with random password
      const randomPw = Math.random().toString(36).slice(2) + Math.random().toString(36).toUpperCase().slice(2);
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: randomPw, email_confirm: true, user_metadata: { role: 'guest' } });
      if (createError) {
        results.push({ email, status: 'error', error: createError.message });
      } else {
        results.push({ email, status: 'created', id: created?.user?.id });
      }
    }
    return res.json({ results });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'backfill-guests failed' });
  }
});

// Test enrichment providers (Hunter.io, Skrapp.io)
router.post('/test/enrichment-providers', requireAuth, testEnrichmentProviders);

// Debug campaign metrics attribution
router.get('/debug/campaign-metrics', debugCampaignMetrics);

// Backfill campaign attribution for messages and email_events
router.post('/backfill/campaign-attribution', backfillCampaignAttribution);

// Fix today's email attribution
import fixTodayEmails from './api/fixTodayEmails';
router.post('/fix/today-emails', fixTodayEmails);

// LinkedIn Cookie Management Routes
router.use('/cookies/linkedin', linkedInCookieRouter);

router.use('/admin', requireAuth, linkedinSessionAdmin);

// Lead Activities endpoints
import leadActivitiesRouter from './api/leadActivities';
router.use('/lead-activities', requireAuth, leadActivitiesRouter);

// Unified Activities endpoint
import activitiesRouter from './api/activities';
router.use('/activities', requireAuth, activitiesRouter);

// Candidate Activities (create-only) endpoint for candidates without linked leads
import candidateActivitiesRouter from './api/candidateActivities';
router.use('/candidate-activities', requireAuth, candidateActivitiesRouter);

// ----------------------
// Admin: Email Attribution Controls
// ----------------------

// In-memory job state (single-process)
let attribJobState: {
  running: boolean;
  mode: 'backfill' | 'timed' | null;
  startedAt: number | null;
  finishedAt: number | null;
  lastPass?: { scanned: number; updated: number; ms: number; at: number } | null;
  lastError?: string | null;
} = {
  running: false,
  mode: null,
  startedAt: null,
  finishedAt: null,
  lastPass: null,
  lastError: null,
};

router.get('/admin/email-attribution/status', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    const { count } = await supabaseAdmin
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    // Avoid client/proxy caching confusing the UI
    res.setHeader('Cache-Control', 'no-store');

    return res.json({
      running: attribJobState.running,
      mode: attribJobState.mode,
      startedAt: attribJobState.startedAt,
      finishedAt: attribJobState.finishedAt,
      lastPass: attribJobState.lastPass || null,
      lastError: attribJobState.lastError || null,
      remainingUnattributed: typeof count === 'number' ? count : null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'status failed' });
  }
});

router.post('/admin/email-attribution/run-pass', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    if (attribJobState.running) return res.status(409).json({ error: 'Job already running' });
    attribJobState.running = true;
    attribJobState.mode = 'timed';
    attribJobState.startedAt = Date.now();
    attribJobState.finishedAt = null;
    attribJobState.lastError = null;
    // Fire-and-forget
    (async () => {
      try {
        const start = Date.now();
        const { scanned, updated } = await processBatchSoftTimed();
        attribJobState.lastPass = { scanned, updated, ms: Date.now() - start, at: Date.now() };
        attribJobState.finishedAt = Date.now();
        attribJobState.running = false;
        // Slack notify
        await notifySlack(`Email attribution timed pass completed: scanned ${scanned}, updated ${updated}.`);
      } catch (err: any) {
        attribJobState.lastError = err?.message || String(err);
        attribJobState.finishedAt = Date.now();
        attribJobState.running = false;
        try { await notifySlack(`Email attribution timed pass failed: ${attribJobState.lastError}`); } catch {}
      }
    })();
    return res.json({ ok: true, startedAt: attribJobState.startedAt });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'run-pass failed' });
  }
});

router.post('/admin/email-attribution/run-backfill', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    if (attribJobState.running) return res.status(409).json({ error: 'Job already running' });
    attribJobState.running = true;
    attribJobState.mode = 'backfill';
    attribJobState.startedAt = Date.now();
    attribJobState.finishedAt = null;
    attribJobState.lastError = null;

    // Capture baseline remaining
    const { count: before } = await supabaseAdmin
      .from('email_events')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    // Fire-and-forget
    (async () => {
      try {
        await runFullBackfillLoop();
        // After run
        const { count: after } = await supabaseAdmin
          .from('email_events')
          .select('*', { count: 'exact', head: true })
          .is('user_id', null);
        attribJobState.finishedAt = Date.now();
        attribJobState.running = false;
        attribJobState.lastPass = {
          scanned: (before || 0) - (after || 0),
          updated: (before || 0) - (after || 0),
          ms: attribJobState.finishedAt - (attribJobState.startedAt || attribJobState.finishedAt),
          at: Date.now(),
        };
        await notifySlack(`Email attribution backfill completed: remaining ${after}, updated ~${(before || 0) - (after || 0)}.`);
      } catch (err: any) {
        attribJobState.lastError = err?.message || String(err);
        attribJobState.finishedAt = Date.now();
        attribJobState.running = false;
        try { await notifySlack(`Email attribution backfill failed: ${attribJobState.lastError}`); } catch {}
      }
    })();

    return res.json({ ok: true, startedAt: attribJobState.startedAt, baselineRemaining: before });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'run-backfill failed' });
  }
});

router.get('/admin/email-attribution/logs', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const sinceMins = Math.min(parseInt(String(req.query.since_mins || '1440'), 10) || 1440, 7 * 24 * 60);
    const sinceIso = new Date(Date.now() - sinceMins * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('email_events')
      .select('id,event_type,message_id,user_id,campaign_id,lead_id,provider,event_timestamp,created_at,metadata')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ logs: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'logs failed' });
  }
});

router.get('/admin/email-attribution/event/:id', async (req: Request, res: Response) => {
  const gate = await requireAdmin(req, res);
  if (!gate.ok) return;
  try {
    const id = req.params.id;
    const { data: event, error } = await supabaseAdmin
      .from('email_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!event) return res.status(404).json({ error: 'Not found' });

    let message: any = null;
    try {
      if (event?.message_id) {
        const mid = String(event.message_id);
        const { data: msg } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('id', mid)
          .maybeSingle();
        message = msg || null;
      }
    } catch {}
    return res.json({ event, message });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'event fetch failed' });
  }
});

export default router;
