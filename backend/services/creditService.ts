import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getCreditsForPlan } from '../config/pricing';

// Load environment variables first
dotenv.config();

// Allow either SUPABASE_URL (backend) or NEXT_PUBLIC_SUPABASE_URL (frontend) for flexibility
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Initialize Supabase client
const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CreditSource = 'subscription_renewal' | 'admin_grant' | 'promotion' | 'refund';
type CreditUsageType = 'campaign_creation' | 'campaign_boost' | 'api_usage';

interface CreditUsageRecord {
  amount: number;
  type: 'credit' | 'debit';
  usage_type: CreditUsageType;
}

interface CreditRecord {
  id: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  created_at: string;
  last_updated: string;
}

export class CreditService {
  private static async getUserCredits(userId: string): Promise<CreditRecord | null> {
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user credits:', error);
      return null;
    }

    return data;
  }

  static async initializeUserCredits(userId: string, initialCredits: number = 0): Promise<boolean> {
    const { error } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        total_credits: initialCredits,
        used_credits: 0,
        remaining_credits: initialCredits
      });

    if (error) {
      console.error('Error initializing user credits:', error);
      return false;
    }

    return true;
  }

  static async addCredits(userId: string, credits: number): Promise<boolean> {
    const userCredits = await this.getUserCredits(userId);
    
    if (!userCredits) {
      return this.initializeUserCredits(userId, credits);
    }

    const newTotal = userCredits.total_credits + credits;
    const newRemaining = userCredits.remaining_credits + credits;

    const { error } = await supabase
      .from('user_credits')
      .update({
        total_credits: newTotal,
        remaining_credits: newRemaining,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error adding credits:', error);
      return false;
    }

    return true;
  }

  static async useCredits(userId: string, credits: number): Promise<boolean> {
    const userCredits = await this.getUserCredits(userId);
    
    if (!userCredits) {
      console.error('No credit record found for user');
      return false;
    }

    if (userCredits.remaining_credits < credits) {
      console.error('Insufficient credits');
      return false;
    }

    const newUsed = userCredits.used_credits + credits;
    const newRemaining = userCredits.remaining_credits - credits;

    const { error } = await supabase
      .from('user_credits')
      .update({
        used_credits: newUsed,
        remaining_credits: newRemaining,
        last_updated: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error using credits:', error);
      return false;
    }

    return true;
  }

  static async getRemainingCredits(userId: string): Promise<number> {
    return this.getEffectiveCreditBalance(userId);
  }

  static async handleSubscriptionChange(userId: string, planId: string): Promise<boolean> {
    const credits = getCreditsForPlan(planId);
    return this.addCredits(userId, credits);
  }

  static async checkCreditStatus(userId: string): Promise<{
    total_credits: number;
    used_credits: number;
    remaining_credits: number;
    created_at: string;
    last_updated: string;
  } | null> {
    const userCredits = await this.getUserCredits(userId);
    
    if (!userCredits) {
      return null;
    }

    return {
      total_credits: userCredits.total_credits,
      used_credits: userCredits.used_credits,
      remaining_credits: userCredits.remaining_credits,
      created_at: userCredits.created_at,
      last_updated: userCredits.last_updated
    };
  }

  /**
   * Get user's current credit balance (considering team admin sharing)
   */
  static async getCreditBalance(userId: string): Promise<number> {
    return this.getEffectiveCreditBalance(userId);
  }

  /**
   * Allocate credits to user based on role
   */
  static async allocateCreditsBasedOnRole(userId: string, role: string, source: CreditSource = 'admin_grant'): Promise<void> {
    // Define credit amounts based on role
    const creditsByRole: Record<string, number> = {
      'member': 350,
      'admin': 1000,
      'team_admin': 5000,
      'RecruitPro': 1000,
      'super_admin': 10000
    };

    const creditAmount = creditsByRole[role] || 350; // Default to member credits

    // Log the allocation
    const { error: insertError } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: userId,
        amount: creditAmount,
        type: 'credit',
        source: source,
        description: `Credit allocation for ${role} role`
      });

    if (insertError) {
      console.error('Error logging credit allocation:', insertError);
      throw insertError;
    }

    // Upsert the credit record
    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        total_credits: creditAmount,
        used_credits: 0,
        remaining_credits: creditAmount,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (updateError) {
      console.error('Error updating credit balance:', updateError);
      throw updateError;
    }
  }

  /**
   * Allocate credits to user (legacy method for backward compatibility)
   */
  static async allocateCredits(userId: string, amount: number, source: CreditSource) {
    const { error: insertError } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'credit',
        source: source,
        description: `Credit allocation from ${source}`
      });

    if (insertError) {
      console.error('Error logging credit allocation:', insertError);
      throw insertError;
    }

    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        total_credits: amount,
        used_credits: 0,
        remaining_credits: amount,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (updateError) {
      console.error('Error updating credit balance:', updateError);
      throw updateError;
    }
  }

  /**
   * Deduct credits from user (considering team admin sharing)
   */
  static async deductCredits(userId: string, amount: number, usageType: CreditUsageType, description: string) {
    // Use the effective credit usage method
    const success = await this.useCreditsEffective(userId, amount);
    
    if (!success) {
      throw new Error('Insufficient credits');
    }

    // The logging is already handled in useCreditsEffective
    return true;
  }

  /**
   * Check if user has sufficient credits (considering team admin sharing)
   */
  static async hasSufficientCredits(userId: string, requiredAmount: number): Promise<boolean> {
    const balance = await this.getEffectiveCreditBalance(userId);
    return balance >= requiredAmount;
  }

  /**
   * Get credit usage history
   */
  static async getCreditUsageHistory(userId: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('credit_usage_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting credit usage history:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get credit usage summary
   */
  static async getCreditUsageSummary(userId: string, startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('credit_usage_log')
      .select('amount, type, usage_type')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Error getting credit usage summary:', error);
      throw error;
    }

    const summary = {
      totalCreditsReceived: 0,
      totalCreditsUsed: 0,
      usageByType: {} as Record<CreditUsageType, number>
    };

    (data as CreditUsageRecord[]).forEach(record => {
      if (record.type === 'credit') {
        summary.totalCreditsReceived += record.amount;
      } else {
        summary.totalCreditsUsed += Math.abs(record.amount);
        if (record.usage_type) {
          summary.usageByType[record.usage_type] = (summary.usageByType[record.usage_type] || 0) + Math.abs(record.amount);
        }
      }
    });

    return summary;
  }

  /**
   * Find the team admin that shares credits with a given user
   */
  static async getTeamAdminForUser(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('team_credit_sharing')
      .select('team_admin_id')
      .eq('team_member_id', userId)
      .single();

    if (error) {
      console.error('Error finding team admin for user:', error);
      return null;
    }

    return data?.team_admin_id || null;
  }

  /**
   * Get effective credit balance for a user (either their own or from team admin)
   */
  static async getEffectiveCreditBalance(userId: string): Promise<number> {
    // First check if user has their own credits
    const userCredits = await this.getUserCredits(userId);
    if (userCredits && userCredits.remaining_credits > 0) {
      return userCredits.remaining_credits;
    }

    // Check if user is part of a team admin's credit pool
    const teamAdminId = await this.getTeamAdminForUser(userId);
    if (teamAdminId) {
      const teamAdminCredits = await this.getUserCredits(teamAdminId);
      return teamAdminCredits?.remaining_credits || 0;
    }

    return 0;
  }

  /**
   * Use credits for a user, potentially from team admin's pool
   */
  static async useCreditsEffective(userId: string, credits: number): Promise<boolean> {
    // First try to use user's own credits
    const userCredits = await this.getUserCredits(userId);
    if (userCredits && userCredits.remaining_credits >= credits) {
      return this.useCredits(userId, credits);
    }

    // If user doesn't have enough credits, try team admin's pool
    const teamAdminId = await this.getTeamAdminForUser(userId);
    if (teamAdminId) {
      const teamAdminCredits = await this.getUserCredits(teamAdminId);
      if (teamAdminCredits && teamAdminCredits.remaining_credits >= credits) {
        // Use credits from team admin's pool
        const newUsed = teamAdminCredits.used_credits + credits;
        const newRemaining = teamAdminCredits.remaining_credits - credits;

        const { error } = await supabase
          .from('user_credits')
          .update({
            used_credits: newUsed,
            remaining_credits: newRemaining,
            last_updated: new Date().toISOString()
          })
          .eq('user_id', teamAdminId);

        if (error) {
          console.error('Error using team admin credits:', error);
          return false;
        }

        // Log the usage under the team admin's account but note it was for the team member
        await supabase
          .from('credit_usage_log')
          .insert({
            user_id: teamAdminId,
            amount: -credits,
            type: 'debit',
            usage_type: 'api_usage',
            description: `Credit usage by team member ${userId}`
          });

        return true;
      }
    }

    return false;
  }

  /**
   * Add a team member to share team admin's credits
   */
  static async addTeamMemberToCreditSharing(teamAdminId: string, teamMemberId: string): Promise<boolean> {
    // Check if team admin has the team_admin role
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', teamAdminId)
      .single();

    if (!adminUser || adminUser.role !== 'team_admin') {
      console.error('User is not a team admin');
      return false;
    }

    // Check if team admin already has 4 team members
    const { data: existingMembers, error: countError } = await supabase
      .from('team_credit_sharing')
      .select('id')
      .eq('team_admin_id', teamAdminId);

    if (countError) {
      console.error('Error checking existing team members:', countError);
      return false;
    }

    if (existingMembers && existingMembers.length >= 4) {
      console.error('Team admin already has maximum of 4 team members');
      return false;
    }

    // Add the team member
    const { error } = await supabase
      .from('team_credit_sharing')
      .insert({
        team_admin_id: teamAdminId,
        team_member_id: teamMemberId
      });

    if (error) {
      console.error('Error adding team member to credit sharing:', error);
      return false;
    }

    return true;
  }

  /**
   * Remove a team member from team admin's credit sharing
   */
  static async removeTeamMemberFromCreditSharing(teamAdminId: string, teamMemberId: string): Promise<boolean> {
    const { error } = await supabase
      .from('team_credit_sharing')
      .delete()
      .eq('team_admin_id', teamAdminId)
      .eq('team_member_id', teamMemberId);

    if (error) {
      console.error('Error removing team member from credit sharing:', error);
      return false;
    }

    return true;
  }

  /**
   * Get all team members sharing credits with a team admin
   */
  static async getTeamMembersForAdmin(teamAdminId: string) {
    const { data, error } = await supabase
      .from('team_credit_sharing')
      .select(`
        team_member_id,
        created_at,
        users!team_credit_sharing_team_member_id_fkey(
          id, email, firstName, lastName, role
        )
      `)
      .eq('team_admin_id', teamAdminId);

    if (error) {
      console.error('Error fetching team members:', error);
      return [];
    }

    return data || [];
  }
} 