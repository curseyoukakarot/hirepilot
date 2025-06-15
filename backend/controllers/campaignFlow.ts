import { supabase } from '../lib/supabase';
import { triggerLinkedInSearch } from '../services/phantombuster/triggerLinkedInSearch';
import { enrichLead as enrichWithApollo } from '../services/apollo/enrichLead';
import { enrichLead as enrichWithProxycurl } from '../services/proxycurl/enrichLead';
import { validateEmail } from '../services/neverbounce/validateEmail';

interface CampaignFlowParams {
  campaignId: string;
  userId: string;
  searchUrl: string;
}

export async function startCampaignFlow({ campaignId, userId, searchUrl }: CampaignFlowParams) {
  try {
    // 1. Start LinkedIn search with PhantomBuster
    const phantomResponse = await triggerLinkedInSearch({
      searchUrl,
      userId,
      campaignId
    });

    // 2. Set up webhook listener for PhantomBuster results
    // This will be handled by a separate webhook endpoint

    return {
      success: true,
      message: 'Campaign flow started successfully',
      phantomExecutionId: phantomResponse.id
    };
  } catch (error: any) {
    console.error('[startCampaignFlow] Error:', error);
    throw new Error(error.message || 'Failed to start campaign flow');
  }
}

export async function processLead(leadId: string) {
  try {
    // 1. Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
    }

    // 2. Try Apollo enrichment first
    try {
      await enrichWithApollo({
        leadId,
        userId: lead.user_id,
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company,
        linkedinUrl: lead.linkedin_url
      });
    } catch (apolloError) {
      console.warn('[processLead] Apollo enrichment failed, trying Proxycurl:', apolloError);
      
      // 3. Fallback to Proxycurl if Apollo fails
      try {
        await enrichWithProxycurl({
          leadId,
          linkedinUrl: lead.linkedin_url
        });
      } catch (proxycurlError) {
        console.error('[processLead] Proxycurl enrichment failed:', proxycurlError);
        // Continue with email validation even if both enrichments fail
      }
    }

    // 4. Validate email if available
    if (lead.email) {
      try {
        await validateEmail({
          leadId,
          email: lead.email
        });
      } catch (validationError) {
        console.error('[processLead] Email validation failed:', validationError);
      }
    }

    // 5. Update lead status
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (updateError) {
      throw new Error('Failed to update lead status');
    }

    return {
      success: true,
      message: 'Lead processed successfully'
    };
  } catch (error: any) {
    console.error('[processLead] Error:', error);
    throw new Error(error.message || 'Failed to process lead');
  }
}

export async function handlePhantomBusterWebhook(executionId: string, results: any[]) {
  try {
    // 1. Get campaign execution details
    const { data: execution, error: executionError } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', executionId)
      .single();

    if (executionError || !execution) {
      throw new Error('Campaign execution not found');
    }

    // 2. Process each lead from PhantomBuster results
    for (const result of results) {
      // Create lead in database
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: execution.user_id,
          campaign_id: execution.campaign_id,
          first_name: result.firstName,
          last_name: result.lastName,
          title: result.title,
          company: result.company,
          linkedin_url: result.linkedinUrl,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (leadError || !lead) {
        console.error('[handlePhantomBusterWebhook] Failed to create lead:', leadError);
        continue;
      }

      // Process lead asynchronously
      processLead(lead.id).catch(error => {
        console.error(`[handlePhantomBusterWebhook] Failed to process lead ${lead.id}:`, error);
      });
    }

    // 3. Update campaign execution status
    const { error: updateError } = await supabase
      .from('campaign_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', executionId);

    if (updateError) {
      throw new Error('Failed to update campaign execution status');
    }

    return {
      success: true,
      message: 'Webhook processed successfully'
    };
  } catch (error: any) {
    console.error('[handlePhantomBusterWebhook] Error:', error);
    throw new Error(error.message || 'Failed to process webhook');
  }
} 