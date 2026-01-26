import { supabase } from '../lib/supabase';
import { applyWorkspaceScope, WORKSPACES_ENFORCE_STRICT } from '../lib/workspaceScope';

const scopedCampaigns = (workspaceId?: string | null, userId?: string | null) => {
  if (!workspaceId) return supabase.from('sourcing_campaigns');
  return applyWorkspaceScope(supabase.from('sourcing_campaigns'), {
    workspaceId,
    userId: userId || undefined,
    ownerColumn: 'created_by'
  });
};

const scopedLeads = (workspaceId?: string | null) => {
  const base = supabase.from('sourcing_leads');
  if (!workspaceId) return base;
  if (WORKSPACES_ENFORCE_STRICT) return base.eq('workspace_id', workspaceId);
  return base.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
};

export async function updateLeadOutreachStage(leadId: string, stage: string, workspaceId?: string | null) {
  const { error } = await scopedLeads(workspaceId)
    .update({ outreach_stage: stage })
    .eq('id', leadId);
  
  if (error) throw error;
}

export async function updateCampaignStatus(campaignId: string, status: string, workspaceId?: string | null, userId?: string | null) {
  const { error } = await scopedCampaigns(workspaceId, userId)
    .update({ status })
    .eq('id', campaignId);
  
  if (error) throw error;
}

export async function getCampaignStats(campaignId: string, workspaceId?: string | null) {
  // Compute metrics purely from sourcing_leads signals for sourcing campaigns
  const { data: leads, error } = await scopedLeads(workspaceId)
    .select('outreach_stage, reply_status')
    .eq('campaign_id', campaignId);
  if (error) throw error;

  const total = leads?.length || 0;
  const stage = (v: any) => String(v || '').toLowerCase();
  // Treat any "step*_sent" as an email send.
  const emailsSent = (leads || []).filter((l: any) => {
    const s = stage(l.outreach_stage);
    return [
      'sent',
      'scheduled',
      'step1_sent',
      'step2_sent',
      'step3_sent',
      'replied',
      'bounced',
      'unsubscribed'
    ].includes(s);
  }).length;
  const replied = (leads || []).filter((l: any) => stage(l.outreach_stage) === 'replied' || stage(l.reply_status) === 'replied').length;
  const positiveReplies = (leads || []).filter((l: any) => stage(l.reply_status) === 'positive').length;
  const neutralReplies = (leads || []).filter((l: any) => stage(l.reply_status) === 'neutral').length;
  const negativeReplies = (leads || []).filter((l: any) => stage(l.reply_status) === 'negative').length;

  return {
    total,
    queued: Math.max(total - emailsSent, 0),
    step1_sent: emailsSent,
    step2_sent: 0,
    step3_sent: 0,
    replied,
    bounced: 0,
    unsubscribed: 0,
    positive_replies: positiveReplies,
    neutral_replies: neutralReplies,
    negative_replies: negativeReplies
  };
}

export async function getCampaignWithDetails(campaignId: string, workspaceId?: string | null, userId?: string | null) {
  const { data: campaign, error: campaignError } = await scopedCampaigns(workspaceId, userId)
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
  
  const stats = await getCampaignStats(campaignId, workspaceId);
  
  return {
    ...campaign,
    stats
  };
}

export async function getLeadsForCampaign(
  campaignId: string,
  limit = 100,
  offset = 0,
  workspaceId?: string | null
) {
  const { data: leads, error } = await scopedLeads(workspaceId)
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return leads;
}

export async function searchCampaigns(
  filters: {
  status?: string;
  created_by?: string;
  search?: string;
  limit?: number;
  offset?: number;
  },
  workspaceId?: string | null
) {
  let query = scopedCampaigns(workspaceId, filters.created_by || null)
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
