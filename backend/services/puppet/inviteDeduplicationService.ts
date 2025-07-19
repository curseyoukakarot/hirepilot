/**
 * Invite Deduplication Service
 * Prevents duplicate LinkedIn invites with configurable cooldown rules
 */

import { supabase } from '../../lib/supabase';

export type InviteStatus = 'sent' | 'accepted' | 'rejected' | 'expired' | 'withdrawn' | 'pending';
export type DeduplicationAction = 'blocked' | 'allowed' | 'override';
export type DeduplicationReason = 'duplicate' | 'cooldown_active' | 'permanently_blocked' | 'admin_override' | 'rule_exemption' | 'first_time';

export interface DeduplicationResult {
  isAllowed: boolean;
  reason: DeduplicationReason;
  message: string;
  cooldownExpiresAt?: Date;
  previousInviteId?: string;
  ruleApplied?: string;
  logId?: string;
}

export interface InviteRecord {
  id: string;
  userId: string;
  campaignId?: string;
  originalProfileUrl: string;
  normalizedProfileUrl: string;
  profileName?: string;
  profileTitle?: string;
  profileCompany?: string;
  inviteMessage?: string;
  status: InviteStatus;
  sentAt: Date;
  puppetJobId?: string;
}

export interface DeduplicationRule {
  id: string;
  ruleName: string;
  inviteStatus: InviteStatus;
  isActive: boolean;
  cooldownDays: number;
  isPermanentBlock: boolean;
  priority: number;
  description?: string;
}

export class InviteDeduplicationService {
  
  /**
   * Normalize LinkedIn URL for consistent comparison
   */
  static normalizeLinkedInUrl(url: string): string {
    if (!url) return '';
    
    try {
      // Convert to lowercase and remove query parameters and trailing slash
      let normalized = url.toLowerCase().trim();
      
      // Remove query parameters (everything after ?)
      normalized = normalized.split('?')[0];
      
      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');
      
      // Ensure it's a valid LinkedIn profile URL
      if (!normalized.includes('linkedin.com/in/')) {
        throw new Error('Invalid LinkedIn profile URL format');
      }
      
      return normalized;
      
    } catch (error) {
      console.error('Error normalizing LinkedIn URL:', error);
      throw new Error(`Invalid LinkedIn URL: ${url}`);
    }
  }

