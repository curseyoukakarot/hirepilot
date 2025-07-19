/**
 * Proxy Health Monitoring Service
 * Advanced proxy health tracking with auto-rotation and failure detection
 */

import { supabase } from '../../lib/supabase';

interface ProxyHealth {
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
  status: 'active' | 'inactive' | 'maintenance' | 'banned' | 'testing';
  failure_reason?: string;
  avg_response_time_ms?: number;
  total_jobs_processed: number;
  consecutive_failures: number;
  auto_disabled_at?: string;
  auto_disabled_reason?: string;
}

interface ProxyHealthMetrics {
  total_jobs: number;
  success_rate: number;
  failure_rate: number;
  recent_failure_rate: number;
  avg_response_time: number;
  is_healthy: boolean;
  needs_rotation: boolean;
  health_score: number;
}

interface FailureContext {
  failure_type: 'captcha' | 'timeout' | 'security_checkpoint' | 'invite_failure' | 'network_error' | 'banned' | 'other';
  error_message?: string;
  response_time_ms?: number;
  user_agent?: string;
  ip_address?: string;
}

export class ProxyHealthMonitoringService {
  
  /**
   * Core function requested in prompt: evaluateProxyHealth
   * Evaluates proxy health and triggers rotation if needed
   */
  static async evaluateProxyHealth(proxyId: string, userId: string): Promise<void> {
    try {
      console.log(`🔍 Evaluating proxy health: ${proxyId} for user ${userId}`);
      
      // Get current health record
      const health = await this.getProxyHealth(proxyId, userId);
      if (!health) {
        console.log(`⚠️ No health record found for proxy ${proxyId}, user ${userId}`);
        return;
      }
      
      // Calculate health metrics
      const metrics = this.calculateHealthMetrics(health);
      console.log(`📊 Health metrics:`, metrics);
      
      // Check if proxy should be disabled
      const shouldDisable = await this.shouldDisableProxy(health, metrics);
      
      if (shouldDisable) {
        console.log(`🚨 Disabling proxy ${proxyId} for user ${userId}: ${shouldDisable.reason}`);
        
        // Disable the proxy
        await this.disableProxyForUser(proxyId, userId, shouldDisable.reason);
        
        // Free the assignment and trigger new assignment
        await this.triggerProxyRotation(userId, shouldDisable.reason);
        
        // Send notification
        await this.notifyProxyRotation(userId, proxyId, shouldDisable.reason);
      } else {
        console.log(`✅ Proxy ${proxyId} is healthy for user ${userId}`);
        
        // Check if we should re-enable a previously disabled proxy
        if (health.status === 'inactive' && metrics.is_healthy) {
          await this.reEnableProxy(proxyId, userId);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error evaluating proxy health:`, error);
      throw error;
    }
  }
  
  /**
   * Record job outcome and update proxy health
   */
  static async recordJobOutcome(
    proxyId: string, 
    userId: string, 
    wasSuccessful: boolean,
    context?: FailureContext
  ): Promise<void> {
    try {
      console.log(`📝 Recording job outcome: ${wasSuccessful ? 'SUCCESS' : 'FAILURE'} for proxy ${proxyId}`);
      
      // Use existing database function to update health
      const { error } = await supabase.rpc('update_proxy_health', {
        p_proxy_id: proxyId,
        p_user_id: userId,
        p_was_successful: wasSuccessful,
        p_response_time_ms: context?.response_time_ms,
        p_failure_reason: context?.failure_type || context?.error_message
      });
      
      if (error) {
        throw new Error(`Failed to record job outcome: ${error.message}`);
      }
      
      // If it was a failure, evaluate if we need to take action
      if (!wasSuccessful) {
        await this.evaluateProxyHealth(proxyId, userId);
      }
      
    } catch (error) {
      console.error(`❌ Error recording job outcome:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a proxy is healthy before using it for a job
   */
  static async isProxyHealthyForJob(proxyId: string, userId: string): Promise<{
    isHealthy: boolean;
    reason?: string;
    alternative_needed: boolean;
  }> {
    try {
      const health = await this.getProxyHealth(proxyId, userId);
      
      if (!health) {
        return {
          isHealthy: false,
          reason: 'No health record found',
          alternative_needed: true
        };
      }
      
      // Check proxy status
      if (health.status !== 'active') {
        return {
          isHealthy: false,
          reason: `Proxy status is ${health.status}`,
          alternative_needed: true
        };
      }
      
      // Check recent failure rate
      if (health.recent_failure_count >= 3) {
        return {
          isHealthy: false,
          reason: `Too many recent failures: ${health.recent_failure_count}`,
          alternative_needed: true
        };
      }
      
      // Check consecutive failures
      if (health.consecutive_failures >= 2) {
        return {
          isHealthy: false,
          reason: `Too many consecutive failures: ${health.consecutive_failures}`,
          alternative_needed: true
        };
      }
      
      // Check if proxy was recently auto-disabled
      if (health.auto_disabled_at) {
        const disabledDate = new Date(health.auto_disabled_at);
        const hoursSinceDisabled = (Date.now() - disabledDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceDisabled < 24) {
          return {
            isHealthy: false,
            reason: `Proxy was auto-disabled ${Math.round(hoursSinceDisabled)} hours ago`,
            alternative_needed: true
          };
        }
      }
      
      return { isHealthy: true, alternative_needed: false };
      
    } catch (error) {
      console.error(`❌ Error checking proxy health:`, error);
      return {
        isHealthy: false,
        reason: 'Error checking health',
        alternative_needed: true
      };
    }
  }
  
  /**
   * Get proxy health record
   */
  static async getProxyHealth(proxyId: string, userId: string): Promise<ProxyHealth | null> {
    try {
      const { data, error } = await supabase
        .from('proxy_health')
        .select('*')
        .eq('proxy_id', proxyId)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No record found
        }
        throw new Error(`Failed to get proxy health: ${error.message}`);
      }
      
      return data;
      
    } catch (error) {
      console.error(`❌ Error getting proxy health:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate health metrics for a proxy
   */
  static calculateHealthMetrics(health: ProxyHealth): ProxyHealthMetrics {
    const totalJobs = health.success_count + health.failure_count;
    const successRate = totalJobs > 0 ? (health.success_count / totalJobs) * 100 : 100;
    const failureRate = totalJobs > 0 ? (health.failure_count / totalJobs) * 100 : 0;
    
    const recentTotal = health.recent_success_count + health.recent_failure_count;
    const recentFailureRate = recentTotal > 0 ? (health.recent_failure_count / recentTotal) * 100 : 0;
    
    // Health score calculation (0-100)
    let healthScore = 100;
    healthScore -= Math.min(failureRate * 2, 50); // Penalize overall failure rate
    healthScore -= Math.min(recentFailureRate * 3, 30); // Heavily penalize recent failures
    healthScore -= Math.min(health.consecutive_failures * 10, 20); // Penalize consecutive failures
    
    const isHealthy = healthScore >= 70 && health.consecutive_failures < 2 && recentFailureRate < 30;
    const needsRotation = health.consecutive_failures >= 2 || recentFailureRate >= 50 || healthScore < 50;
    
    return {
      total_jobs: totalJobs,
      success_rate: successRate,
      failure_rate: failureRate,
      recent_failure_rate: recentFailureRate,
      avg_response_time: health.avg_response_time_ms || 0,
      is_healthy: isHealthy,
      needs_rotation: needsRotation,
      health_score: Math.max(0, healthScore)
    };
  }
  
  /**
   * Check if proxy should be disabled based on rotation rules
   */
  static async shouldDisableProxy(health: ProxyHealth, metrics: ProxyHealthMetrics): Promise<{
    should_disable: boolean;
    reason: string;
  } | null> {
    
    // Get active rotation rules
    const { data: rules, error } = await supabase
      .from('proxy_rotation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    if (error) {
      console.error('Error fetching rotation rules:', error);
      return null;
    }
    
    for (const rule of rules || []) {
      // Check 24h failure threshold
      if (health.recent_failure_count >= rule.max_failures_24h) {
        return {
          should_disable: true,
          reason: `Exceeded 24h failure limit: ${health.recent_failure_count}/${rule.max_failures_24h} (rule: ${rule.rule_name})`
        };
      }
      
      // Check consecutive failures
      if (health.consecutive_failures >= rule.max_consecutive_failures) {
        return {
          should_disable: true,
          reason: `Exceeded consecutive failure limit: ${health.consecutive_failures}/${rule.max_consecutive_failures} (rule: ${rule.rule_name})`
        };
      }
      
      // Check success rate
      if (metrics.success_rate < rule.min_success_rate_percent && metrics.total_jobs >= 5) {
        return {
          should_disable: true,
          reason: `Below minimum success rate: ${metrics.success_rate.toFixed(1)}%/${rule.min_success_rate_percent}% (rule: ${rule.rule_name})`
        };
      }
      
      // Check response time
      if (health.avg_response_time_ms && health.avg_response_time_ms > rule.max_response_time_ms) {
        return {
          should_disable: true,
          reason: `Response time too slow: ${health.avg_response_time_ms}ms/${rule.max_response_time_ms}ms (rule: ${rule.rule_name})`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Disable proxy for a specific user
   */
  static async disableProxyForUser(proxyId: string, userId: string, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('proxy_health')
        .update({
          status: 'inactive',
          auto_disabled_at: new Date().toISOString(),
          auto_disabled_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('proxy_id', proxyId)
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(`Failed to disable proxy: ${error.message}`);
      }
      
      console.log(`🚫 Disabled proxy ${proxyId} for user ${userId}: ${reason}`);
      
    } catch (error) {
      console.error(`❌ Error disabling proxy:`, error);
      throw error;
    }
  }
  
  /**
   * Re-enable a proxy that has recovered
   */
  static async reEnableProxy(proxyId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('proxy_health')
        .update({
          status: 'active',
          auto_disabled_at: null,
          auto_disabled_reason: null,
          consecutive_failures: 0,
          updated_at: new Date().toISOString()
        })
        .eq('proxy_id', proxyId)
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(`Failed to re-enable proxy: ${error.message}`);
      }
      
      console.log(`✅ Re-enabled proxy ${proxyId} for user ${userId}`);
      
    } catch (error) {
      console.error(`❌ Error re-enabling proxy:`, error);
      throw error;
    }
  }
  
  /**
   * Trigger proxy rotation by reassigning user to new proxy
   */
  static async triggerProxyRotation(userId: string, reason: string): Promise<string | null> {
    try {
      console.log(`🔄 Triggering proxy rotation for user ${userId}, reason: ${reason}`);
      
      // Import here to avoid circular dependencies
      const { ProxyAssignmentService } = await import('./proxyAssignmentService');
      
      // Try to reassign to a new proxy
      const newProxyId = await ProxyAssignmentService.reassignUserProxy(userId, reason);
      
      console.log(`✅ Successfully rotated user ${userId} to new proxy ${newProxyId}`);
      return newProxyId;
      
    } catch (error) {
      console.error(`❌ Failed to rotate proxy for user ${userId}:`, error);
      
      // If no alternative proxy available, send urgent notification
      await this.notifyNoProxyAvailable(userId);
      return null;
    }
  }
  
  /**
   * Send notification about proxy rotation
   */
  static async notifyProxyRotation(userId: string, oldProxyId: string, reason: string): Promise<void> {
    try {
      // Get user details
      const { data: user } = await supabase
        .from('auth.users')
        .select('email')
        .eq('id', userId)
        .single();
      
      const message = `🔄 **Proxy Rotated**\n` +
        `User: ${user?.email || userId}\n` +
        `Old Proxy: ${oldProxyId}\n` +
        `Reason: ${reason}\n` +
        `Time: ${new Date().toISOString()}`;
      
      await this.sendSlackNotification(message);
      
    } catch (error) {
      console.error(`❌ Error sending rotation notification:`, error);
    }
  }
  
  /**
   * Send urgent notification when no proxy is available
   */
  static async notifyNoProxyAvailable(userId: string): Promise<void> {
    try {
      // Get user details
      const { data: user } = await supabase
        .from('auth.users')
        .select('email')
        .eq('id', userId)
        .single();
      
      const message = `🚨 **URGENT: No Proxy Available**\n` +
        `User: ${user?.email || userId}\n` +
        `All proxies are unavailable or unhealthy.\n` +
        `Jobs will be held until proxy becomes available.\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `**Admin Action Required**: Check proxy pool and health status.`;
      
      await this.sendSlackNotification(message, true);
      
    } catch (error) {
      console.error(`❌ Error sending no-proxy notification:`, error);
    }
  }
  
  /**
   * Send Slack notification
   */
  static async sendSlackNotification(message: string, urgent: boolean = false): Promise<void> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        console.log(`📢 Slack notification (would send): ${message}`);
        return;
      }
      
      const payload = {
        text: urgent ? `<!channel> ${message}` : message,
        username: 'Proxy Health Monitor',
        icon_emoji: urgent ? ':rotating_light:' : ':gear:'
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }
      
      console.log(`📢 Slack notification sent successfully`);
      
    } catch (error) {
      console.error(`❌ Error sending Slack notification:`, error);
    }
  }
  
