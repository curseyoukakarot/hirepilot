import { supabase } from '../lib/supabase';
import axios from 'axios';

interface EnrichmentJob {
  id: string;
  lead_id: string;
  user_id: string;
  profile_url: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

class EnrichmentProcessor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 60 * 1000; // 60 seconds
  private readonly BATCH_SIZE = 5; // Process up to 5 jobs concurrently
  private readonly API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:8080';

  /**
   * Start the enrichment processor
   */
  start(): void {
    if (this.isRunning) {
      console.log('[EnrichmentProcessor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[EnrichmentProcessor] Starting enrichment job processor...');
    
    // Process immediately on start
    this.processJobs().catch(error => {
      console.error('[EnrichmentProcessor] Initial processing failed:', error);
    });

    // Set up recurring interval
    this.intervalId = setInterval(() => {
      this.processJobs().catch(error => {
        console.error('[EnrichmentProcessor] Scheduled processing failed:', error);
      });
    }, this.POLL_INTERVAL);

    console.log(`[EnrichmentProcessor] Started with ${this.POLL_INTERVAL / 1000}s interval`);
  }

  /**
   * Stop the enrichment processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[EnrichmentProcessor] Stopped enrichment job processor');
  }

  /**
   * Process queued enrichment jobs
   */
  private async processJobs(): Promise<void> {
    try {
      console.log('[EnrichmentProcessor] Checking for queued enrichment jobs...');

      // Get queued jobs ordered by priority and creation time
      const { data: queuedJobs, error } = await supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('status', 'queued')
        .lt('attempts', 3) // Only process jobs that haven't exceeded max attempts
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(this.BATCH_SIZE);

      if (error) {
        console.error('[EnrichmentProcessor] Error fetching queued jobs:', error);
        return;
      }

      if (!queuedJobs || queuedJobs.length === 0) {
        console.log('[EnrichmentProcessor] No queued jobs found');
        return;
      }

      console.log(`[EnrichmentProcessor] Found ${queuedJobs.length} queued jobs`);

      // Process jobs concurrently
      const processingPromises = queuedJobs.map(job => this.processJob(job));
      await Promise.allSettled(processingPromises);

      console.log(`[EnrichmentProcessor] Completed processing batch of ${queuedJobs.length} jobs`);

    } catch (error) {
      console.error('[EnrichmentProcessor] Error in processJobs:', error);
    }
  }

  /**
   * Process a single enrichment job
   */
  private async processJob(job: EnrichmentJob): Promise<void> {
    const jobId = job.id;
    const startTime = Date.now();

    try {
      console.log(`[EnrichmentProcessor] Processing job ${jobId} for lead ${job.lead_id}`);

      // Mark job as processing
      await this.updateJobStatus(jobId, 'processing', {
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1
      });

      // Call the enrichment API endpoint
      const enrichmentResponse = await this.callEnrichmentAPI(job.lead_id, job.profile_url);

      if (enrichmentResponse.success) {
        // Mark job as completed
        await this.updateJobStatus(jobId, 'completed', {
          completed_at: new Date().toISOString(),
          enrichment_source: enrichmentResponse.enrichment?.source,
          enrichment_data: enrichmentResponse.enrichment?.data || null
        });

        console.log(`[EnrichmentProcessor] Job ${jobId} completed successfully via ${enrichmentResponse.enrichment?.source} in ${Date.now() - startTime}ms`);
      } else {
        // Mark job as failed
        await this.updateJobStatus(jobId, 'failed', {
          completed_at: new Date().toISOString(),
          error_message: enrichmentResponse.error || 'Enrichment failed'
        });

        console.log(`[EnrichmentProcessor] Job ${jobId} failed: ${enrichmentResponse.error}`);
      }

    } catch (error: any) {
      console.error(`[EnrichmentProcessor] Error processing job ${jobId}:`, error);

      // Check if we should retry or mark as failed
      const newAttempts = job.attempts + 1;
      if (newAttempts >= job.max_attempts) {
        // Mark as failed after max attempts
        await this.updateJobStatus(jobId, 'failed', {
          completed_at: new Date().toISOString(),
          error_message: error.message || 'Max attempts exceeded'
        });
        console.log(`[EnrichmentProcessor] Job ${jobId} failed after ${newAttempts} attempts`);
      } else {
        // Reset to queued for retry with exponential backoff
        const retryDelay = Math.min(Math.pow(2, newAttempts) * 60000, 30 * 60000); // Max 30 min delay
        const retryAt = new Date(Date.now() + retryDelay);
        
        await this.updateJobStatus(jobId, 'queued', {
          error_message: `Attempt ${newAttempts} failed: ${error.message}. Retry at ${retryAt.toISOString()}`,
          attempts: newAttempts
        });
        
        console.log(`[EnrichmentProcessor] Job ${jobId} queued for retry ${newAttempts}/${job.max_attempts} at ${retryAt.toISOString()}`);
      }
    }
  }

  /**
   * Call the enrichment API endpoint
   */
  private async callEnrichmentAPI(leadId: string, profileUrl: string): Promise<any> {
    try {
      const response = await axios.post(`${this.API_BASE_URL}/api/leads/enrich`, {
        leadId,
        profileUrl
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true' // Skip auth for internal requests
        },
        timeout: 120000 // 2 minute timeout for enrichment
      });

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Enrichment API error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Enrichment API timeout');
      } else {
        throw new Error(`Enrichment API request failed: ${error.message}`);
      }
    }
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(jobId: string, status: string, additionalFields: Record<string, any> = {}): Promise<void> {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalFields
    };

