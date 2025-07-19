/**
 * ConcurrencyManager - Handles job concurrency control and locking
 * Prevents duplicate job execution and enforces per-user limits
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ConcurrencyLock {
  id: string;
  lockKey: string;
  lockType: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  currentCount: number;
  maxCount: number;
  metadata?: any;
}

export interface ConcurrencyConfig {
  maxGlobalConcurrentJobs: number;
  maxUserConcurrentJobs: number;
  defaultLockTimeoutSeconds: number;
  lockCleanupIntervalMs: number;
}

export class ConcurrencyManager {
  private processorId: string;
  private config: ConcurrencyConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(processorId: string, config: Partial<ConcurrencyConfig> = {}) {
    this.processorId = processorId;
    this.config = {
      maxGlobalConcurrentJobs: 50,
      maxUserConcurrentJobs: 2,
      defaultLockTimeoutSeconds: 300, // 5 minutes
      lockCleanupIntervalMs: 60000, // 1 minute
      ...config
    };

    // Start periodic cleanup
    this.startCleanupInterval();
  }

  /**
   * Check if a user can execute more jobs
   */
  async canUserExecuteJob(userId: string): Promise<boolean> {
    try {
      const { data: currentJobs, error } = await supabase
        .from('puppet_jobs')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['pending', 'in_progress'])
        .not('executing_at', 'is', null);

      if (error) {
        console.error('Error checking user concurrency:', error);
        return false;
      }

      const currentCount = currentJobs?.length || 0;
      return currentCount < this.config.maxUserConcurrentJobs;
    } catch (error) {
      console.error('Error in canUserExecuteJob:', error);
      return false;
    }
  }

  /**
   * Check global system concurrency
   */
  async canSystemExecuteMoreJobs(): Promise<boolean> {
    try {
      const { data: executingJobs, error } = await supabase
        .from('puppet_jobs')
        .select('id')
        .eq('status', 'in_progress')
        .not('executing_at', 'is', null);

      if (error) {
        console.error('Error checking global concurrency:', error);
        return false;
      }

      const currentCount = executingJobs?.length || 0;
      return currentCount < this.config.maxGlobalConcurrentJobs;
    } catch (error) {
      console.error('Error in canSystemExecuteMoreJobs:', error);
      return false;
    }
  }

  /**
   * Acquire a concurrency lock
   */
  async acquireLock(
    lockKey: string,
    lockType: string,
    maxCount: number = 1,
    timeoutSeconds?: number
  ): Promise<boolean> {
    const timeout = timeoutSeconds || this.config.defaultLockTimeoutSeconds;
    const expiresAt = new Date(Date.now() + timeout * 1000);
    const lockId = uuidv4();

    try {
      // Try to acquire or update existing lock
      const { data, error } = await supabase.rpc('acquire_concurrency_lock', {
        p_lock_key: lockKey,
        p_lock_type: lockType,
        p_locked_by: this.processorId,
        p_expires_at: expiresAt.toISOString(),
        p_max_count: maxCount,
        p_metadata: { lockId, processorId: this.processorId }
      });

      if (error) {
        console.error('Error acquiring lock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error in acquireLock:', error);
      return false;
    }
  }

  /**
   * Release a concurrency lock
   */
  async releaseLock(lockKey: string, lockType: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('puppet_job_concurrency_locks')
        .delete()
        .eq('lock_key', lockKey)
        .eq('lock_type', lockType)
        .eq('locked_by', this.processorId);

      if (error) {
        console.error('Error releasing lock:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in releaseLock:', error);
      return false;
    }
  }

  /**
   * Get current lock status
   */
  async getLockStatus(lockKey: string, lockType: string): Promise<ConcurrencyLock | null> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_concurrency_locks')
        .select('*')
        .eq('lock_key', lockKey)
        .eq('lock_type', lockType)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        lockKey: data.lock_key,
        lockType: data.lock_type,
        lockedBy: data.locked_by,
        lockedAt: new Date(data.locked_at),
        expiresAt: new Date(data.expires_at),
        currentCount: data.current_count,
        maxCount: data.max_count,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('Error in getLockStatus:', error);
      return null;
    }
  }

  /**
   * Check if jobs can be processed with current concurrency
   */
  async checkConcurrencyLimits(userIds: string[]): Promise<{
    canProcessGlobally: boolean;
    allowedUserIds: string[];
    blockedUserIds: string[];
  }> {
    const canProcessGlobally = await this.canSystemExecuteMoreJobs();
    
    if (!canProcessGlobally) {
      return {
        canProcessGlobally: false,
        allowedUserIds: [],
        blockedUserIds: userIds
      };
    }

    const allowedUserIds: string[] = [];
    const blockedUserIds: string[] = [];

    // Check each user's concurrency limit
    for (const userId of userIds) {
      const canExecute = await this.canUserExecuteJob(userId);
      if (canExecute) {
        allowedUserIds.push(userId);
      } else {
        blockedUserIds.push(userId);
      }
    }

    return {
      canProcessGlobally: true,
      allowedUserIds,
      blockedUserIds
    };
  }

  /**
   * Acquire batch processing lock
   */
  async acquireBatchLock(batchId: string, expectedJobCount: number): Promise<boolean> {
    const lockKey = `batch:${batchId}`;
    return this.acquireLock(lockKey, 'batch_processing', 1, 600); // 10 minute timeout
  }

  /**
   * Release batch processing lock
   */
  async releaseBatchLock(batchId: string): Promise<boolean> {
    const lockKey = `batch:${batchId}`;
    return this.releaseLock(lockKey, 'batch_processing');
  }

  /**
   * Acquire user concurrency lock
   */
  async acquireUserLock(userId: string): Promise<boolean> {
    const lockKey = `user:${userId}`;
    return this.acquireLock(lockKey, 'user_limit', this.config.maxUserConcurrentJobs, 300);
  }

  /**
   * Release user concurrency lock
   */
  async releaseUserLock(userId: string): Promise<boolean> {
    const lockKey = `user:${userId}`;
    return this.releaseLock(lockKey, 'user_limit');
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('puppet_job_concurrency_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Error cleaning up expired locks:', error);
        return 0;
      }

      const cleanedCount = data?.length || 0;
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired concurrency locks`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error in cleanupExpiredLocks:', error);
      return 0;
    }
  }

  /**
   * Get concurrency statistics
   */
  async getConcurrencyStats(): Promise<{
    globalExecutingJobs: number;
    totalActiveLocks: number;
    locksByType: Record<string, number>;
    userConcurrencyStats: Array<{ userId: string; activeJobs: number }>;
  }> {
    try {
      // Get executing jobs count
      const { data: executingJobs } = await supabase
        .from('puppet_jobs')
        .select('user_id')
        .eq('status', 'in_progress')
        .not('executing_at', 'is', null);

      // Get active locks
      const { data: activeLocks } = await supabase
        .from('puppet_job_concurrency_locks')
        .select('lock_type')
        .gt('expires_at', new Date().toISOString());

      // Aggregate stats
      const globalExecutingJobs = executingJobs?.length || 0;
      const totalActiveLocks = activeLocks?.length || 0;
      
      const locksByType: Record<string, number> = {};
      activeLocks?.forEach(lock => {
        locksByType[lock.lock_type] = (locksByType[lock.lock_type] || 0) + 1;
      });

      const userJobCounts: Record<string, number> = {};
      executingJobs?.forEach(job => {
        userJobCounts[job.user_id] = (userJobCounts[job.user_id] || 0) + 1;
      });

      const userConcurrencyStats = Object.entries(userJobCounts).map(([userId, activeJobs]) => ({
        userId,
        activeJobs
      }));

      return {
        globalExecutingJobs,
        totalActiveLocks,
        locksByType,
        userConcurrencyStats
      };
    } catch (error) {
      console.error('Error getting concurrency stats:', error);
      return {
        globalExecutingJobs: 0,
        totalActiveLocks: 0,
        locksByType: {},
        userConcurrencyStats: []
      };
    }
  }

  /**
   * Start periodic cleanup of expired locks
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredLocks();
    }, this.config.lockCleanupIntervalMs);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Destroy the concurrency manager
   */
  async destroy(): Promise<void> {
    this.stopCleanup();
    
    // Release all locks held by this processor
    try {
      await supabase
        .from('puppet_job_concurrency_locks')
        .delete()
        .eq('locked_by', this.processorId);
    } catch (error) {
      console.error('Error releasing locks on destroy:', error);
    }
  }
}

// Database function for atomic lock acquisition (add to migration)
export const ACQUIRE_LOCK_FUNCTION = `
CREATE OR REPLACE FUNCTION acquire_concurrency_lock(
  p_lock_key TEXT,
  p_lock_type TEXT,
  p_locked_by TEXT,
  p_expires_at TIMESTAMPTZ,
  p_max_count INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_lock puppet_job_concurrency_locks%ROWTYPE;
  v_current_count INTEGER;
BEGIN
  -- Check for existing lock
  SELECT * INTO v_current_lock
  FROM puppet_job_concurrency_locks
  WHERE lock_key = p_lock_key 
    AND lock_type = p_lock_type
    AND expires_at > NOW();
  
  IF FOUND THEN
    -- Check if we can increment the count
    IF v_current_lock.current_count < v_current_lock.max_count THEN
      -- Increment count
      UPDATE puppet_job_concurrency_locks
      SET 
        current_count = current_count + 1,
        expires_at = GREATEST(expires_at, p_expires_at),
        metadata = metadata || p_metadata
      WHERE lock_key = p_lock_key 
        AND lock_type = p_lock_type;
      
      RETURN TRUE;
    ELSE
      -- Lock is at max capacity
      RETURN FALSE;
    END IF;
  ELSE
    -- Create new lock
    INSERT INTO puppet_job_concurrency_locks (
      lock_key,
      lock_type,
      locked_by,
      locked_at,
      expires_at,
      current_count,
      max_count,
      metadata
    ) VALUES (
      p_lock_key,
      p_lock_type,
      p_locked_by,
      NOW(),
      p_expires_at,
      1,
      p_max_count,
      p_metadata
    );
    
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;
`;

export default ConcurrencyManager; 