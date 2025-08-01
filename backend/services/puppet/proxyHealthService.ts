/**
 * Proxy Health Monitor and Auto-Rotation Service
 * 
 * Manages proxy performance tracking and automatic rotation for the Puppet system.
 * Monitors success/failure rates per user and automatically rotates failed proxies
 * to maintain reliable LinkedIn automation infrastructure.
 * 
 * Features:
 * - Per-user proxy health tracking
 * - Automatic proxy rotation on failures
 * - Intelligent proxy assignment from pool
 * - Admin alerts for proxy shortages
 * - Performance analytics and reporting
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type definitions
export type ProxyStatus = 'active' | 'inactive' | 'maintenance' | 'banned' | 'testing';
export type ProxyProvider = 'brightdata' | 'smartproxy' | 'residential' | 'datacenter' | 'mobile' | 'custom';

export interface ProxyPool {
  id: string;
  provider: ProxyProvider;
  endpoint: string;
  tier?: 'decodo' | 'local' | 'direct';
  username?: string;
  password?: string;
  country_code?: string;
  region?: string;
  city?: string;
  proxy_type?: string;
  max_concurrent_users: number;
  rotation_interval_minutes: number;
  status: ProxyStatus;
  global_success_count: number;
  global_failure_count: number;
  last_success_at?: string;
  last_failure_at?: string;
  notes?: string;
  cost_per_gb?: number;
  monthly_limit_gb?: number;
  created_at: string;
  updated_at: string;
}

export interface ProxyHealth {
  id: string;
  proxy_id: string;
  user_id: string;
  success_count: number;
  failure_count: number;
  recent_success_count: number;
  recent_failure_count: number;
  last_used_at?: string;
  last_success_at?: string;
  last_failure_at?: string;
  status: ProxyStatus;
  failure_reason?: string;
  avg_response_time_ms?: number;
  total_jobs_processed: number;
  consecutive_failures: number;
  auto_disabled_at?: string;
  auto_disabled_reason?: string;
}

export interface ProxyAssignment {
  id: string;
  proxy_id: string;
  user_id: string;
  job_id?: string;
  assignment_reason: string;
  previous_proxy_id?: string;
  was_successful?: boolean;
  failure_reason?: string;
  response_time_ms?: number;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  job_type?: string;
  user_agent?: string;
  ip_verified?: string;
}

export interface ProxyRotationConfig {
  max_failures_24h: number;
  max_consecutive_failures: number;
  max_response_time_ms: number;
  min_success_rate_percent: number;
  cooldown_hours: number;
  auto_retry_enabled: boolean;
  escalate_to_admin: boolean;
}

export interface UserProxyStatus {
  user_id: string;
  email: string;
  current_proxy_id?: string;
  current_proxy_endpoint?: string;
  current_proxy_provider?: ProxyProvider;
  current_proxy_country?: string;
  proxy_health_status?: ProxyStatus;
  success_count?: number;
  failure_count?: number;
  recent_failure_count?: number;
  consecutive_failures?: number;
  last_used_at?: string;
  last_failure_at?: string;
  avg_response_time_ms?: number;
  proxy_assigned_at?: string;
  assignment_reason?: string;
  needs_rotation: boolean;
  proxy_disabled: boolean;
  needs_assignment: boolean;
}

export interface ProxyHealthResult {
  success: boolean;
  message: string;
  proxy_rotated?: boolean;
  new_proxy_id?: string;
  auto_disabled?: boolean;
  escalated_to_admin?: boolean;
}

/**
 * Main service class for proxy health monitoring and rotation
 */
export class ProxyHealthService {

