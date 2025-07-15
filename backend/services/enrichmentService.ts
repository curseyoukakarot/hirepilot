import { supabaseDb } from '../lib/supabase';
import { enrichBatch } from '../utils/apolloApi';
import { Campaign, Lead } from '../types/campaign';
import { SupabaseClient } from '@supabase/supabase-js';
import { ApolloClient, DefaultApolloClient } from './apolloClient';
import { EnrichedPerson } from '../types/apollo';
import { v4 as uuidv4 } from 'uuid';
import { sendApolloEnrichmentNotifications } from './apolloNotificationService';

const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 1000;
const MAX_RETRIES = 5;

interface EnrichmentJob {
  id: string;
  campaignId: string;
  userId: string;
  apolloIds: string[];
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error?: string;
  progress?: number;
  created_at?: string;
  updated_at?: string;
}

interface EnrichedData {
  email?: string;
  location?: string;
  // Add other enriched fields as needed
}

interface LeadUpdate {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  title: string;
  company: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_unlocked: boolean;
  enriched_at: string;
  apollo_id: string;
  enrichment_data: {
    apollo: {
      person_id: string;
      organization?: {
        name: string;
        website_url?: string;
      };
      email_status: string;
      confidence_score?: number;
      seniority?: string;
      department?: string;
      skills?: string[];
      social_profiles?: {
        twitter_url?: string;
        facebook_url?: string;
        github_url?: string;
      };
      raw_data?: any;
    };
  };
}

export class EnrichmentService {
  private supabase: SupabaseClient;
  private apolloClient: ApolloClient;

  constructor(
    supabase: SupabaseClient,
    apolloApiKey: string
  ) {
    this.supabase = supabase;
    this.apolloClient = new DefaultApolloClient(apolloApiKey);
  }

