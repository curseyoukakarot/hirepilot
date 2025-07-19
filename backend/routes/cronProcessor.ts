/**
 * Cron Processor Routes
 * Express router configuration for cron processor API endpoints
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  startCronProcessor,
  stopCronProcessor,
  triggerBatchProcessing,
  getCronProcessorStatus,
  getExecutionMetrics,
  getPerformanceInsights,
  healthCheck,
  webhookTrigger,
  getJobQueueStatus,
  resetStuckJobs,
  getProcessorConfig,
  updateProcessorConfig
} from '../api/cronProcessor';

const router = Router();

// Public endpoints (no auth required)
router.get('/health', healthCheck);
router.post('/webhook', webhookTrigger); // Webhook endpoint for external cron triggers

// Protected endpoints (require authentication)
router.use(authMiddleware); // Apply auth middleware to all routes below

// Processor management
router.post('/start', startCronProcessor);
router.post('/stop', stopCronProcessor);
router.post('/trigger', triggerBatchProcessing);
router.get('/status', getCronProcessorStatus);
router.get('/config', getProcessorConfig);
router.put('/config', updateProcessorConfig);

// Queue and job management
router.get('/queue', getJobQueueStatus);
router.post('/reset-stuck-jobs', resetStuckJobs);

// Analytics and metrics
router.get('/metrics', getExecutionMetrics);
router.get('/insights', getPerformanceInsights);

export default router; 