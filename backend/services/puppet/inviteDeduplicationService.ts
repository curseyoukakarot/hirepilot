/**
 * LinkedIn Invite Deduplication Service
 * 
 * Prevents re-sending invitations to the same LinkedIn profiles by maintaining
 * a comprehensive cache of sent invitations and their statuses. Includes
 * configurable rules for when to allow re-invitations based on time and status.
 * 
 * Features:
 * - Profile URL normalization and deduplication
 * - Configurable cooldown periods and rules
 * - Status tracking (sent, accepted, declined, etc.)
 * - Profile information caching
 * - Comprehensive audit logging
 * - Admin override capabilities
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Type definitions
export type InviteStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'expired' | 'blocked' | 'error';

export interface SentInvite {
  id: string;
  user_id: string;
  profile_url: string;
  profile_slug: string;
  date_sent: string;
  status: InviteStatus;
  message_content?: string;
  campaign_id?: string;
  job_id?: string;
  source: string;
  accepted_date?: string;
  response_date?: string;
  last_status_check?: string;
  linkedin_invite_id?: string;
  connection_degree?: number;
  mutual_connections?: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileCache {
  id: string;
  profile_url: string;
  profile_slug: string;
  full_name?: string;
  headline?: string;
  company?: string;
  location?: string;
  industry?: string;
  profile_image_url?: string;
  is_connected: boolean;
  connection_date?: string;
  connection_source?: string;
  premium_account?: boolean;
  open_to_work?: boolean;
  hiring?: boolean;
  influencer?: boolean;
  total_invites_sent: number;
  total_messages_sent: number;
  last_contacted_at?: string;
  is_accessible: boolean;
  is_blocked: boolean;
  is_premium_required: boolean;
  last_updated: string;
  cache_expires_at: string;
  update_count: number;
  created_at: string;
}

export interface DeduplicationRule {
  id: string;
  rule_name: string;
  is_active: boolean;
  priority: number;
  min_days_between_invites: number;
  max_invites_per_profile: number;
  cooldown_after_decline_days: number;
  cooldown_after_expire_days: number;
  allow_reinvite_after_withdraw: boolean;
  allow_reinvite_after_expire: boolean;
  allow_reinvite_after_decline: boolean;
  block_after_multiple_declines: boolean;
  respect_campaign_rules: boolean;
  different_message_required: boolean;
  admin_override_allowed: boolean;
  applies_to_user_types?: string[];
  applies_to_sources?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EligibilityCheck {
  allowed: boolean;
  reason: string;
  previous_invite_date?: string;
  previous_status?: InviteStatus;
  days_since_last?: number;
  rule_applied: string;
}

export interface DeduplicationLog {
  id: string;
  user_id: string;
  profile_url: string;
  profile_slug: string;
  decision: 'allowed' | 'blocked' | 'deferred';
  reason: string;
  rule_applied?: string;
  requested_message?: string;
  request_source?: string;
  campaign_id?: string;
  previous_invite_id?: string;
  previous_invite_date?: string;
  previous_invite_status?: InviteStatus;
  days_since_last_invite?: number;
  admin_override: boolean;
  override_reason?: string;
  override_by?: string;
  created_at: string;
}

export interface InviteHistory {
  user_id: string;
  profile_url: string;
  profile_slug: string;
  date_sent: string;
  status: InviteStatus;
  message_content?: string;
  campaign_id?: string;
  source: string;
  accepted_date?: string;
  response_date?: string;
  full_name?: string;
  headline?: string;
  company?: string;
  location?: string;
  is_connected: boolean;
  days_since_sent: number;
  status_display: string;
  created_at: string;
  updated_at: string;
}

/**
 * Main service class for LinkedIn invite deduplication
 */
export class InviteDeduplicationService {

