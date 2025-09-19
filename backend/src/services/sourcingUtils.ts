import { supabase } from '../lib/supabase';

export async function updateLeadOutreachStage(leadId: string, stage: string) {
  const { error } = await supabase
    .from('sourcing_leads')
    .update({ outreach_stage: stage })
    .eq('id', leadId);
  
  if (error) throw error;
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  const { error } = await supabase
    .from('sourcing_campaigns')
    .update({ status })
    .eq('id', campaignId);
  
  if (error) throw error;
}

export async function getCampaignStats(campaignId: string) {
  // Total leads from sourcing_leads for the campaign
  const { data: leads, error } = await supabase
    .from('sourcing_leads')
    .select('reply_status')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  // Emails sent from messages table (authoritative)
  const { count: sentCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'sent');

  // Replies and positives from email_events
  const { count: repliesCount } = await supabase
    .from('email_events')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('event_type', 'reply');

  // Placeholder for sentiment; keep zero unless reply classification exists elsewhere
  const positive_replies = 0;
  const neutral_replies = 0;
  const negative_replies = 0;

  return {
    total: leads?.length || 0,
    queued: 0,
    // Map aggregate into step1 for UI aggregate calc
    step1_sent: Number(sentCount || 0),
    step2_sent: 0,
    step3_sent: 0,
    replied: Number(repliesCount || 0),
    bounced: 0,
    unsubscribed: 0,
    positive_replies,
    neutral_replies,
    negative_replies
  };
}

export async function getCampaignWithDetails(campaignId: string) {
  const { data: campaign, error: campaignError } = await supabase
    .from('sourcing_campaigns')
    .select(`
      *,
      sourcing_sequences (
        id,
        steps_json,
        created_at
      ),
      email_senders (
        id,
        from_name,
        from_email,
        domain_verified
      )
    `)
    .eq('id', campaignId)
    .single();
  
  if (campaignError) throw campaignError;
  
  const stats = await getCampaignStats(campaignId);
  
  return {
    ...campaign,
    stats
  };
}

export async function getLeadsForCampaign(campaignId: string, limit = 100, offset = 0) {
  const { data: leads, error } = await supabase
    .from('sourcing_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return leads;
}

export async function searchCampaigns(filters: {
  status?: string;
  created_by?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('sourcing_campaigns')
    .select(`
      *,
      email_senders (
        from_name,
        from_email
      )
    `);
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.created_by) {
    query = query.eq('created_by', filters.created_by);
  }
  
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }
  
  query = query
    .order('created_at', { ascending: false })
    .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data;
}