  private async wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async createEnrichmentJob(job: Omit<EnrichmentJob, 'id' | 'status'>): Promise<EnrichmentJob> {
    const { data, error } = await supabaseDb
      .from('lead_enrichment_jobs')
      .insert({
        campaign_id: job.campaignId,
        user_id: job.userId,
        apollo_ids: job.apolloIds,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async updateJobStatus(
    jobId: string,
    status: EnrichmentJob['status'],
    updates: Partial<EnrichmentJob> = {}
  ) {
    const { error } = await supabaseDb
      .from('lead_enrichment_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...updates
      })
      .eq('id', jobId);

    if (error) throw error;
  }

  private async updateCampaignStatus(campaignId: string, status: string) {
    const { error } = await supabaseDb
      .from('campaigns')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) throw error;
  }

  private async checkCredits(userId: string, count: number): Promise<boolean> {
    const { data: settings } = await supabaseDb
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    // If user has their own Apollo key, they don't need credits
    if (settings?.apollo_api_key) return true;

    const { data: credits } = await supabaseDb
      .from('user_credits')
      .select('remaining_credits')
      .eq('user_id', userId)
      .single();

    return (credits?.remaining_credits || 0) >= count;
  }

  private async debitCredits(userId: string, count: number) {
    const { error } = await supabaseDb
      .from('user_credits')
      .update({
        balance: `balance - ${count}`,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
  }

  private async updateLeadBatch(
    campaignId: string,
    enrichedPeople: EnrichedPerson[]
  ): Promise<void> {
    const updates = enrichedPeople.map(person => ({
      id: person.id,
      email: person.email,
      first_name: person.first_name || '',
      last_name: person.last_name || '',
      title: person.title || '',
      company: person.organization?.name || '',
      linkedin_url: person.linkedin_url ?? null,
      city: person.city ?? '',
      state: person.state ?? '',
      country: person.country ?? '',
      is_unlocked: true,
      enriched_at: new Date().toISOString(),
      apollo_id: person.id,
      enrichment_source: 'apollo',
      confidence: person.confidence_score || 0,
      enrichment_data: {
        apollo: {
          person_id: person.id || '',
          organization: person.organization,
          email_status: person.email_status || 'unknown',
          location: person.location,
          seniority: person.seniority,
          department: person.department,
          skills: person.skills,
        }
      },
      updated_at: new Date().toISOString()
    })) as LeadUpdate[];

    let successCount = 0;
    let errorCount = 0;

    // Update leads in batches
    for (let i = 0; i < updates.length; i++) {
      if (!enrichedPeople[i].id) {
        console.error(`Skipping update for lead at index ${i}: Missing Apollo ID`);
        errorCount++;
        continue;
      }

      const { error } = await supabaseDb
        .from('leads')
        .update(updates[i])
        .eq('campaign_id', campaignId)
        .eq('apollo_id', enrichedPeople[i].id);
      
      if (error) {
        console.error(`Failed to update lead at index ${i}:`, {
          error,
          lead: updates[i],
          apollo_id: enrichedPeople[i].id
        });
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log(`Batch update complete: ${successCount} succeeded, ${errorCount} failed`);

    // Get total and enriched lead counts
    const { count: totalLeads } = await supabaseDb
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId);

    const { count: enrichedLeads } = await supabaseDb
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', campaignId)
      .eq('is_unlocked', true);

    // Update campaign with counts and status
    const { error: campaignError } = await supabaseDb
      .from('campaigns')
      .update({ 
        total_leads: totalLeads,
        enriched_leads: enrichedLeads,
        status: errorCount > 0 ? 'failed' : 'active',
        error_message: errorCount > 0 ? `${errorCount} leads failed to enrich` : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (campaignError) {
      console.error('Failed to update campaign:', campaignError);
    }

    if (errorCount > 0) {
      console.warn(`Campaign ${campaignId}: ${errorCount} leads failed to update`);
    }
  }

  public async queueEnrichmentJob(job: Omit<EnrichmentJob, 'id' | 'status'>): Promise<EnrichmentJob> {
    // 1. Check credits before queuing
    const hasCredits = await this.checkCredits(job.userId, job.apolloIds.length);
    if (!hasCredits) {
      throw new Error('Insufficient email credits');
    }

    // 2. Create job record
    const enrichmentJob = await this.createEnrichmentJob(job);

    // 3. Update campaign status
    await this.updateCampaignStatus(job.campaignId, 'enriching');

    // 4. Start processing in background
    this.processEnrichmentJob(enrichmentJob).catch(error => {
      console.error('Background enrichment failed:', error);
    });

    return enrichmentJob;
  }

  public async processEnrichmentJob(job: EnrichmentJob): Promise<void> {
    try {
      // 1. Mark job as processing
      await this.updateJobStatus(job.id, 'processing');

      // 2. Get API key
      const { data: settings } = await supabaseDb
        .from('user_settings')
        .select('apollo_api_key')
        .eq('user_id', job.userId)
        .single();

      if (!settings?.apollo_api_key) {
        throw new Error('Apollo API key not found');
      }

      // 3. Process in batches of 10
      const batches: string[][] = [];
      for (let i = 0; i < job.apolloIds.length; i += BATCH_SIZE) {
        batches.push(job.apolloIds.slice(i, i + BATCH_SIZE));
      }

      let totalEnriched = 0;
      let retries = 0;
      let currentBatchIndex = 0;

      while (currentBatchIndex < batches.length) {
        const batch = batches[currentBatchIndex];
        try {
          // Enrich batch
          const enrichedPeopleRaw = await enrichBatch(settings.apollo_api_key, batch);
          const enrichedPeople = enrichedPeopleRaw.map(person => ({
            ...person,
            linkedin_url: person.linkedin_url ?? null,
            city: person.city ?? '',
            state: person.state ?? '',
            country: person.country ?? '',
            organization: person.organization
              ? { id: (person.organization as any).id || '', name: person.organization.name || '', website_url: person.organization.website_url || undefined, estimated_annual_revenue: (person.organization as any).estimated_annual_revenue || undefined, headquarters_location: (person.organization as any).headquarters_location || undefined, founded_year: (person.organization as any).founded_year || undefined, estimated_num_employees: (person.organization as any).estimated_num_employees || undefined, industry: (person.organization as any).industry || undefined }
              : undefined
          }));
          await this.updateLeadBatch(job.campaignId, enrichedPeople);
          totalEnriched += enrichedPeople.length;

          // Update progress
          const progress = Math.round((currentBatchIndex + 1) / batches.length * 100);
          await this.updateJobStatus(job.id, 'processing', { progress });

          // Rate limit between batches
          if (currentBatchIndex < batches.length - 1) {
            await this.wait(RATE_LIMIT_MS);
          }
          
          // Move to next batch on success
          currentBatchIndex++;
          retries = 0; // Reset retries on success
        } catch (error: any) {
          console.error('Batch enrichment error:', {
            campaignId: job.campaignId,
            batchIndex: currentBatchIndex,
            error: error.message
          });

          // Retry logic for rate limits
          if (error.response?.status === 429 && retries < MAX_RETRIES) {
            retries++;
            await this.wait(Math.pow(2, retries) * 1000);
            continue; // Retry same batch
          }

          // Move to next batch for other errors
          currentBatchIndex++;
          retries = 0;
        }
      }

      // 4. Update final status
      if (totalEnriched > 0) {
        await this.updateJobStatus(job.id, 'complete', { progress: 100 });
        await this.updateCampaignStatus(job.campaignId, 'active');
        
        // Send enrichment completion notifications
        sendApolloEnrichmentNotifications(job.userId, job.campaignId, totalEnriched, job.apolloIds.length)
          .catch(error => {
            console.error('[EnrichmentService] Error sending completion notifications:', error);
          });
      } else {
        throw new Error('No leads were enriched');
      }

      // 5. Debit credits if using HirePilot credits
      if (!settings.apollo_api_key) {
        await this.debitCredits(job.userId, totalEnriched);
      }
    } catch (error: any) {
      // Mark job as failed
      await this.updateJobStatus(job.id, 'failed', {
        error: error.message || 'Unknown error during enrichment'
      });
      await this.updateCampaignStatus(job.campaignId, 'failed');
    }
  }

  private async enrichLeadWithApollo(lead: any): Promise<EnrichedData> {
    const enriched = await this.apolloClient.enrichLead(lead);
    return { email: enriched.email ?? undefined, location: enriched.location ?? undefined };
  }

  private mapEnrichedPersonToLeadUpdate(enrichedData: EnrichedPerson): LeadUpdate {
    return {
      id: uuidv4(),
      email: enrichedData.email,
      first_name: enrichedData.first_name,
      last_name: enrichedData.last_name,
      title: enrichedData.title,
      company: enrichedData.organization?.name || null,
      linkedin_url: enrichedData.linkedin_url ?? null,
      city: enrichedData.city ?? null,
      state: enrichedData.state ?? null,
      country: enrichedData.country ?? null,
      is_unlocked: true,
      enriched_at: new Date().toISOString(),
      apollo_id: enrichedData.id,
      enrichment_data: {
        apollo: {
          person_id: enrichedData.id,
          organization: enrichedData.organization,
          email_status: enrichedData.email_status,
          confidence_score: enrichedData.confidence_score,
          seniority: enrichedData.seniority,
          department: enrichedData.department,
          skills: enrichedData.skills,
        }
      }
    };
  }

  async enrichCampaign(campaignId: string): Promise<void> {
    try {
      // Update campaign status to processing
      await supabaseDb
        .from('campaigns')
        .update({ status: 'processing' })
        .eq('id', campaignId);

      // Get campaign leads
      const { data: leads, error: leadsError } = await supabaseDb
        .from('leads')
        .select('*')
        .eq('campaign_id', campaignId);

      if (leadsError) throw leadsError;
      if (!leads) throw new Error('No leads found for campaign');

      const enrichedLeads: LeadUpdate[] = [];

      // Process each lead
      for (const lead of leads) {
        try {
          const enrichedData = await this.apolloClient.enrichLead(lead);
          const leadUpdate = this.mapEnrichedPersonToLeadUpdate(enrichedData);
          enrichedLeads.push(leadUpdate);
          
          // Rate limit between leads
          await this.wait(1000);

        } catch (error) {
          console.error(`Failed to enrich lead ${lead.id}:`, error);
          // Continue with other leads even if one fails
        }
      }

      // Launch campaign with enriched leads using the new function
      const { error: launchError } = await supabaseDb
        .rpc('launch_campaign', {
          _cid: campaignId,
          _leads: enrichedLeads
        });

      if (launchError) throw launchError;

    } catch (error) {
      console.error('Campaign enrichment failed:', error);
      
      // Update campaign with error status
      await supabaseDb
        .from('campaigns')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error occurred during enrichment'
        })
        .eq('id', campaignId);
      
      throw error;
    }
  }
} 