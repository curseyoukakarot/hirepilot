/**
 * CAPTCHA System Recovery Service
 * Handles proxy disabling, cool-off periods, and system recovery after CAPTCHA incidents
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RecoveryAction {
  actionType: 'proxy_disable' | 'user_cooldown' | 'proxy_rotation' | 'manual_review';
  proxyId?: string;
  userId: string;
  reason: string;
  duration?: number; // Duration in hours
  automatic: boolean;
  success: boolean;
  details?: any;
}

export interface CooldownInfo {
  userId: string;
  isInCooldown: boolean;
  cooldownEnd?: string;
  remainingHours?: number;
  incidentCount: number;
  canBeResumed: boolean;
  lastIncidentAt?: string;
}

export class CaptchaSystemRecoveryService {

  /**
   * Disable proxy after CAPTCHA detection
   */
  async disableProxyForCaptcha(
    proxyId: string, 
    userId: string, 
    incidentId: string, 
    durationHours: number = 24
  ): Promise<RecoveryAction> {
    console.log(`🚫 [Recovery] Disabling proxy ${proxyId} for user ${userId} (${durationHours}h)`);

    try {
      // 1. Update proxy assignment to disabled status
      const { error: assignmentError } = await supabase
        .from('puppet_proxy_assignments')
        .update({
          status: 'disabled_captcha',
          disabled_at: new Date().toISOString(),
          disabled_until: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
          disabled_reason: `CAPTCHA detected - incident ${incidentId}`,
          updated_at: new Date().toISOString()
        })
        .eq('proxy_id', proxyId)
        .eq('user_id', userId);

      if (assignmentError) {
        console.error('❌ [Recovery] Error disabling proxy assignment:', assignmentError);
        throw assignmentError;
      }

      // 2. Log the recovery action
      await this.logRecoveryAction({
        actionType: 'proxy_disable',
        proxyId,
        userId,
        reason: `CAPTCHA detected - automatic proxy disable for ${durationHours}h`,
        duration: durationHours,
        automatic: true,
        success: true,
        details: { incidentId, method: 'automatic_captcha_response' }
      });

      console.log(`✅ [Recovery] Proxy ${proxyId} disabled successfully for ${durationHours}h`);

      return {
        actionType: 'proxy_disable',
        proxyId,
        userId,
        reason: `Proxy disabled for ${durationHours}h due to CAPTCHA detection`,
        duration: durationHours,
        automatic: true,
        success: true,
        details: { incidentId }
      };

    } catch (error) {
      console.error('❌ [Recovery] Error disabling proxy:', error);

      await this.logRecoveryAction({
        actionType: 'proxy_disable',
        proxyId,
        userId,
        reason: `Failed to disable proxy: ${error.message}`,
        duration: durationHours,
        automatic: true,
        success: false,
        details: { error: error.message, incidentId }
      });

      return {
        actionType: 'proxy_disable',
        proxyId,
        userId,
        reason: `Failed to disable proxy: ${error.message}`,
        duration: durationHours,
        automatic: true,
        success: false
      };
    }
  }

  /**
   * Put user in cooldown period
   */
  async enforceUserCooldown(
    userId: string, 
    incidentId: string, 
    durationHours: number = 24
  ): Promise<RecoveryAction> {
    console.log(`⏳ [Recovery] Enforcing user cooldown for ${userId} (${durationHours}h)`);

    try {
      // Update the incident with cooldown information
      const { error } = await supabase
        .from('puppet_captcha_incidents')
        .update({
          cooldown_until: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      if (error) {
        console.error('❌ [Recovery] Error enforcing user cooldown:', error);
        throw error;
      }

      // Cancel any pending jobs for this user
      await this.cancelPendingJobs(userId, `User in CAPTCHA cooldown for ${durationHours}h`);

      await this.logRecoveryAction({
        actionType: 'user_cooldown',
        userId,
        reason: `User cooldown enforced for ${durationHours}h after CAPTCHA detection`,
        duration: durationHours,
        automatic: true,
        success: true,
        details: { incidentId, method: 'automatic_captcha_response' }
      });

      console.log(`✅ [Recovery] User ${userId} cooldown enforced for ${durationHours}h`);

      return {
        actionType: 'user_cooldown',
        userId,
        reason: `User cooldown enforced for ${durationHours}h`,
        duration: durationHours,
        automatic: true,
        success: true,
        details: { incidentId }
      };

    } catch (error) {
      console.error('❌ [Recovery] Error enforcing user cooldown:', error);
      return {
        actionType: 'user_cooldown',
        userId,
        reason: `Failed to enforce cooldown: ${error.message}`,
        automatic: true,
        success: false
      };
    }
  }

  /**
   * Check if user is in cooldown
   */
  async getUserCooldownInfo(userId: string): Promise<CooldownInfo> {
    try {
      const { data, error } = await supabase
        .from('puppet_captcha_incidents')
        .select('*')
        .eq('user_id', userId)
        .in('incident_status', ['detected', 'acknowledged', 'investigating'])
        .order('detected_at', { ascending: false });

      if (error) {
        console.error('❌ [Recovery] Error fetching cooldown info:', error);
        return {
          userId,
          isInCooldown: false,
          incidentCount: 0,
          canBeResumed: true
        };
      }

      const incidents = data || [];
      const now = new Date();
      
      // Find active cooldown
      const activeCooldown = incidents.find(incident => 
        incident.cooldown_until && new Date(incident.cooldown_until) > now
      );

      if (activeCooldown) {
        const cooldownEnd = new Date(activeCooldown.cooldown_until);
        const remainingMs = cooldownEnd.getTime() - now.getTime();
        const remainingHours = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));

        return {
          userId,
          isInCooldown: true,
          cooldownEnd: activeCooldown.cooldown_until,
          remainingHours,
          incidentCount: incidents.length,
          canBeResumed: false,
          lastIncidentAt: activeCooldown.detected_at
        };
      }

      return {
        userId,
        isInCooldown: false,
        incidentCount: incidents.length,
        canBeResumed: true,
        lastIncidentAt: incidents[0]?.detected_at
      };

    } catch (error) {
      console.error('❌ [Recovery] Exception getting cooldown info:', error);
      return {
        userId,
        isInCooldown: false,
        incidentCount: 0,
        canBeResumed: true
      };
    }
  }

  /**
   * Cancel pending jobs for user
   */
  private async cancelPendingJobs(userId: string, reason: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('puppet_jobs')
        .update({
          final_status: 'cancelled',
          status: 'cancelled',
          last_execution_error: reason,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .in('status', ['queued', 'pending'])
        .select('id');

      if (error) {
        console.error('❌ [Recovery] Error cancelling jobs:', error);
        return 0;
      }

      const cancelledCount = data?.length || 0;
      console.log(`📋 [Recovery] Cancelled ${cancelledCount} pending jobs for user ${userId}`);
      return cancelledCount;

    } catch (error) {
      console.error('❌ [Recovery] Exception cancelling jobs:', error);
      return 0;
    }
  }

  /**
   * Log recovery action for audit trail
   */
  private async logRecoveryAction(action: RecoveryAction): Promise<void> {
    try {
      // For now, just log to console since we don't have recovery log table
      console.log(`📝 [Recovery Log] ${action.actionType}: ${action.reason} (success: ${action.success})`);
      
      // TODO: Implement recovery log table if needed
      // const { error } = await supabase.from('puppet_system_recovery_log').insert(...)
    } catch (error) {
      console.error('❌ [Recovery] Exception logging recovery action:', error);
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStatistics(daysBack: number = 7): Promise<{
    totalActions: number;
    proxyDisables: number;
    userCooldowns: number;
    successRate: number;
  }> {
    try {
      // Get statistics from captcha incidents
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('puppet_captcha_incidents')
        .select('incident_status, proxy_disabled')
        .gte('detected_at', cutoffDate);

      if (error) {
        console.error('❌ [Recovery] Error getting statistics:', error);
        return {
          totalActions: 0,
          proxyDisables: 0,
          userCooldowns: 0,
          successRate: 0
        };
      }

      const incidents = data || [];
      const resolvedIncidents = incidents.filter(i => i.incident_status === 'resolved').length;

      return {
        totalActions: incidents.length,
        proxyDisables: incidents.filter(i => i.proxy_disabled).length,
        userCooldowns: incidents.filter(i => i.incident_status === 'detected').length,
        successRate: incidents.length > 0 ? (resolvedIncidents / incidents.length) * 100 : 0
      };

    } catch (error) {
      console.error('❌ [Recovery] Exception getting statistics:', error);
      return {
        totalActions: 0,
        proxyDisables: 0,
        userCooldowns: 0,
        successRate: 0
      };
    }
  }
}

export const captchaSystemRecoveryService = new CaptchaSystemRecoveryService(); 