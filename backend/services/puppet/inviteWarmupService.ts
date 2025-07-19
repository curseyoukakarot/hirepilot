/**
 * LinkedIn Invite Warm-Up Service
 * 
 * Progressive daily limit system that gradually increases user invite capacity
 * based on successful usage patterns. Prevents LinkedIn account flags by
 * starting users at low limits and building up their reputation.
 * 
 * Tier System:
 * - new_user: 5/day (starting)
 * - warming_up: 7-15/day (progressive)  
 * - established: 17-19/day (advanced)
 * - veteran: 20/day (maximum)
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type definitions
export type LinkedInInviteTier = 'new_user' | 'warming_up' | 'established' | 'veteran';

export interface InviteWarmupStatus {
  user_id: string;
  today_invites_sent: number;
  current_daily_limit: number;
  current_tier: LinkedInInviteTier;
  remaining_invites_today: number;
  consecutive_successful_days: number;
  daily_limit_reached: boolean;
  warmup_enabled: boolean;
  auto_progression_enabled: boolean;
  has_manual_override: boolean;
  manual_daily_limit?: number;
  security_warnings_today: number;
  failed_invites_today: number;
  min_delay_between_invites_seconds: number;
  max_delay_between_invites_seconds: number;
}

export interface InviteWarmupSettings {
  user_id: string;
  warmup_enabled: boolean;
  auto_progression_enabled: boolean;
  manual_daily_limit?: number;
  manual_tier?: LinkedInInviteTier;
  override_reason?: string;
  pause_on_warnings: boolean;
  max_daily_failures: number;
  min_delay_between_invites_seconds: number;
  max_delay_between_invites_seconds: number;
}

export interface TierProgression {
  can_upgrade: boolean;
  current_tier: LinkedInInviteTier;
  next_tier?: LinkedInInviteTier;
  days_until_upgrade: number;
  upgrade_requirements: string;
}

export interface WarmupValidationResult {
  allowed: boolean;
  reason?: string;
  current_count: number;
  daily_limit: number;
  remaining_today: number;
  next_allowed_time?: Date;
  tier: LinkedInInviteTier;
}

/**
 * Main service class for LinkedIn invite warm-up management
 */
export class InviteWarmupService {
  
  /**
   * Get current warm-up status for a user
   */
  async getUserWarmupStatus(userId: string): Promise<InviteWarmupStatus | null> {
    try {
      console.log(`🌡️ [Warmup] Fetching status for user ${userId}`);

      const { data, error } = await supabase
        .from('linkedin_user_warmup_status')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User doesn't exist in view, create default settings
          await this.initializeUserWarmup(userId);
          return await this.getUserWarmupStatus(userId);
        }
        throw new Error(`Failed to fetch warmup status: ${error.message}`);
      }

