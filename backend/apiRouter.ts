import { Router } from "express";
import { requireAuth } from './middleware/authMiddleware';
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

import teamRouter from './routes/team';
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
import getUserCredits from './api/getUserCredits';
import creditsPurchase from './api/creditsPurchase';
import healthCheck from './api/health';
// Import Decodo LinkedIn trigger
import linkedinTriggerRouter from './src/routes/campaigns/linkedin/trigger';
import linkedInCookieRouter from './src/routes/cookies/storeLinkedInCookie';
import adminUsersRouter from './src/routes/adminUsers';

// LinkedIn session admin router
const linkedinSessionAdmin = require('./api/linkedinSessionAdmin');

const router = Router();

export type ApiHandler = (req: ApiRequest, res: Response) => Promise<void>;

// Health check endpoint for Railway
router.get('/health', healthCheck);

// Get campaigns
router.get("/getCampaigns", getCampaigns);

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

// Team management routes
router.use('/team', requireAuth, teamRouter);

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
router.get('/campaigns/:id/performance', campaignPerformance);
// Public: campaigns attached to a job
router.get('/jobs/:id/campaigns', jobCampaigns);

// Add user performance endpoint
router.get('/users/:id/performance', userPerformance);

// Add analytics time series endpoint
router.get('/analytics/time-series', analyticsTimeSeries);

// Add schedule mass message endpoint
router.post('/scheduleMassMessage', scheduleMassMessage);

// LinkedIn outreach endpoints
router.post('/linkedin/send', requireAuth, linkedinSend);
router.post('/linkedin/puppet-request', requireAuth, puppetLinkedInRequest);
router.post('/linkedin/playwright-request', requireAuth, playwrightLinkedInRequest);
router.get('/linkedin/daily-count', requireAuth, linkedinDailyCount);

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

// Guest signup (admin create confirmed user)
router.post('/guest-signup', guestSignup);
router.post('/guest-upsert', guestUpsert);
router.post('/guest-status', guestStatus);

// Safe job fetch for guests avoiding PostgREST single-object errors
router.get('/jobs/:id', getJob);
router.get('/advanced-info', advancedInfo);
router.get('/auth-debug', authDebug);

// Support: create ticket endpoint used by Support Agent
router.post('/support/create', supportCreate);
router.post('/support/search', supportSearch);
router.post('/support/ingest', supportIngest);
router.post('/support/suggest', supportSuggest);

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
    const role = String((data.user.user_metadata as any)?.role || '').toLowerCase().replace(/\s|-/g, '_');
    const isAdmin = ['admin','super_admin','owner','account_owner','team_admin','org_admin'].includes(role);
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

export default router;
