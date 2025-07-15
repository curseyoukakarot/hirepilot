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
        status: 'Contacted',
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
    console.log('[handlePhantomBusterWebhook] Processing', results.length, 'results for execution:', execution);
    
    for (const result of results) {
      console.log('[handlePhantomBusterWebhook] Processing lead:', result);
      
      // Create lead in database
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: execution.user_id,
          campaign_id: execution.campaign_id,
          first_name: result.firstName,
          last_name: result.lastName,
          name: `${result.firstName || ''} ${result.lastName || ''}`.trim(),
          title: result.title,
          company: result.company,
          linkedin_url: result.linkedinUrl,
          location: result.location || '',
          city: result.city || '',
          state: result.state || '',
          country: result.country || '',
          campaign_location: result.location || '',
          status: 'New',
          enrichment_source: 'Sales Navigator',
          enrichment_data: JSON.stringify({
            location: result.location || '',
            source: 'Sales Navigator',
            originalUrl: result.linkedinUrl || ''
          }),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (leadError || !lead) {
        console.error('[handlePhantomBusterWebhook] Failed to create lead:', leadError);
        continue;
      }

      console.log('[handlePhantomBusterWebhook] Created lead:', lead.id);

      // Note: Automatic enrichment removed - users can manually enrich leads later
      // via POST /api/leads/:id/enrich endpoint
      
      // TODO: Update LinkedIn URLs from Sales Navigator to regular profile URLs
      // for better Apollo/Proxycurl enrichment compatibility
    }

    // 3. Update campaign execution status
    console.log('[handlePhantomBusterWebhook] Updating execution status for ID:', executionId);
    
    const { data: updateData, error: updateError } = await supabase
      .from('campaign_executions')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', executionId)
      .select();

    console.log('[handlePhantomBusterWebhook] Update result:', { updateData, updateError });

    if (updateError) {
      throw new Error(`Failed to update campaign execution status: ${updateError.message}`);
    }

    if (!updateData || updateData.length === 0) {
      console.warn('[handlePhantomBusterWebhook] No rows updated - execution ID may not exist:', executionId);
    }

    // 4. Update campaign status to completed
    console.log('[handlePhantomBusterWebhook] Updating campaign status to completed for campaign:', execution.campaign_id);
    
    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.campaign_id);

    if (campaignUpdateError) {
      console.error('[handlePhantomBusterWebhook] Failed to update campaign status:', campaignUpdateError);
      // Don't fail the request since leads were already processed
    } else {
      console.log('[handlePhantomBusterWebhook] Campaign status updated to completed');
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