  /**
   * Check if an invite is allowed based on deduplication rules
   */
  static async checkInviteDeduplication(
    userId: string,
    profileUrl: string,
    campaignId?: string,
    puppetJobId?: string
  ): Promise<DeduplicationResult> {
    try {
      // Normalize the profile URL
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      
      console.log(`🔍 Checking deduplication for user ${userId} to ${normalizedUrl}`);
      
      // Call the database function to check deduplication
      const { data, error } = await supabase.rpc('check_invite_deduplication', {
        p_user_id: userId,
        p_profile_url: profileUrl,
        p_campaign_id: campaignId || null
      });
      
      if (error) {
        throw new Error(`Deduplication check failed: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('No deduplication result returned');
      }
      
      const result = data[0];
      
      // Determine action based on result
      const action: DeduplicationAction = result.is_allowed ? 'allowed' : 'blocked';
      
      // Log the decision
      const logId = await this.logDeduplicationDecision(
        userId,
        profileUrl,
        action,
        result.reason,
        result.rule_applied !== 'no_rule' ? await this.getRuleIdByName(result.rule_applied) : undefined,
        result.previous_invite_id,
        result.message,
        campaignId,
        puppetJobId
      );
      
      const deduplicationResult: DeduplicationResult = {
        isAllowed: result.is_allowed,
        reason: result.reason,
        message: result.message,
        cooldownExpiresAt: result.cooldown_expires_at ? new Date(result.cooldown_expires_at) : undefined,
        previousInviteId: result.previous_invite_id,
        ruleApplied: result.rule_applied,
        logId
      };
      
      if (result.is_allowed) {
        console.log(`✅ Invite allowed: ${result.message}`);
      } else {
        console.log(`❌ Invite blocked: ${result.message}`);
      }
      
      return deduplicationResult;
      
    } catch (error) {
      console.error('Error checking invite deduplication:', error);
      
      // Log the error and default to blocking for safety
      const logId = await this.logDeduplicationDecision(
        userId,
        profileUrl,
        'blocked',
        'rule_exemption',
        undefined,
        undefined,
        `Error during deduplication check: ${error instanceof Error ? error.message : 'Unknown error'}`,
        campaignId,
        puppetJobId
      );
      
      return {
        isAllowed: false,
        reason: 'rule_exemption',
        message: 'Blocked due to error in deduplication check',
        logId
      };
    }
  }

  /**
   * Record a LinkedIn invite in the system
   */
  static async recordLinkedInInvite(
    userId: string,
    profileUrl: string,
    campaignId?: string,
    inviteMessage?: string,
    profileName?: string,
    profileTitle?: string,
    profileCompany?: string,
    puppetJobId?: string
  ): Promise<string> {
    try {
      console.log(`📝 Recording LinkedIn invite for user ${userId} to ${profileUrl}`);
      
      const { data, error } = await supabase.rpc('record_linkedin_invite', {
        p_user_id: userId,
        p_profile_url: profileUrl,
        p_campaign_id: campaignId || null,
        p_invite_message: inviteMessage || null,
        p_profile_name: profileName || null,
        p_profile_title: profileTitle || null,
        p_profile_company: profileCompany || null,
        p_puppet_job_id: puppetJobId || null
      });
      
      if (error) {
        throw new Error(`Failed to record invite: ${error.message}`);
      }
      
      console.log(`✅ Invite recorded with ID: ${data}`);
      return data;
      
    } catch (error) {
      console.error('Error recording LinkedIn invite:', error);
      throw error;
    }
  }

  /**
   * Update the status of an existing invite
   */
  static async updateInviteStatus(
    inviteId: string,
    newStatus: InviteStatus,
    updatedBy?: string
  ): Promise<boolean> {
    try {
      console.log(`📊 Updating invite ${inviteId} status to ${newStatus}`);
      
      const { data, error } = await supabase.rpc('update_invite_status', {
        p_invite_id: inviteId,
        p_new_status: newStatus,
        p_updated_by: updatedBy || null
      });
      
      if (error) {
        throw new Error(`Failed to update invite status: ${error.message}`);
      }
      
      console.log(`✅ Invite status updated: ${data}`);
      return data;
      
    } catch (error) {
      console.error('Error updating invite status:', error);
      throw error;
    }
  }

  /**
   * Get user's invite history for a specific profile
   */
  static async getUserInviteHistory(
    userId: string,
    profileUrl: string
  ): Promise<InviteRecord[]> {
    try {
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      
      const { data, error } = await supabase
        .from('linkedin_sent_invites')
        .select('*')
        .eq('user_id', userId)
        .eq('normalized_profile_url', normalizedUrl)
        .order('sent_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get invite history: ${error.message}`);
      }
      
      return (data || []).map(invite => ({
        id: invite.id,
        userId: invite.user_id,
        campaignId: invite.campaign_id,
        originalProfileUrl: invite.original_profile_url,
        normalizedProfileUrl: invite.normalized_profile_url,
        profileName: invite.profile_name,
        profileTitle: invite.profile_title,
        profileCompany: invite.profile_company,
        inviteMessage: invite.invite_message,
        status: invite.status,
        sentAt: new Date(invite.sent_at),
        puppetJobId: invite.puppet_job_id
      }));
      
    } catch (error) {
      console.error('Error getting user invite history:', error);
      throw error;
    }
  }

  /**
   * Get deduplication rules
   */
  static async getDeduplicationRules(activeOnly: boolean = true): Promise<DeduplicationRule[]> {
    try {
      let query = supabase
        .from('invite_deduplication_rules')
        .select('*')
        .order('priority', { ascending: true });
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to get deduplication rules: ${error.message}`);
      }
      
      return (data || []).map(rule => ({
        id: rule.id,
        ruleName: rule.rule_name,
        inviteStatus: rule.invite_status,
        isActive: rule.is_active,
        cooldownDays: rule.cooldown_days,
        isPermanentBlock: rule.is_permanent_block,
        priority: rule.priority,
        description: rule.description
      }));
      
    } catch (error) {
      console.error('Error getting deduplication rules:', error);
      throw error;
    }
  }

  /**
   * Get user's deduplication summary
   */
  static async getUserDeduplicationSummary(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('invite_deduplication_summary')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw new Error(`Failed to get deduplication summary: ${error.message}`);
      }
      
      return data || {
        total_invites: 0,
        sent_count: 0,
        accepted_count: 0,
        rejected_count: 0,
        expired_count: 0,
        withdrawn_count: 0,
        pending_count: 0,
        acceptance_rate_percent: 0,
        duplicates_blocked_30d: 0
      };
      
    } catch (error) {
      console.error('Error getting user deduplication summary:', error);
      throw error;
    }
  }

  /**
   * Get active cooldowns for a user
   */
  static async getUserActiveCooldowns(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('active_invite_cooldowns')
        .select('*')
        .eq('user_id', userId)
        .order('status_updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw new Error(`Failed to get active cooldowns: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('Error getting active cooldowns:', error);
      throw error;
    }
  }