  /**
   * Get health overview for all user proxies (admin view)
   */
  static async getProxyHealthOverview(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_proxy_status')
        .select('*')
        .order('needs_rotation', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get proxy health overview: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Error getting proxy health overview:`, error);
      throw error;
    }
  }
  
  /**
   * Get failing proxies that need immediate attention
   */
  static async getFailingProxies(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('proxy_health')
        .select(`
          *,
          proxy_pool!inner(endpoint, provider, country_code),
          auth.users!inner(email)
        `)
        .eq('status', 'inactive')
        .not('auto_disabled_at', 'is', null)
        .order('auto_disabled_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get failing proxies: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Error getting failing proxies:`, error);
      throw error;
    }
  }
  
  /**
   * Region-aware proxy assignment (optional enhancement)
   */
  static async getPreferredProxyForRegion(userId: string, userRegion?: string): Promise<string | null> {
    try {
      if (!userRegion) return null;
      
      // Find available proxies in the same region
      const { data, error } = await supabase
        .from('available_proxies_for_assignment')
        .select('*')
        .ilike('country_code', `%${userRegion}%`)
        .eq('available_for_assignment', true)
        .order('current_assignments', { ascending: true })
        .limit(1);
      
      if (error || !data || data.length === 0) {
        return null;
      }
      
      return data[0].id;
      
    } catch (error) {
      console.error(`❌ Error getting region-preferred proxy:`, error);
      return null;
    }
  }
} 