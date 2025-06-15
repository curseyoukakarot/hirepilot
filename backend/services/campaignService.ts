import { supabaseDb } from '../lib/supabase';
import { CreditService } from './creditService';

interface Campaign {
  id: string;
  name: string;
  user_id: string;
  status: string;
  leads: any[];
}

export class CampaignService {
  /**
   * Create a new campaign
   */
  static async createCampaign(userId: string, campaignData: Partial<Campaign>) {
    const { data, error } = await supabaseDb
      .from('campaigns')
      .insert({
        ...campaignData,
        user_id: userId,
        status: 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }

    return data;
  }

  /**
   * Import leads into a campaign
   */
  static async importLeads(userId: string, campaignId: string, leads: any[]) {
    // Check if user has enough credits
    const hasCredits = await CreditService.hasSufficientCredits(userId, leads.length);
    if (!hasCredits) {
      throw new Error('Insufficient credits to import leads');
    }

    try {
      // Start importing leads
      const { error: importError } = await supabaseDb
        .from('campaign_leads')
        .insert(
          leads.map(lead => ({
            campaign_id: campaignId,
            user_id: userId,
            ...lead
          }))
        );

      if (importError) {
        throw importError;
      }

      // Deduct credits
      await CreditService.deductCredits(userId, leads.length, 'campaign_creation', `Imported ${leads.length} leads to campaign ${campaignId}`);

      return true;
    } catch (error) {
      console.error('Error importing leads:', error);
      throw error;
    }
  }

  /**
   * Get campaign details
   */
  static async getCampaign(userId: string, campaignId: string) {
    const { data, error } = await supabaseDb
      .from('campaigns')
      .select(`
        *,
        campaign_leads (*)
      `)
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error getting campaign:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get all campaigns for a user
   */
  static async getCampaigns(userId: string) {
    const { data, error } = await supabaseDb
      .from('campaigns')
      .select(`
        *,
        campaign_leads (count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting campaigns:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(userId: string, campaignId: string, status: string) {
    const { data, error } = await supabaseDb
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign status:', error);
      throw error;
    }

    return data;
  }
} 