      console.log(`✅ [Warmup] User ${userId} status: ${data.current_tier} tier, ${data.remaining_invites_today}/${data.current_daily_limit} remaining`);
      return data as InviteWarmupStatus;

    } catch (error) {
      console.error(`❌ [Warmup] Failed to get status for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Initialize warm-up settings for a new user
   */
  async initializeUserWarmup(userId: string): Promise<void> {
    try {
      console.log(`🆕 [Warmup] Initializing warm-up for new user ${userId}`);

      // Create warmup settings
      const { error: settingsError } = await supabase
        .from('linkedin_warmup_settings')
        .upsert({
          user_id: userId,
          warmup_enabled: true,
          auto_progression_enabled: true,
          pause_on_warnings: true,
          max_daily_failures: 3,
          min_delay_between_invites_seconds: 300, // 5 minutes
          max_delay_between_invites_seconds: 1800 // 30 minutes
        }, { onConflict: 'user_id' });

      if (settingsError) {
        throw new Error(`Failed to create warmup settings: ${settingsError.message}`);
      }

      // Create initial daily stats for today
      const { error: statsError } = await supabase
        .from('linkedin_invite_stats')
        .upsert({
          user_id: userId,
          stat_date: new Date().toISOString().split('T')[0],
          count: 0,
          successful_count: 0,
          failed_count: 0,
          tier: 'new_user',
          daily_limit: 5,
          consecutive_successful_days: 0
        }, { onConflict: 'user_id,stat_date' });

      if (statsError) {
        throw new Error(`Failed to create daily stats: ${statsError.message}`);
      }

      // Log initialization
      await this.logWarmupEvent(userId, 'limit_reset', {
        reason: 'User warm-up initialization',
        triggered_by: 'auto_progression',
        new_tier: 'new_user',
        new_daily_limit: 5
      });

      console.log(`✅ [Warmup] Initialized user ${userId} at new_user tier (5/day)`);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to initialize user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate if user can send an invite right now
   */
  async validateInviteRequest(userId: string): Promise<WarmupValidationResult> {
    try {
      console.log(`🔍 [Warmup] Validating invite request for user ${userId}`);

      const status = await this.getUserWarmupStatus(userId);
      if (!status) {
        throw new Error('Could not fetch user warmup status');
      }

      // Check if warmup is enabled
      if (!status.warmup_enabled) {
        return {
          allowed: true,
          reason: 'Warmup disabled for user',
          current_count: status.today_invites_sent,
          daily_limit: 999, // Unlimited when disabled
          remaining_today: 999,
          tier: status.current_tier
        };
      }

      // Check daily limit
      if (status.daily_limit_reached) {
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);

        return {
          allowed: false,
          reason: `Daily invite limit reached (${status.current_daily_limit}). Resets tomorrow.`,
          current_count: status.today_invites_sent,
          daily_limit: status.current_daily_limit,
          remaining_today: 0,
          next_allowed_time: nextDay,
          tier: status.current_tier
        };
      }

      // Check failure limits
      if (status.failed_invites_today >= 3) {
        return {
          allowed: false,
          reason: `Too many failed invites today (${status.failed_invites_today}/3). Try again tomorrow.`,
          current_count: status.today_invites_sent,
          daily_limit: status.current_daily_limit,
          remaining_today: status.remaining_invites_today,
          tier: status.current_tier
        };
      }

      // All checks passed
      return {
        allowed: true,
        current_count: status.today_invites_sent,
        daily_limit: status.current_daily_limit,
        remaining_today: status.remaining_invites_today,
        tier: status.current_tier
      };

    } catch (error) {
      console.error(`❌ [Warmup] Validation failed for user ${userId}:`, error);
      return {
        allowed: false,
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        current_count: 0,
        daily_limit: 5,
        remaining_today: 0,
        tier: 'new_user'
      };
    }
  }

  /**
   * Record an invite send (successful or failed)
   */
  async recordInviteSent(userId: string, wasSuccessful: boolean = true): Promise<void> {
    try {
      console.log(`📊 [Warmup] Recording ${wasSuccessful ? 'successful' : 'failed'} invite for user ${userId}`);

      // Call the database function to update stats and handle tier progression
      const { error } = await supabase.rpc('update_daily_invite_stats', {
        p_user_id: userId,
        p_increment_count: 1,
        p_was_successful: wasSuccessful
      });

      if (error) {
        throw new Error(`Failed to record invite: ${error.message}`);
      }

      console.log(`✅ [Warmup] Recorded ${wasSuccessful ? 'successful' : 'failed'} invite for user ${userId}`);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to record invite for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate tier progression for a user
   */
  async getTierProgression(userId: string): Promise<TierProgression> {
    try {
      const status = await this.getUserWarmupStatus(userId);
      if (!status) {
        throw new Error('Could not fetch user status');
      }

      const progression: TierProgression = {
        can_upgrade: false,
        current_tier: status.current_tier,
        days_until_upgrade: 0,
        upgrade_requirements: ''
      };

      switch (status.current_tier) {
        case 'new_user':
          progression.next_tier = 'warming_up';
          progression.days_until_upgrade = Math.max(0, 3 - status.consecutive_successful_days);
          progression.upgrade_requirements = 'Send invites successfully for 3 consecutive days';
          progression.can_upgrade = status.consecutive_successful_days >= 3;
          break;

        case 'warming_up':
          progression.next_tier = 'established';
          progression.days_until_upgrade = Math.max(0, 7 - status.consecutive_successful_days);
          progression.upgrade_requirements = 'Send invites successfully for 7 consecutive days';
          progression.can_upgrade = status.consecutive_successful_days >= 7;
          break;

        case 'established':
          progression.next_tier = 'veteran';
          progression.days_until_upgrade = Math.max(0, 14 - status.consecutive_successful_days);
          progression.upgrade_requirements = 'Send invites successfully for 14 consecutive days';
          progression.can_upgrade = status.consecutive_successful_days >= 14;
          break;

        case 'veteran':
          progression.upgrade_requirements = 'Maximum tier reached (20 invites/day)';
          progression.can_upgrade = false;
          break;
      }

      return progression;

    } catch (error) {
      console.error(`❌ [Warmup] Failed to calculate progression for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Set manual override for a user (admin function)
   */
  async setManualOverride(
    userId: string, 
    dailyLimit: number, 
    tier?: LinkedInInviteTier,
    reason?: string,
    adminUserId?: string
  ): Promise<void> {
    try {
      console.log(`⚙️ [Warmup] Setting manual override for user ${userId}: ${dailyLimit}/day`);

      if (dailyLimit < 1 || dailyLimit > 50) {
        throw new Error('Daily limit must be between 1 and 50');
      }

      // Update warmup settings
      const { error: settingsError } = await supabase
        .from('linkedin_warmup_settings')
        .update({
          manual_daily_limit: dailyLimit,
          manual_tier: tier,
          override_reason: reason,
          override_set_by: adminUserId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (settingsError) {
        throw new Error(`Failed to set override: ${settingsError.message}`);
      }

      // Update today's stats if they exist
      const { error: statsError } = await supabase
        .from('linkedin_invite_stats')
        .update({
          daily_limit: dailyLimit,
          tier: tier || 'new_user',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('stat_date', new Date().toISOString().split('T')[0]);

      // Log the override
      await this.logWarmupEvent(userId, 'manual_override', {
        reason: reason || 'Manual admin override',
        triggered_by: 'admin_override',
        admin_user_id: adminUserId,
        new_daily_limit: dailyLimit,
        new_tier: tier
      });

      console.log(`✅ [Warmup] Set manual override for user ${userId}: ${dailyLimit}/day`);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to set override for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reset user's warm-up progress (admin function)
   */
  async resetUserWarmup(userId: string, reason?: string, adminUserId?: string): Promise<void> {
    try {
      console.log(`🔄 [Warmup] Resetting warm-up for user ${userId}`);

      // Reset to new user tier
      await this.setManualOverride(userId, 5, 'new_user', reason, adminUserId);

      // Reset consecutive days
      const { error } = await supabase
        .from('linkedin_invite_stats')
        .update({
          consecutive_successful_days: 0,
          security_warnings: 0,
          last_tier_upgrade_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('stat_date', new Date().toISOString().split('T')[0]);

      // Log the reset
      await this.logWarmupEvent(userId, 'limit_reset', {
        reason: reason || 'Admin reset to new user',
        triggered_by: 'admin_override',
        admin_user_id: adminUserId,
        new_tier: 'new_user',
        new_daily_limit: 5
      });

      console.log(`✅ [Warmup] Reset user ${userId} to new_user tier`);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to reset user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get warm-up statistics for admin dashboard
   */
  async getWarmupStats(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('linkedin_user_warmup_status')
        .select('*');

      if (error) {
        throw new Error(`Failed to fetch warmup stats: ${error.message}`);
      }

      // Calculate summary statistics
      const stats = {
        total_users: data.length,
        tier_distribution: {
          new_user: data.filter(u => u.current_tier === 'new_user').length,
          warming_up: data.filter(u => u.current_tier === 'warming_up').length,
          established: data.filter(u => u.current_tier === 'established').length,
          veteran: data.filter(u => u.current_tier === 'veteran').length
        },
        daily_totals: {
          total_invites_today: data.reduce((sum, u) => sum + u.today_invites_sent, 0),
          total_capacity: data.reduce((sum, u) => sum + u.current_daily_limit, 0),
          utilization_rate: 0
        },
        users_at_limit: data.filter(u => u.daily_limit_reached).length,
        users_with_warnings: data.filter(u => u.security_warnings_today > 0).length,
        users_with_overrides: data.filter(u => u.has_manual_override).length
      };

      stats.daily_totals.utilization_rate = 
        Math.round((stats.daily_totals.total_invites_today / stats.daily_totals.total_capacity) * 100);

      return stats;

    } catch (error) {
      console.error(`❌ [Warmup] Failed to get warmup stats:`, error);
      throw error;
    }
  }

  /**
   * Log warmup events for audit trail
   */
  private async logWarmupEvent(
    userId: string, 
    eventType: string, 
    details: {
      reason?: string;
      triggered_by?: string;
      admin_user_id?: string;
      old_tier?: LinkedInInviteTier;
      new_tier?: LinkedInInviteTier;
      old_daily_limit?: number;
      new_daily_limit?: number;
    }
  ): Promise<void> {
    try {
      await supabase
        .from('linkedin_warmup_history')
        .insert({
          user_id: userId,
          event_type: eventType,
          reason: details.reason,
          triggered_by: details.triggered_by,
          admin_user_id: details.admin_user_id,
          old_tier: details.old_tier,
          new_tier: details.new_tier,
          old_daily_limit: details.old_daily_limit,
          new_daily_limit: details.new_daily_limit
        });

      console.log(`📝 [Warmup] Logged ${eventType} event for user ${userId}`);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to log event for user ${userId}:`, error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Calculate optimal delay between invites for a user
   */
  async getOptimalInviteDelay(userId: string): Promise<number> {
    try {
      const status = await this.getUserWarmupStatus(userId);
      if (!status) {
        return 300; // Default 5 minutes
      }

      const { min_delay_between_invites_seconds, max_delay_between_invites_seconds } = status;
      
      // Add some randomization to make it more human-like
      const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3 multiplier
      const baseDelay = min_delay_between_invites_seconds + 
        (Math.random() * (max_delay_between_invites_seconds - min_delay_between_invites_seconds));
      
      return Math.round(baseDelay * randomFactor);

    } catch (error) {
      console.error(`❌ [Warmup] Failed to calculate delay for user ${userId}:`, error);
      return 300; // Default 5 minutes
    }
  }
}

/**
 * Export singleton instance
 */
export const inviteWarmupService = new InviteWarmupService(); 