    const { error } = await supabase
      .from('enrichment_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      console.error(`[EnrichmentProcessor] Error updating job ${jobId} status to ${status}:`, error);
      throw error;
    }
  }

  /**
   * Get processor statistics
   */
  async getStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    isRunning: boolean;
  }> {
    const { data: stats, error } = await supabase
      .from('enrichment_jobs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

    if (error) {
      console.error('[EnrichmentProcessor] Error fetching stats:', error);
      return {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        isRunning: this.isRunning
      };
    }

    const statusCounts = (stats || []).reduce((acc: any, job: any) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    return {
      queued: statusCounts.queued || 0,
      processing: statusCounts.processing || 0,
      completed: statusCounts.completed || 0,
      failed: statusCounts.failed || 0,
      isRunning: this.isRunning
    };
  }

  /**
   * Queue a new enrichment job
   */
  static async queueJob(leadId: string, userId: string, profileUrl: string, priority: number = 5): Promise<string> {
    const { data, error } = await supabase
      .from('enrichment_jobs')
      .insert({
        lead_id: leadId,
        user_id: userId,
        profile_url: profileUrl,
        status: 'queued',
        priority,
        attempts: 0,
        max_attempts: 3
      })
      .select('id')
      .single();

    if (error) {
      console.error('[EnrichmentProcessor] Error queueing job:', error);
      throw new Error(`Failed to queue enrichment job: ${error.message}`);
    }

    console.log(`[EnrichmentProcessor] Queued enrichment job ${data.id} for lead ${leadId}`);
    return data.id;
  }

  /**
   * Clean up old completed/failed jobs (optional maintenance)
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from('enrichment_jobs')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('updated_at', cutoffDate.toISOString());

    if (error) {
      console.error('[EnrichmentProcessor] Error cleaning up old jobs:', error);
    } else {
      console.log(`[EnrichmentProcessor] Cleaned up jobs older than ${daysOld} days`);
    }
  }
}

// Export singleton instance
export const enrichmentProcessor = new EnrichmentProcessor();

// Export the class as well for static method access
export { EnrichmentProcessor };

// Auto-start processor if this file is imported
if (process.env.NODE_ENV !== 'test') {
  enrichmentProcessor.start();
}

export default enrichmentProcessor; 