  /**
   * Create admin override for deduplication
   */
  static async createAdminOverride(
    userId: string,
    profileUrl: string,
    overrideType: 'one_time' | 'permanent' | 'temporary',
    reason: string,
    createdBy: string,
    expiresAt?: Date
  ): Promise<string> {
    try {
      const normalizedUrl = this.normalizeLinkedInUrl(profileUrl);
      
      const { data, error } = await supabase
        .from('invite_deduplication_overrides')
        .insert({
          user_id: userId,
          normalized_profile_url: normalizedUrl,
          override_type: overrideType,
          reason,
          created_by: createdBy,
          expires_at: expiresAt?.toISOString() || null
        })
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to create admin override: ${error.message}`);
      }
      
      console.log(`✅ Admin override created: ${data.id}`);
      return data.id;
      
    } catch (error) {
      console.error('Error creating admin override:', error);
      throw error;
    }
  }

  /**
   * Get recent deduplication logs
   */
  static async getRecentDeduplicationLogs(
    userId?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('invite_deduplication_log')
        .select(`
          *,
          invite_deduplication_rules(rule_name, description)
        `)
        .order('checked_at', { ascending: false })
        .limit(limit);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to get deduplication logs: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('Error getting deduplication logs:', error);
      throw error;
    }
  }

  /**
   * Batch check multiple profiles for deduplication
   */
  static async batchCheckDeduplication(
    userId: string,
    profileUrls: string[],
    campaignId?: string
  ): Promise<{ [profileUrl: string]: DeduplicationResult }> {
    const results: { [profileUrl: string]: DeduplicationResult } = {};
    
    console.log(`🔍 Batch checking ${profileUrls.length} profiles for deduplication`);
    
    // Process in chunks to avoid overwhelming the database
    const chunkSize = 10;
    for (let i = 0; i < profileUrls.length; i += chunkSize) {
      const chunk = profileUrls.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async (profileUrl) => {
        try {
          const result = await this.checkInviteDeduplication(userId, profileUrl, campaignId);
          results[profileUrl] = result;
        } catch (error) {
          console.error(`Error checking deduplication for ${profileUrl}:`, error);
          results[profileUrl] = {
            isAllowed: false,
            reason: 'rule_exemption',
            message: 'Error during batch deduplication check'
          };
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks
      if (i + chunkSize < profileUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const allowedCount = Object.values(results).filter(r => r.isAllowed).length;
    const blockedCount = Object.values(results).filter(r => !r.isAllowed).length;
    
    console.log(`✅ Batch deduplication complete: ${allowedCount} allowed, ${blockedCount} blocked`);
    
    return results;
  }

  /**
   * Helper: Log deduplication decision
   */
  private static async logDeduplicationDecision(
    userId: string,
    profileUrl: string,
    action: DeduplicationAction,
    reason: DeduplicationReason,
    ruleAppliedId?: string,
    previousInviteId?: string,
    message?: string,
    campaignId?: string,
    puppetJobId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('log_deduplication_decision', {
        p_user_id: userId,
        p_profile_url: profileUrl,
        p_action: action,
        p_reason: reason,
        p_rule_applied_id: ruleAppliedId || null,
        p_previous_invite_id: previousInviteId || null,
        p_message: message || null,
        p_campaign_id: campaignId || null,
        p_puppet_job_id: puppetJobId || null
      });
      
      if (error) {
        console.error('Failed to log deduplication decision:', error);
        return '';
      }
      
      return data;
      
    } catch (error) {
      console.error('Error logging deduplication decision:', error);
      return '';
    }
  }

  /**
   * Helper: Get rule ID by name
   */
  private static async getRuleIdByName(ruleName: string): Promise<string | undefined> {
    try {
      const { data, error } = await supabase
        .from('invite_deduplication_rules')
        .select('id')
        .eq('rule_name', ruleName)
        .single();
      
      if (error) {
        console.error('Failed to get rule ID by name:', error);
        return undefined;
      }
      
      return data?.id;
      
    } catch (error) {
      console.error('Error getting rule ID by name:', error);
      return undefined;
    }
  }

  /**
   * Utility: Check if a URL looks like a LinkedIn profile
   */
  static isLinkedInProfileUrl(url: string): boolean {
    if (!url) return false;
    
    const normalizedUrl = url.toLowerCase();
    return normalizedUrl.includes('linkedin.com/in/') && 
           normalizedUrl.startsWith('http');
  }

  /**
   * Utility: Extract profile handle from LinkedIn URL
   */
  static extractLinkedInHandle(url: string): string | null {
    try {
      const normalized = this.normalizeLinkedInUrl(url);
      const match = normalized.match(/linkedin\.com\/in\/([^\/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
} 