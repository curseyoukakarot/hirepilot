// backend/server.ts

console.log('### LOADED', __filename);

// Load environment variables first
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config();

// Make sure NEXT_PUBLIC_SUPABASE_ANON_KEY is loaded from .env
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
}

import express from 'express';
import cors from 'cors';
import sendSlackNotification from './api/sendSlackNotification';
import saveCampaign from './api/saveCampaign';
import generateMessage from './api/generate-message';
import createUser from './api/createUser';
import saveMessage from './api/saveMessage';
import leadsRouter from './src/routes/leads';
import outreachRouter from './api/outreach';
import getCampaigns from './api/getCampaigns';
import deleteCampaign from './api/deleteCampaign';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import sendgridWebhookRouter from './api/sendgridWebhook';
import sendgridValidateRouter from './api/sendgridValidate';
import sendgridSaveRouter from './api/sendgridSave';
import emailMetricsRouter from './api/emailMetrics';
import messageRouter from './routers/messageRouter';
import phantombusterValidateRouter from './api/phantombusterValidate';
import emailTemplatesRouter from './api/emailTemplates';
import googleAuthRouter from './api/googleAuth';
import linkedinSaveCookieRouter from './api/linkedinSaveCookie';
import linkedinCheckCookieRouter from './api/linkedinCheckCookie';
import saveLeadSourceRouter from './api/saveLeadSource';
import pipelinesRouter from './api/pipelines';
import leadSourceRouter from './api/lead-source';
import launchDataRouter from './api/launch-data';
import apiRouter from './apiRouter';
import { startCronJobs } from './cron/scheduler';
import { resetStuckPhantoms } from './cron/resetStuckPhantoms';
import { markExpiredCookies } from './cron/markExpiredCookies';
import { enrichLeads } from './workers/enrichLeads';
import { processTrialEmails } from './workers/emailDrip';
import { launchCampaign } from './api/campaigns/launch';
const linkedinSessionAdminRouter = require('./api/linkedinSessionAdmin');
import userRouter from './src/routes/user';
import runPhantomRouter from './api/runPhantom';
import phantombusterWebhookRouter from './api/phantombusterWebhook';
import zapierPhantomWebhook from './api/zapierPhantomWebhook';
import phantomStatusUpdate from './api/phantomStatusUpdate';
import phantomPoll from './api/phantomPoll';
import deleteJobRequisitions from './api/deleteJobRequisitions';
import teamRouter from './routes/team';
import slackRouter from './routes/slack';
import billingRouter from './routes/billing';
import cronProcessorRouter from './routes/cronProcessor';
import cookieParser from 'cookie-parser';
import listEndpoints from 'express-list-endpoints';
import adminUsersRouter from './src/routes/adminUsers';
import campaignPerformance from './api/campaignPerformance';
import leadsApolloRouter from './api/leadsApollo';
import rexChat from './src/api/rexChat';
import rexToolsHandler, { linkedinConnectHandler } from './src/api/rexTools';
import slackToggle from './src/api/slackToggle';
import slackConnect from './src/api/slack/connect';
import slackCallback from './src/api/slack/callback';
import slackDisconnect from './src/api/slack/disconnect';
import slackTestPost from './src/api/slack/testPost';
import bodyParser from 'body-parser';
import slackSlash from './src/api/slack/slash';
import getAdvancedInfo from './api/getAdvancedInfo';
import appHealth from './api/appHealth';
import { incrementApiCalls, incrementFailedCalls } from './metrics/appMetrics';
import userCreatedWebhook from './api/webhooks/userCreated';
import stripeRouter from './routes/stripe';
import trackingRouter from './api/tracking';
// Boot REX MCP server immediately so it's ready in Railway prod
import './src/rex/server';
import { attachTeam } from './middleware/teamContext';
import { messageScheduler } from './workers/messageScheduler';

declare module 'express-list-endpoints';

const app = express();
const PORT = process.env.PORT || 8080;

