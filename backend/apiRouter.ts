import { Router, Response } from "express";
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
import { triggerLinkedInCampaign, pollPhantomBusterResults, debugPhantomBusterWebhook, debugSearchLeads } from './api/campaign';
import campaignPerformance from './api/campaignPerformance';
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
import webhooksRouter from './api/webhooksRouter';
import bulkScheduleMessages from './api/bulkScheduleMessages';
import testBackfill from './api/testBackfill';
import debugMessageCenter from './api/debugMessageCenter';
import testAnalytics from './api/testAnalytics';
import testGmailConnection from './api/testGmailConnection';
import testLeadStatusUpdate from './api/testLeadStatusUpdate';
import debugCampaignMetrics from './api/debugCampaignMetrics';
import backfillCampaignAttribution from './api/backfillCampaignAttribution';

const router = Router();

export type ApiHandler = (req: ApiRequest, res: Response) => Promise<void>;

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

// Team management routes
router.use('/team', requireAuth, teamRouter);

router.post('/campaigns/:id/launch', launchCampaign);

// LinkedIn trigger endpoint for Sales Navigator campaigns
router.post('/campaigns/linkedin/trigger', requireAuth, triggerLinkedInCampaign);
router.get('/campaigns/executions/:executionId/poll', requireAuth, pollPhantomBusterResults);
router.post('/campaigns/executions/:executionId/debug-webhook', requireAuth, debugPhantomBusterWebhook);
router.get('/campaigns/debug/search-leads', requireAuth, debugSearchLeads);

// Add campaign performance endpoint
router.get('/campaigns/:id/performance', campaignPerformance);

// Add user performance endpoint
router.get('/users/:id/performance', userPerformance);

// Add analytics time series endpoint
router.get('/analytics/time-series', analyticsTimeSeries);

// Add schedule mass message endpoint
router.post('/scheduleMassMessage', scheduleMassMessage);

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

router.use('/webhooks', webhooksRouter);

router.post('/messages/bulk-schedule', requireAuth, bulkScheduleMessages);

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

// Debug campaign metrics attribution
router.get('/debug/campaign-metrics', debugCampaignMetrics);

// Backfill campaign attribution for messages and email_events
router.post('/backfill/campaign-attribution', backfillCampaignAttribution);

export default router;