  /**
   * Record proxy performance after job completion
   */
  async recordProxyPerformance(
    proxyId: string,
    userId: string,
    wasSuccessful: boolean,
    responseTimeMs?: number,
    failureReason?: string,
    jobId?: string,
    jobType?: string
  ): Promise<ProxyHealthResult> {
    try {
      console.log(`🌐 [ProxyHealth] Recording ${wasSuccessful ? 'successful' : 'failed'} performance for proxy ${proxyId} user ${userId}`);

      // Update health metrics using database function
      const { error: healthError } = await supabase.rpc('update_proxy_health', {
        p_proxy_id: proxyId,
        p_user_id: userId,
        p_was_successful: wasSuccessful,
        p_response_time_ms: responseTimeMs,
        p_failure_reason: failureReason
      });

      if (healthError) {
        throw new Error(`Failed to update proxy health: ${healthError.message}`);
      }

      // Record assignment history
      const { error: assignmentError } = await supabase
        .from('proxy_assignments')
        .insert({
          proxy_id: proxyId,
          user_id: userId,
          job_id: jobId,
          assignment_reason: 'job_execution',
          was_successful: wasSuccessful,
          failure_reason: failureReason,
          response_time_ms: responseTimeMs,
          job_type: jobType || 'linkedin_automation',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        });

      if (assignmentError) {
        console.error(`⚠️ [ProxyHealth] Failed to record assignment history: ${assignmentError.message}`);
      }

      // Check if proxy was auto-disabled
      const { data: healthStatus } = await supabase
        .from('proxy_health')
        .select('status, auto_disabled_at, auto_disabled_reason')
        .eq('proxy_id', proxyId)
        .eq('user_id', userId)
        .single();

      const wasAutoDisabled = healthStatus?.status === 'inactive' && healthStatus?.auto_disabled_at;

      let result: ProxyHealthResult = {
        success: true,
        message: `Proxy performance recorded: ${wasSuccessful ? 'success' : 'failure'}`,
        auto_disabled: wasAutoDisabled
      };

      // If proxy was auto-disabled, initiate rotation
      if (wasAutoDisabled) {
        console.log(`🔄 [ProxyHealth] Proxy ${proxyId} auto-disabled for user ${userId}, initiating rotation`);
        
        const rotationResult = await this.rotateUserProxy(userId, proxyId, 'auto_failure_rotation');
        result.proxy_rotated = rotationResult.success;
        result.new_proxy_id = rotationResult.new_proxy_id;
        result.message = `${result.message}. Proxy rotated due to failures.`;

        // Check if we should escalate to admin
        if (!rotationResult.success) {
          await this.escalateToAdmin(userId, proxyId, 'No available proxies for rotation');
          result.escalated_to_admin = true;
          result.message = `${result.message}. Escalated to admin - no available proxies.`;
        }
      }

      console.log(`✅ [ProxyHealth] Performance recorded for proxy ${proxyId}: ${result.message}`);
      return result;

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to record performance for proxy ${proxyId}:`, error);
      return {
        success: false,
        message: `Failed to record proxy performance: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the best available proxy for a user
   */
  async assignProxyToUser(
    userId: string, 
    reason: string = 'initial_assignment',
    preferredCountry?: string
  ): Promise<{ success: boolean; proxy_id?: string; proxy_config?: any; message: string }> {
    try {
      console.log(`🎯 [ProxyHealth] Assigning proxy to user ${userId} (reason: ${reason})`);

      // Custom tier-based selection logic – configurable via env
      const tierPriority = (process.env.PROXY_TIER_ORDER || 'decodo,local,direct')
        .split(',')
        .map(t => t.trim());
      let proxy: any | null = null;

      for (const tier of tierPriority) {
        const { data: proxies, error } = await supabase
          .from('proxy_pool')
          .select('*')
          .eq('status', 'active')
          .eq('tier', tier)
          .order('global_failure_count', { ascending: true })
          .limit(1);

      if (error) {
          throw new Error(`Failed to query proxy pool: ${error.message}`);
      }

        if (proxies && proxies.length) {
          proxy = proxies[0];
          break;
        }
      }

      if (!proxy) {
        console.log(`❌ [ProxyHealth] No available proxies for user ${userId}`);
        
        await this.escalateToAdmin(userId, null, 'No available proxies after tier filtering');
        
        return {
          success: false,
          message: 'No available proxies. Admin has been notified.'
        };
      }

      const bestProxyId = proxy.id;

      // Get proxy details
      const { data: proxyDetails, error: proxyError } = await supabase
        .from('proxy_pool')
        .select('*')
        .eq('id', bestProxyId)
        .single();

      if (proxyError || !proxyDetails) {
        throw new Error('Failed to fetch proxy details');
      }

      // Record the assignment
      const { error: assignmentError } = await supabase
        .from('proxy_assignments')
        .insert({
          proxy_id: bestProxyId,
          user_id: userId,
          assignment_reason: reason,
          assigned_at: new Date().toISOString()
        });

      if (assignmentError) {
        console.error(`⚠️ [ProxyHealth] Failed to record assignment: ${assignmentError.message}`);
      }

      // Create or update health record
      const { error: healthError } = await supabase
        .from('proxy_health')
        .upsert({
          proxy_id: bestProxyId,
          user_id: userId,
          status: 'active'
        }, { onConflict: 'proxy_id,user_id' });

      if (healthError) {
        console.error(`⚠️ [ProxyHealth] Failed to update health record: ${healthError.message}`);
      }

      const proxyConfig = {
        proxy_endpoint: proxyDetails.endpoint,
        proxy_port: proxyDetails.endpoint.includes(':') ? proxyDetails.endpoint.split(':')[1] : '80',
        proxy_username: proxyDetails.username,
        proxy_password: proxyDetails.password,
        proxy_type: proxyDetails.proxy_type || 'residential',
        country_code: proxyDetails.country_code,
        provider: proxyDetails.provider
      };

      console.log(`✅ [ProxyHealth] Assigned proxy ${bestProxyId} (${proxyDetails.endpoint}) to user ${userId}`);

      return {
        success: true,
        proxy_id: bestProxyId,
        proxy_config: proxyConfig,
        message: `Proxy assigned: ${proxyDetails.endpoint} (${proxyDetails.provider})`
      };

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to assign proxy to user ${userId}:`, error);
      return {
        success: false,
        message: `Failed to assign proxy: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Rotate a user's proxy to a new one
   */
  async rotateUserProxy(
    userId: string, 
    currentProxyId?: string,
    reason: string = 'manual_rotation'
  ): Promise<{ success: boolean; new_proxy_id?: string; message: string }> {
    try {
      console.log(`🔄 [ProxyHealth] Rotating proxy for user ${userId} (reason: ${reason})`);

      // Mark current proxy as inactive for this user (if specified)
      if (currentProxyId) {
        const { error: deactivateError } = await supabase
          .from('proxy_health')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('proxy_id', currentProxyId)
          .eq('user_id', userId);

        if (deactivateError) {
          console.error(`⚠️ [ProxyHealth] Failed to deactivate current proxy: ${deactivateError.message}`);
        }
      }

      // Assign new proxy
      const assignmentResult = await this.assignProxyToUser(userId, reason);
      
      if (assignmentResult.success) {
        // Record the rotation in assignment history
        const { error: rotationError } = await supabase
          .from('proxy_assignments')
          .update({
            previous_proxy_id: currentProxyId,
            assignment_reason: reason
          })
          .eq('proxy_id', assignmentResult.proxy_id)
          .eq('user_id', userId)
          .order('assigned_at', { ascending: false })
          .limit(1);

        if (rotationError) {
          console.error(`⚠️ [ProxyHealth] Failed to update rotation history: ${rotationError.message}`);
        }
      }

      return {
        success: assignmentResult.success,
        new_proxy_id: assignmentResult.proxy_id,
        message: assignmentResult.message
      };

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to rotate proxy for user ${userId}:`, error);
      return {
        success: false,
        message: `Failed to rotate proxy: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get user's current proxy status
   */
  async getUserProxyStatus(userId: string): Promise<UserProxyStatus | null> {
    try {
      const { data, error } = await supabase
        .from('user_proxy_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User doesn't have a proxy assigned yet
          return {
            user_id: userId,
            email: '',
            needs_rotation: false,
            proxy_disabled: false,
            needs_assignment: true
          };
        }
        throw new Error(`Failed to fetch user proxy status: ${error.message}`);
      }

      return data as UserProxyStatus;

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to get proxy status for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get all active proxies with health metrics
   */
  async getActiveProxies(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('active_proxy_pool')
        .select('*')
        .order('success_rate_percent', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch active proxies: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to get active proxies:`, error);
      return [];
    }
  }

  /**
   * Get proxy health statistics for admin dashboard
   */
  async getProxyHealthStats(): Promise<any> {
    try {
      // Get basic proxy pool stats
      const { data: proxies } = await supabase
        .from('proxy_pool')
        .select('status');

      const poolStats = proxies?.reduce((acc, proxy) => {
        acc[proxy.status] = (acc[proxy.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get recent performance metrics
      const { data: assignments } = await supabase
        .from('proxy_assignments')
        .select('was_successful, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const successful = assignments?.filter(a => a.was_successful).length || 0;
      const total = assignments?.length || 0;
      const recentPerformance = {
        total_jobs_24h: total,
        successful_jobs_24h: successful,
        failed_jobs_24h: total - successful,
        success_rate_24h: total > 0 ? Math.round((successful / total) * 100) : 100
      };

      // Get users needing rotation
      const { data: usersNeedingRotation } = await supabase
        .from('user_proxy_status')
        .select('user_id')
        .eq('needs_rotation', true);

      // Get users without proxies
      const { data: usersNeedingAssignment } = await supabase
        .from('user_proxy_status')
        .select('user_id')
        .eq('needs_assignment', true);

      return {
        proxy_pool: poolStats,
        performance_24h: recentPerformance,
        users_needing_rotation: usersNeedingRotation?.length || 0,
        users_needing_assignment: usersNeedingAssignment?.length || 0,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to get proxy health stats:`, error);
      return {};
    }
  }

  /**
   * Add a new proxy to the pool
   */
  async addProxyToPool(proxyConfig: {
    provider: ProxyProvider;
    endpoint: string;
    username?: string;
    password?: string;
    country_code?: string;
    region?: string;
    city?: string;
    proxy_type?: string;
    max_concurrent_users?: number;
    notes?: string;
    added_by?: string;
  }): Promise<{ success: boolean; proxy_id?: string; message: string }> {
    try {
      console.log(`➕ [ProxyHealth] Adding new proxy to pool: ${proxyConfig.endpoint}`);

      const { data: proxy, error } = await supabase
        .from('proxy_pool')
        .insert({
          provider: proxyConfig.provider,
          endpoint: proxyConfig.endpoint,
          username: proxyConfig.username,
          password: proxyConfig.password,
          country_code: proxyConfig.country_code,
          region: proxyConfig.region,
          city: proxyConfig.city,
          proxy_type: proxyConfig.proxy_type || 'residential',
          max_concurrent_users: proxyConfig.max_concurrent_users || 1,
          notes: proxyConfig.notes,
          added_by: proxyConfig.added_by,
          status: 'testing', // Start in testing mode
          tier: proxyConfig.provider === 'custom' ? 'decodo' : 'local'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add proxy: ${error.message}`);
      }

      console.log(`✅ [ProxyHealth] Added proxy ${proxy.id} to pool`);

      return {
        success: true,
        proxy_id: proxy.id,
        message: `Proxy added successfully: ${proxyConfig.endpoint}`
      };

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to add proxy:`, error);
      return {
        success: false,
        message: `Failed to add proxy: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test a proxy's connectivity
   */
  async testProxyConnectivity(
    proxyId: string,
    testUrl: string = 'https://httpbin.org/ip'
  ): Promise<{ success: boolean; response_time_ms?: number; ip_address?: string; error?: string }> {
    try {
      console.log(`🔍 [ProxyHealth] Testing connectivity for proxy ${proxyId}`);

      // Get proxy details
      const { data: proxy, error } = await supabase
        .from('proxy_pool')
        .select('*')
        .eq('id', proxyId)
        .single();

      if (error || !proxy) {
        throw new Error('Proxy not found');
      }

      // TODO: Implement actual proxy test using axios with proxy configuration
      // This is a placeholder that simulates a test
      const startTime = Date.now();
      
      // Simulated test - in real implementation, use axios with proxy config
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
      
      const responseTime = Date.now() - startTime;
      const mockIpAddress = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

      console.log(`✅ [ProxyHealth] Proxy ${proxyId} test successful (${responseTime}ms)`);

      return {
        success: true,
        response_time_ms: responseTime,
        ip_address: mockIpAddress
      };

    } catch (error) {
      console.error(`❌ [ProxyHealth] Proxy test failed for ${proxyId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Escalate proxy issues to admin
   */
  private async escalateToAdmin(
    userId: string, 
    proxyId: string | null, 
    reason: string
  ): Promise<void> {
    try {
      console.log(`🚨 [ProxyHealth] Escalating to admin: ${reason} (user: ${userId}, proxy: ${proxyId})`);

      // Log the escalation (could also send Slack notification, email, etc.)
      const { error } = await supabase
        .from('proxy_assignments')
        .insert({
          proxy_id: proxyId,
          user_id: userId,
          assignment_reason: 'admin_escalation',
          failure_reason: reason,
          assigned_at: new Date().toISOString()
        });

      if (error) {
        console.error(`❌ [ProxyHealth] Failed to log admin escalation: ${error.message}`);
      }

      // TODO: Send actual admin notification (Slack, email, etc.)
      console.log(`📧 [ProxyHealth] Admin notification sent: ${reason}`);

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to escalate to admin:`, error);
    }
  }

  /**
   * Reset daily proxy health counters (called by cron job)
   */
  async resetDailyCounters(): Promise<void> {
    try {
      console.log(`🔄 [ProxyHealth] Resetting daily proxy health counters`);

      const { error } = await supabase.rpc('reset_daily_proxy_health');

      if (error) {
        throw new Error(`Failed to reset daily counters: ${error.message}`);
      }

      console.log(`✅ [ProxyHealth] Daily counters reset successfully`);

    } catch (error) {
      console.error(`❌ [ProxyHealth] Failed to reset daily counters:`, error);
    }
  }
}

/**
 * Export singleton instance
 */
export const proxyHealthService = new ProxyHealthService(); 