/**
 * Cron Processor API endpoints
 * Provides REST API for managing and triggering cron processor operations
 */

import { Request, Response } from 'express';
import CronProcessor from '../services/puppet/cronProcessor';
import ExecutionHistoryService from '../services/puppet/executionHistoryService';
import os from 'os';

// Global processor instance
let globalCronProcessor: CronProcessor | null = null;

/**
 * Initialize and start the cron processor
 */
export const startCronProcessor = async (req: Request, res: Response) => {
  try {
    if (globalCronProcessor?.running) {
      return res.status(400).json({
        success: false,
        message: 'Cron processor is already running',
        processorId: globalCronProcessor.processorConfig.processorId
      });
    }

    const config = {
      batchSize: req.body.batchSize || 20,
      maxConcurrentJobs: req.body.maxConcurrentJobs || 10,
      timeoutSeconds: req.body.timeoutSeconds || 120,
      enableSlackAlerts: req.body.enableSlackAlerts || false,
      slackWebhookUrl: req.body.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL
    };

    globalCronProcessor = new CronProcessor(config);
    await globalCronProcessor.start();

    const status = await globalCronProcessor.getStatus();

    res.json({
      success: true,
      message: 'Cron processor started successfully',
      processor: status
    });

  } catch (error) {
    console.error('Error starting cron processor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start cron processor',
      error: error.message
    });
  }
};

/**
 * Stop the cron processor
 */
export const stopCronProcessor = async (req: Request, res: Response) => {
  try {
    if (!globalCronProcessor) {
      return res.status(400).json({
        success: false,
        message: 'No cron processor instance found'
      });
    }

    await globalCronProcessor.stop();
    globalCronProcessor = null;

    res.json({
      success: true,
      message: 'Cron processor stopped successfully'
    });

  } catch (error) {
    console.error('Error stopping cron processor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop cron processor',
      error: error.message
    });
  }
};

/**
 * Trigger a single batch processing manually
 */
export const triggerBatchProcessing = async (req: Request, res: Response) => {
  try {
    if (!globalCronProcessor) {
      return res.status(400).json({
        success: false,
        message: 'Cron processor is not running'
      });
    }

    console.log('Manual batch processing triggered via API');
    const result = await globalCronProcessor.processBatch();

    res.json({
      success: true,
      message: 'Batch processing completed',
      result: {
        batchId: result.batchId,
        totalJobs: result.totalJobs,
        successfulJobs: result.successfulJobs,
        failedJobs: result.failedJobs,
        duration: result.duration,
        skippedJobs: result.skippedJobs,
        errors: result.errors.slice(0, 10) // Limit errors in response
      }
    });

  } catch (error) {
    console.error('Error in manual batch processing:', error);
    res.status(500).json({
      success: false,
      message: 'Batch processing failed',
      error: error.message
    });
  }
};

/**
 * Get cron processor status
 */
export const getCronProcessorStatus = async (req: Request, res: Response) => {
  try {
    if (!globalCronProcessor) {
      return res.json({
        success: true,
        isRunning: false,
        message: 'No cron processor instance'
      });
    }

    const status = await globalCronProcessor.getStatus();
    const healthCheck = await globalCronProcessor.healthCheck();

    res.json({
      success: true,
      isRunning: globalCronProcessor.running,
      status,
      health: healthCheck
    });

  } catch (error) {
    console.error('Error getting processor status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get processor status',
      error: error.message
    });
  }
};

/**
 * Get execution history and metrics
 */
export const getExecutionMetrics = async (req: Request, res: Response) => {
  try {
    const historyService = new ExecutionHistoryService();

    const query = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      jobType: req.query.jobType as string,
      userId: req.query.userId as string,
      outcome: req.query.outcome as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    const [history, metrics, batchMetrics, errorAnalysis] = await Promise.all([
      historyService.getExecutionHistory(query),
      historyService.getExecutionMetrics(query),
      historyService.getBatchMetrics(query),
      historyService.getErrorAnalysis(query)
    ]);

    res.json({
      success: true,
      data: {
        history,
        metrics,
        batchMetrics,
        errorAnalysis
      }
    });

  } catch (error) {
    console.error('Error getting execution metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get execution metrics',
      error: error.message
    });
  }
};

/**
 * Get performance insights
 */
export const getPerformanceInsights = async (req: Request, res: Response) => {
  try {
    const historyService = new ExecutionHistoryService();

    const query = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      jobType: req.query.jobType as string,
      userId: req.query.userId as string
    };

    const insights = await historyService.getPerformanceInsights(query);

    res.json({
      success: true,
      insights
    });

  } catch (error) {
    console.error('Error getting performance insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance insights',
      error: error.message
    });
  }
};

/**
 * Health check endpoint for monitoring
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      processor: {
        running: globalCronProcessor?.running || false,
        processorId: globalCronProcessor?.processorConfig?.processorId || null
      }
    };

    if (globalCronProcessor) {
      const processorHealth = await globalCronProcessor.healthCheck();
      health.processor = {
        ...health.processor,
        ...processorHealth
      };
      
      if (!processorHealth.healthy) {
        health.status = 'unhealthy';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * Webhook endpoint for automated cron triggering
 * Can be called by external cron services, Supabase Edge Functions, etc.
 */
