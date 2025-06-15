import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getCreditsForPlan } from '../config/pricing';

// Load environment variables first
dotenv.config();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
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
  balance: number;
  created_at: string;
  updated_at: string;
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
        balance: initialCredits
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

    const { error } = await supabase
      .from('user_credits')
      .update({
        balance: userCredits.balance + credits
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

    if (userCredits.balance < credits) {
      console.error('Insufficient credits');
      return false;
    }

    const { error } = await supabase
      .from('user_credits')
      .update({
        balance: userCredits.balance - credits
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error using credits:', error);
      return false;
    }

    return true;
  }

  static async getRemainingCredits(userId: string): Promise<number> {
    const userCredits = await this.getUserCredits(userId);
    return userCredits?.balance || 0;
  }

  static async handleSubscriptionChange(userId: string, planId: string): Promise<boolean> {
    const credits = getCreditsForPlan(planId);
    return this.addCredits(userId, credits);
  }

  static async checkCreditStatus(userId: string): Promise<{
    balance: number;
    created_at: string;
    updated_at: string;
  } | null> {
    const userCredits = await this.getUserCredits(userId);
    
    if (!userCredits) {
      return null;
    }

    return {
      balance: userCredits.balance,
      created_at: userCredits.created_at,
      updated_at: userCredits.updated_at
    };
  }

  /**
   * Get user's current credit balance
   */
  static async getCreditBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting credit balance:', error);
      throw error;
    }

    return data?.balance || 0;
  }

  /**
   * Allocate credits to user
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
        balance: amount,
        updated_at: new Date()
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
   * Deduct credits from user
   */
  static async deductCredits(userId: string, amount: number, usageType: CreditUsageType, description: string) {
    // Get current balance
    const currentBalance = await this.getCreditBalance(userId);

    if (currentBalance < amount) {
      throw new Error('Insufficient credits');
    }

    // Log the deduction
    const { error: logError } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: userId,
        amount: -amount,
        type: 'debit',
        usage_type: usageType,
        description: description
      });

    if (logError) {
      console.error('Error logging credit deduction:', logError);
      throw logError;
    }

    // Update balance
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        balance: currentBalance - amount,
        updated_at: new Date()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating credit balance:', updateError);
      throw updateError;
    }
  }

  /**
   * Check if user has sufficient credits
   */
  static async hasSufficientCredits(userId: string, requiredAmount: number): Promise<boolean> {
    const balance = await this.getCreditBalance(userId);
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
} 