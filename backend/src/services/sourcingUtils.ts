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
  // Compute metrics purely from sourcing_leads signals for sourcing campaigns
  const { data: leads, error } = await supabase
    .from('sourcing_leads')
    .select('outreach_stage, reply_status')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const total = leads?.length || 0;
  const emailsSent = (leads || []).filter((l: any) => ['sent','scheduled','replied','bounced','unsubscribed'].includes(String(l.outreach_stage || '').toLowerCase())).length;
  const replied = (leads || []).filter((l: any) => String(l.reply_status || '').toLowerCase() === 'replied').length;

  return {
    total,
    queued: Math.max(total - emailsSent, 0),
    step1_sent: emailsSent,
    step2_sent: 0,
    step3_sent: 0,
    replied,
    bounced: 0,
    unsubscribed: 0,
    positive_replies: 0,
    neutral_replies: 0,
    negative_replies: 0
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