export const webhookTrigger = async (req: Request, res: Response) => {
  try {
    // Verify webhook secret if provided
    const webhookSecret = process.env.CRON_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
      if (providedSecret !== webhookSecret) {
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook secret'
        });
      }
    }

    if (!globalCronProcessor) {
      // Auto-start processor if not running
      const config = {
        batchSize: 20,
        maxConcurrentJobs: 10,
        timeoutSeconds: 120,
        enableSlackAlerts: process.env.ENABLE_SLACK_ALERTS === 'true',
        slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
      };

      globalCronProcessor = new CronProcessor(config);
      await globalCronProcessor.start();
      
      console.log('Auto-started cron processor for webhook trigger');
    }

    const result = await globalCronProcessor.processBatch();

    // Return minimal response for webhook
    res.json({
      success: true,
      batchId: result.batchId,
      processed: result.totalJobs,
      successful: result.successfulJobs,
      failed: result.failedJobs,
      duration: result.duration
    });

    console.log(`Webhook triggered batch processing: ${result.totalJobs} jobs, ${result.successfulJobs} successful`);

  } catch (error) {
    console.error('Webhook trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get real-time job queue status
 */
export const getJobQueueStatus = async (req: Request, res: Response) => {
  try {
    if (!globalCronProcessor) {
      return res.status(400).json({
        success: false,
        message: 'Cron processor is not running'
      });
    }

    const queueStats = await globalCronProcessor.batchJobLoader.getJobQueueStats();
    const executingStats = await globalCronProcessor.batchJobLoader.getExecutingJobsStatus();
    const concurrencyStats = await globalCronProcessor.concurrencyManagerInstance.getConcurrencyStats();

    res.json({
      success: true,
      queue: queueStats,
      executing: executingStats,
      concurrency: concurrencyStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting job queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job queue status',
      error: error.message
    });
  }
};

/**
 * Admin endpoint to reset stuck jobs manually
 */
export const resetStuckJobs = async (req: Request, res: Response) => {
  try {
    const timeoutMinutes = req.body.timeoutMinutes || 5;

    let resetCount = 0;
    if (globalCronProcessor) {
      resetCount = await globalCronProcessor.batchJobLoader.resetStuckJobs(timeoutMinutes);
    } else {
      // Reset stuck jobs even without processor running
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data } = await supabase.rpc('reset_stuck_jobs', {
        p_timeout_minutes: timeoutMinutes
      });

      resetCount = data || 0;
    }

    res.json({
      success: true,
      message: `Reset ${resetCount} stuck jobs`,
      resetCount,
      timeoutMinutes
    });

  } catch (error) {
    console.error('Error resetting stuck jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset stuck jobs',
      error: error.message
    });
  }
};

/**
 * Get processor configuration
 */
export const getProcessorConfig = async (req: Request, res: Response) => {
  try {
    if (!globalCronProcessor) {
      return res.json({
        success: true,
        isRunning: false,
        config: null
      });
    }

    res.json({
      success: true,
      isRunning: globalCronProcessor.running,
      config: globalCronProcessor.processorConfig
    });

  } catch (error) {
    console.error('Error getting processor config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get processor config',
      error: error.message
    });
  }
};

/**
 * Update processor configuration (requires restart)
 */
export const updateProcessorConfig = async (req: Request, res: Response) => {
  try {
    const wasRunning = globalCronProcessor?.running || false;

    // Stop existing processor if running
    if (globalCronProcessor) {
      await globalCronProcessor.stop();
    }

    // Create new processor with updated config
    const newConfig = {
      batchSize: req.body.batchSize || 20,
      maxConcurrentJobs: req.body.maxConcurrentJobs || 10,
      timeoutSeconds: req.body.timeoutSeconds || 120,
      enableSlackAlerts: req.body.enableSlackAlerts || false,
      slackWebhookUrl: req.body.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL,
      heartbeatIntervalMs: req.body.heartbeatIntervalMs || 30000,
      stuckJobTimeoutMinutes: req.body.stuckJobTimeoutMinutes || 5
    };

    globalCronProcessor = new CronProcessor(newConfig);

    // Restart if it was running before
    if (wasRunning) {
      await globalCronProcessor.start();
    }

    res.json({
      success: true,
      message: 'Processor configuration updated',
      config: globalCronProcessor.processorConfig,
      restarted: wasRunning
    });

  } catch (error) {
    console.error('Error updating processor config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update processor config',
      error: error.message
    });
  }
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (globalCronProcessor) {
    try {
      await globalCronProcessor.stop();
      console.log('Cron processor stopped gracefully');
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (globalCronProcessor) {
    try {
      await globalCronProcessor.stop();
      console.log('Cron processor stopped gracefully');
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
    }
  }
  process.exit(0);
}); 