// Health check route (before CORS)
app.get('/health', (_, res) => res.json({ ok: true }));

// Configure CORS before routes
const allowed = [
  'https://thehirepilot.com',
  'https://www.thehirepilot.com',
  'https://hirepilot.vercel.app',
  'chrome-extension://hocopaaojddfommlkiegnflimmmppbnk',  // HirePilot Chrome Extension
  /^chrome-extension:\/\/.*$/  // Allow any Chrome extension for development
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const isAllowed = allowed.some(allowedOrigin => 
      typeof allowedOrigin === 'string' 
        ? allowedOrigin === origin 
        : allowedOrigin.test(origin)
    );
    cb(null, isAllowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-user-id',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Pre-flight for all routes
app.options('*', cors());

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    headers: req.headers,
    query: req.query,
    body: req.body
  });
  if (req.path.startsWith('/api')) incrementApiCalls();
  next();
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// At the top, after other env vars
const APOLLO_AUTH_URL = process.env.APOLLO_AUTH_URL || 'https://developer.apollo.io/oauth/authorize';

// DEBUG: confirm env var presence at startup
console.log('ENV SUPER_ADMIN_APOLLO_API_KEY present?', Boolean(process.env.SUPER_ADMIN_APOLLO_API_KEY));

// Debug logging for route mounting
console.log('Mounting routes...');

