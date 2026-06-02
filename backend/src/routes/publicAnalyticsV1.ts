import express, { Request, Response, NextFunction } from 'express';
import { requireApiKeyScopes } from '../middleware/requireApiKeyScopes';
import campaignPerformance from '../../api/campaignPerformance';
import analyticsTimeSeries from '../../api/analyticsTimeSeries';
import getCampaigns from '../../api/getCampaigns';
import campaignReplies from '../../api/campaignReplies';

/**
 * Public V1 Analytics API (API key required).
 *
 * Exposes the same campaign outreach data shown on the in-app Campaign
 * Performance / Analytics page to external integrations. Authentication is via
 * an `analytics:read`-scoped API key (X-API-Key header or `hp_*` Bearer token).
 *
 * All handlers below run AFTER requireApiKeyScopes, which attaches req.user.id.
 * They internally call resolveAnalyticsScope(), so team analytics-sharing
 * settings are still enforced exactly as they are in the dashboard.
 */
const router = express.Router();

router.use(requireApiKeyScopes(['analytics:read']));

// GET /v1/analytics/campaigns
// List the caller's campaigns (id, name, status, lead counts, ...).
router.get('/campaigns', getCampaigns);

// GET /v1/analytics/campaigns/:id/performance
// Summary outreach metrics for a campaign (or `all`):
// { sent, opens, open_rate, replies, reply_rate, conversions,
//   conversion_rate, total_leads, converted_candidates }
router.get('/campaigns/:id/performance', campaignPerformance);

// GET /v1/analytics/campaigns/all/performance
// Aggregate metrics across all of the caller's campaigns.
router.get('/campaigns/all/performance', (req: Request, res: Response) => {
  req.params.id = 'all';
  return campaignPerformance(req, res);
});

// GET /v1/analytics/campaigns/:id/time-series?time_range=30d|90d|1y
// Time-bucketed outreach metrics for charting. The underlying handler reads
// `campaign_id` from the query string, so we bridge the path param across.
router.get('/campaigns/:id/time-series', (req: Request, res: Response) => {
  req.query.campaign_id = req.params.id;
  return analyticsTimeSeries(req, res);
});

// GET /v1/analytics/time-series?campaign_id=all|<uuid>&time_range=30d|90d|1y
router.get('/time-series', analyticsTimeSeries);

// GET /v1/analytics/campaigns/:id/replies?limit=&offset=&classification=
// The actual inbound reply messages (subject/body/lead) behind the reply
// rate. Use `all` as :id to pull replies across every campaign.
router.get('/campaigns/:id/replies', campaignReplies);

export default router;