  /**
   * Check if a user can send an invite to a LinkedIn profile
   */
  async checkInviteEligibility(
    userId: string,
    profileUrl: string,
    source: string = 'manual',
    adminOverride: boolean = false
  ): Promise<EligibilityCheck> {
    try {
      console.log(`🔍 [Deduplication] Checking eligibility for ${userId} to invite ${profileUrl}`);

      // Normalize profile URL
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      
      // Use database function to check eligibility
      const { data, error } = await supabase.rpc('check_invite_eligibility', {
        p_user_id: userId,
        p_profile_url: normalizedUrl,
        p_source: source,
        p_admin_override: adminOverride
      });

      if (error) {
        throw new Error(`Failed to check eligibility: ${error.message}`);
      }

      const result = data[0] as EligibilityCheck;

      // Log the decision
      await this.logDeduplicationDecision(
        userId,
        normalizedUrl,
        result.allowed ? 'allowed' : 'blocked',
        result.reason,
        source,
        result.rule_applied,
        undefined, // campaign_id
        result.previous_invite_date,
        result.previous_status,
        result.days_since_last,
        adminOverride
      );

      console.log(`${result.allowed ? '✅' : '❌'} [Deduplication] ${result.reason} (rule: ${result.rule_applied})`);
      return result;

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to check eligibility for ${userId}:`, error);
      return {
        allowed: false,
        reason: `Eligibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rule_applied: 'error'
      };
    }
  }

  /**
   * Record a successfully sent invitation
   */
  async recordSentInvite(
    userId: string,
    profileUrl: string,
    messageContent?: string,
    campaignId?: string,
    jobId?: string,
    source: string = 'manual'
  ): Promise<{ success: boolean; invite_id?: string; message: string }> {
    try {
      console.log(`📝 [Deduplication] Recording sent invite for ${userId} to ${profileUrl}`);

      // Normalize profile URL
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);

      // Use database function to record the invite
      const { data: inviteId, error } = await supabase.rpc('record_sent_invite', {
        p_user_id: userId,
        p_profile_url: normalizedUrl,
        p_message_content: messageContent,
        p_campaign_id: campaignId,
        p_job_id: jobId,
        p_source: source
      });

      if (error) {
        throw new Error(`Failed to record sent invite: ${error.message}`);
      }

      console.log(`✅ [Deduplication] Recorded sent invite ${inviteId} for ${userId}`);

      return {
        success: true,
        invite_id: inviteId,
        message: `Invite recorded successfully: ${normalizedUrl}`
      };

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to record sent invite for ${userId}:`, error);
      return {
        success: false,
        message: `Failed to record invite: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update the status of an existing invitation
   */
  async updateInviteStatus(
    userId: string,
    profileUrl: string,
    newStatus: InviteStatus,
    responseDate?: Date
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔄 [Deduplication] Updating invite status for ${userId} to ${profileUrl}: ${newStatus}`);

      // Normalize profile URL
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);

      // Use database function to update status
      const { data: wasUpdated, error } = await supabase.rpc('update_invite_status', {
        p_user_id: userId,
        p_profile_url: normalizedUrl,
        p_new_status: newStatus,
        p_response_date: responseDate?.toISOString() || new Date().toISOString()
      });

      if (error) {
        throw new Error(`Failed to update invite status: ${error.message}`);
      }

      if (!wasUpdated) {
        return {
          success: false,
          message: 'No invitation found to update'
        };
      }

      console.log(`✅ [Deduplication] Updated invite status to ${newStatus} for ${userId}`);

      return {
        success: true,
        message: `Invite status updated to ${newStatus}`
      };

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to update invite status for ${userId}:`, error);
      return {
        success: false,
        message: `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get user's invitation history
   */
  async getUserInviteHistory(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<InviteHistory[]> {
    try {
      const { data, error } = await supabase
        .from('user_invite_history')
        .select('*')
        .eq('user_id', userId)
        .order('date_sent', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch invite history: ${error.message}`);
      }

      return (data || []) as InviteHistory[];

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to get invite history for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get sent invites for a specific profile across all users (admin function)
   */
  async getProfileInviteHistory(profileUrl: string): Promise<SentInvite[]> {
    try {
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      const profileSlug = this.extractProfileSlug(normalizedUrl);

      const { data, error } = await supabase
        .from('linkedin_sent_invites')
        .select('*')
        .eq('profile_slug', profileSlug)
        .order('date_sent', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch profile invite history: ${error.message}`);
      }

      return (data || []) as SentInvite[];

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to get profile history:`, error);
      return [];
    }
  }

  /**
   * Get deduplication statistics for admin dashboard
   */
  async getDeduplicationStats(): Promise<any> {
    try {
      // Get basic statistics
      const { count: totalInvites } = await supabase
        .from('linkedin_sent_invites')
        .select('id', { count: 'exact', head: true });

      const { count: todayInvites } = await supabase
        .from('linkedin_sent_invites')
        .select('id', { count: 'exact', head: true })
        .gte('date_sent', new Date().toISOString().split('T')[0]);

      const { count: duplicatesBlocked } = await supabase
        .from('invite_deduplication_log')
        .select('id', { count: 'exact', head: true })
        .eq('decision', 'blocked')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Get status distribution
      const { data: statusStats } = await supabase
        .from('linkedin_sent_invites')
        .select('status')
        .then(result => {
          const stats = (result.data || []).reduce((acc, invite) => {
            acc[invite.status] = (acc[invite.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return { data: stats };
        });

      // Get recent activity
      const { data: recentBlocks } = await supabase
        .from('invite_deduplication_log')
        .select('*')
        .eq('decision', 'blocked')
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        total_invites: totalInvites || 0,
        today_invites: todayInvites || 0,
        duplicates_blocked_30d: duplicatesBlocked || 0,
        status_distribution: statusStats?.data || {},
        recent_blocks: recentBlocks || [],
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to get stats:`, error);
      return {
        total_invites: 0,
        today_invites: 0,
        duplicates_blocked_30d: 0,
        status_distribution: {},
        recent_blocks: [],
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Bulk check eligibility for multiple profiles
   */
  async bulkCheckEligibility(
    userId: string,
    profileUrls: string[],
    source: string = 'bulk'
  ): Promise<{ profile_url: string; eligible: boolean; reason: string }[]> {
    try {
      console.log(`📋 [Deduplication] Bulk checking ${profileUrls.length} profiles for user ${userId}`);

      const results = await Promise.all(
        profileUrls.map(async (url) => {
          const eligibility = await this.checkInviteEligibility(userId, url, source);
          return {
            profile_url: url,
            eligible: eligibility.allowed,
            reason: eligibility.reason
          };
        })
      );

      const eligible = results.filter(r => r.eligible).length;
      const blocked = results.length - eligible;

      console.log(`✅ [Deduplication] Bulk check complete: ${eligible} eligible, ${blocked} blocked`);

      return results;

    } catch (error) {
      console.error(`❌ [Deduplication] Bulk eligibility check failed:`, error);
      return profileUrls.map(url => ({
        profile_url: url,
        eligible: false,
        reason: 'Bulk check failed'
      }));
    }
  }

  /**
   * Admin function to create or update deduplication rules
   */
  async upsertDeduplicationRule(
    ruleData: Partial<DeduplicationRule>,
    adminUserId?: string
  ): Promise<{ success: boolean; rule_id?: string; message: string }> {
    try {
      console.log(`⚙️ [Deduplication] Upserting rule: ${ruleData.rule_name}`);

      const { data: rule, error } = await supabase
        .from('invite_deduplication_rules')
        .upsert({
          ...ruleData,
          created_by: adminUserId,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to upsert rule: ${error.message}`);
      }

      console.log(`✅ [Deduplication] Rule upserted: ${rule.id}`);

      return {
        success: true,
        rule_id: rule.id,
        message: `Rule ${ruleData.rule_name} saved successfully`
      };

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to upsert rule:`, error);
      return {
        success: false,
        message: `Failed to save rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clean up old deduplication logs (maintenance function)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<{ deleted: number; message: string }> {
    try {
      console.log(`🧹 [Deduplication] Cleaning up logs older than ${daysToKeep} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from('invite_deduplication_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to cleanup logs: ${error.message}`);
      }

      console.log(`✅ [Deduplication] Cleaned up old log entries`);

      return {
        deleted: 0, // Supabase delete doesn't return count
        message: `Cleaned up log entries older than ${daysToKeep} days`
      };

    } catch (error) {
      console.error(`❌ [Deduplication] Cleanup failed:`, error);
      return {
        deleted: 0,
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Normalize LinkedIn profile URL to a standard format
   */
  private normalizeLinkedInUrl(url: string): string {
    if (!url) return '';
    
    // Remove trailing slashes and query parameters
    let normalized = url.trim().toLowerCase().replace(/\/+$/, '').split('?')[0];
    
    // Ensure it starts with https://www.linkedin.com/in/
    if (normalized.includes('linkedin.com/in/')) {
      const slug = normalized.split('linkedin.com/in/')[1];
      normalized = `https://www.linkedin.com/in/${slug}`;
    } else if (!normalized.startsWith('https://')) {
      normalized = `https://www.linkedin.com/in/${normalized}`;
    }
    
    return normalized;
  }

  /**
   * Extract profile slug from LinkedIn URL
   */
  private extractProfileSlug(url: string): string {
    const normalized = this.normalizeLinkedInUrl(url);
    return normalized.replace(/^https:\/\/www\.linkedin\.com\/in\//, '').replace(/\/$/, '');
  }

  /**
   * Log deduplication decision for audit trail
   */
  private async logDeduplicationDecision(
    userId: string,
    profileUrl: string,
    decision: 'allowed' | 'blocked' | 'deferred',
    reason: string,
    source: string,
    ruleApplied?: string,
    campaignId?: string,
    previousInviteDate?: string,
    previousStatus?: InviteStatus,
    daysSinceLast?: number,
    adminOverride: boolean = false,
    overrideReason?: string,
    overrideBy?: string
  ): Promise<void> {
    try {
      const profileSlug = this.extractProfileSlug(profileUrl);

      await supabase
        .from('invite_deduplication_log')
        .insert({
          user_id: userId,
          profile_url: profileUrl,
          profile_slug: profileSlug,
          decision: decision,
          reason: reason,
          rule_applied: ruleApplied,
          request_source: source,
          campaign_id: campaignId,
          previous_invite_date: previousInviteDate,
          previous_invite_status: previousStatus,
          days_since_last_invite: daysSinceLast,
          admin_override: adminOverride,
          override_reason: overrideReason,
          override_by: overrideBy
        });

    } catch (error) {
      console.error(`❌ [Deduplication] Failed to log decision:`, error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }
}

/**
 * Export singleton instance
 */
export const inviteDeduplicationService = new InviteDeduplicationService(); 