// Routes
app.post('/api/sendSlackNotification', sendSlackNotification);
app.post('/api/saveCampaign', saveCampaign);
app.post('/api/campaigns/:id/launch', launchCampaign);
console.log('generateMessage:', generateMessage);
app.post('/api/generate-message', generateMessage);
app.post('/api/createUser', createUser);
app.post('/api/saveMessage', saveMessage);
app.use('/api/leads', leadsRouter);
app.use('/api/leads/apollo', leadsApolloRouter);
console.table(listEndpoints(app).filter((r: any) => r.path.startsWith('/api/leads')));
app.use('/api/outreach', outreachRouter);
app.get('/api/getCampaigns', getCampaigns);
app.delete('/api/deleteCampaign', deleteCampaign);
app.use('/api/sendgrid', sendgridValidateRouter);
app.use('/api/sendgrid', sendgridSaveRouter);
app.use('/api', sendgridWebhookRouter);
app.use('/api', emailMetricsRouter);
app.use('/api/message', messageRouter);
app.use('/api/phantombuster', phantombusterValidateRouter);
app.use('/api/email', emailTemplatesRouter);
app.use('/api/auth/google', googleAuthRouter);
app.use('/api/linkedin', linkedinSaveCookieRouter);
app.use('/api/linkedin', linkedinCheckCookieRouter);
app.use('/api/campaigns', saveLeadSourceRouter);
app.use('/api/campaigns', leadSourceRouter);
app.use('/api/campaigns', launchDataRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api', apiRouter);
app.use('/api/admin', linkedinSessionAdminRouter);
app.get('/api/advanced-info', getAdvancedInfo);
app.get('/api/health/overview', appHealth);
app.use('/api/user', userRouter);
app.use('/api/phantombuster', runPhantomRouter);
app.use('/api/phantombuster', phantombusterWebhookRouter);
app.use('/api/zapier/phantom', zapierPhantomWebhook);
app.use('/api/phantom', phantomStatusUpdate);
app.use('/api/phantom', phantomPoll);
app.delete('/api/deleteJobRequisitions', deleteJobRequisitions);
app.use('/api/team', teamRouter);
app.use('/api', slackRouter);
app.use('/api/billing', billingRouter);
app.use('/api/cron', cronProcessorRouter);
app.use('/api/admin', adminUsersRouter);
app.get('/api/campaigns/all/performance', (req, res) => {
  (req.params as any).id = 'all';
  return campaignPerformance(req, res);
});
app.post('/api/rex/chat', rexChat);
app.post('/api/rex/tools', rexToolsHandler);
app.post('/api/rex/tools/linkedin_connect', linkedinConnectHandler);
app.post('/api/integrations/slack/enabled', slackToggle);
app.get('/api/slack/connect', slackConnect);
app.get('/api/slack/callback', slackCallback);
app.delete('/api/slack/disconnect', slackDisconnect);
app.post('/api/slack/test-post', slackTestPost);
app.post('/api/slack/slash', slackSlash);
app.post('/webhooks/user-created', userCreatedWebhook);
app.use('/api/stripe', stripeRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api', attachTeam);

// Log all endpoints before starting the server
console.table(
  listEndpoints(app).map((r: any) => ({
    method: r.methods.join(','),
    path: r.path
  }))
);

// Insert a global error handler BEFORE the 404 catch-all (should be near the end of the file)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  incrementFailedCalls();
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// (temporarily removed, will re-add after all routes)

// Apollo OAuth endpoints
app.get('/api/auth/apollo/init', async (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  const redirectUri = `${process.env.BACKEND_URL}/api/auth/apollo/callback`;
  const apolloAuthUrl =
    `https://app.apollo.io/#/oauth/authorize?` +
    `client_id=${process.env.APOLLO_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `state=${user_id}`;

  console.log('🔗 Apollo Auth URL:', apolloAuthUrl);
  res.json({ url: apolloAuthUrl });
});

app.get('/api/auth/apollo/callback', async (req, res) => {
  // Handle explicit Apollo OAuth errors
  if (req.query.error) {
    res.status(400).json({
      error: req.query.error,
      description: req.query.error_message || 'Apollo returned an OAuth error'
    });
    return;
  }

  console.log('⚡ Apollo callback query params:', req.query);
  
  const { code, state: user_id } = req.query;

  if (!code || !user_id) {
    console.log('❌ Missing code or state:', { code, user_id });
    res.status(400).json({
      error: 'Missing code or state',
      details: { code: !!code, state: !!user_id }
    });
    return;
  }

  try {
    // First, clean up any existing Apollo integration
    await supabase
      .from('integrations')
      .delete()
      .eq('user_id', user_id)
      .eq('provider', 'apollo');

    await supabase
      .from('apollo_accounts')
      .delete()
      .eq('user_id', user_id);

    console.log('🔄 Exchanging code for tokens...');
    const tokenResponse = await axios.post(
      'https://app.apollo.io/api/v1/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: process.env.APOLLO_CLIENT_ID!,
        client_secret: process.env.APOLLO_CLIENT_SECRET!,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/apollo/callback`
      })
    );

    console.log('✅ Token exchange successful:', tokenResponse.data);
    // -------------- store tokens -----------------
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const { error: dbError } = await supabase
      .from('user_apollo_tokens')
      .upsert({
        user_id,
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000), // 30 days ahead
        updated_at: new Date()
      });
    if (dbError) throw dbError;
    // ---------------------------------------------

    // -------------- update integrations table -----------------
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert({
        user_id,
        provider: 'apollo',
        status: 'connected',
        connected_at: new Date().toISOString()
      });
    if (integrationError) throw integrationError;
    // ---------------------------------------------------------

    // Redirect to frontend with success flag
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?apollo=connected`);

  } catch (error: any) {
    console.error('❌ Apollo OAuth error:', error.response?.data || error.message);
    res.status(400).json({ 
      error: 'Apollo OAuth failed',
      details: error.response?.data || error.message
    });
    return;
  }
});

// Refresh token endpoint
app.post('/api/auth/apollo/refresh', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }

  try {
    // Get refresh token from Supabase
    const { data: tokens, error } = await supabase
      .from('user_apollo_tokens')
      .select('refresh_token')
      .eq('user_id', user_id)
      .single();

    if (error || !tokens?.refresh_token) {
      throw new Error('No refresh token found');
    }

    // Exchange refresh token for new access token
    const response = await axios.post('https://app.apollo.io/api/v1/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: process.env.APOLLO_CLIENT_ID,
      client_secret: process.env.APOLLO_CLIENT_SECRET
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Update tokens in Supabase
    await supabase
      .from('user_apollo_tokens')
      .upsert({
        user_id,
        access_token,
        refresh_token,
        expires_in,
        updated_at: new Date().toISOString()
      });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Apollo refresh token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Outlook OAuth callback endpoint
app.get('/api/auth/outlook/callback', async (req, res) => {
  console.log('DEBUG: Outlook callback hit', req.query);
  const { code, state: user_id } = req.query;

  if (!code || !user_id) {
    console.log('DEBUG: Missing code or user_id', { code, user_id });
    res.status(400).json({ error: 'Missing code or user_id' });
    return;
  }

  try {
    // Exchange code for tokens with Microsoft
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        code: code as string,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/outlook/callback`,
        grant_type: 'authorization_code',
        scope: 'openid profile email offline_access Mail.Send'
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    console.log('DEBUG: Token response from Microsoft:', tokenResponse.data);

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Upsert into integrations table
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert({
        user_id,
        provider: 'outlook',
        status: 'connected',
        tokens: {
          access_token,
          refresh_token,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
        },
        connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' });

    console.log('DEBUG: Upsert result:', integrationError);

    if (integrationError) throw integrationError;

    // Set up Outlook tracking notifications for email analytics
    try {
      const { OutlookTrackingService } = await import('./services/outlookTrackingService');
      await OutlookTrackingService.setupReplyNotifications(user_id as string);
      console.log('[Outlook OAuth] Outlook tracking notifications set up successfully');
    } catch (trackingError) {
      console.error('[Outlook OAuth] Failed to set up Outlook tracking:', trackingError);
      // Don't fail the OAuth flow if tracking setup fails
    }

    // Redirect to frontend settings page after successful Outlook authentication
    res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?outlook=connected`);
  } catch (error: any) {
    console.error('❌ Outlook OAuth error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Outlook OAuth failed', details: error.response?.data || error.message });
  }
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SendGrid types
interface SendGridSender {
  id: string;
  from_email: string;
  from_name: string;
}

app.post('/api/sendgrid/get-senders', async (req, res) => {
  try {
    // Get user from request body
    const { user_id } = req.body;
    if (!user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get user's SendGrid API key from user_sendgrid_keys table
    const { data: sendgridData, error: sendgridError } = await supabase
      .from('user_sendgrid_keys')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (sendgridError || !sendgridData?.api_key) {
      res.status(400).json({ error: 'SendGrid API key not found' });
      return;
    }

    // Call SendGrid API to get verified senders
    const response = await axios.get('https://api.sendgrid.com/v3/verified_senders', {
      headers: {
        'Authorization': `Bearer ${sendgridData.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('SendGrid API Response:', JSON.stringify(response.data, null, 2));

    // Format the response to match what frontend expects
    const senders = response.data.results.map((sender: SendGridSender) => ({
      id: sender.id,
      email: sender.from_email,
      name: sender.from_name
    }));

    console.log('Formatted senders:', senders);

    // Get current sender from saved data
    const current_sender = sendgridData.default_sender || null;

    res.json({
      senders,
      current_sender
    });
  } catch (error) {
    console.error('Error fetching SendGrid senders:', error);
    res.status(500).json({ error: 'Failed to fetch SendGrid senders' });
  }
});

// Start the server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Start cron jobs
  startCronJobs();

  // Run the reset stuck phantoms job every 10 minutes
  setInterval(resetStuckPhantoms, 10 * 60 * 1000);

  // Run the mark expired cookies job every hour
  setInterval(markExpiredCookies, 60 * 60 * 1000);

  // Run the enrichment worker every 2 minutes
  setInterval(enrichLeads, 2 * 60 * 1000);

  // Run the trial email worker every hour
  setInterval(processTrialEmails, 60 * 60 * 1000);
  // Also run immediately on startup
  processTrialEmails();

  // Start message scheduler
  messageScheduler.start();
});

// 404 handler must be last
app.use('*', (_req, res) => res.status(404).json({ error: 'not_found' }));


