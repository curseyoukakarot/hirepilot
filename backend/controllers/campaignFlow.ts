import { supabaseDb as supabase } from '../lib/supabase';
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

    // CRITICAL: Immediately mark as processing to prevent duplicate processing by monitor
    console.log('[handlePhantomBusterWebhook] Marking execution as processing to prevent duplicates:', executionId);
    const { error: statusError } = await supabase
      .from('campaign_executions')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', executionId);

    if (statusError) {
      console.error('[handlePhantomBusterWebhook] Failed to update status to processing:', statusError);
      // Continue anyway, but log the error
    }

    // 2. Process each lead from PhantomBuster results
    console.log('[handlePhantomBusterWebhook] Processing', results.length, 'results for execution:', execution);
    
    for (const result of results) {
      console.log('[handlePhantomBusterWebhook] Processing lead:', result);
      console.log('[handlePhantomBusterWebhook] Lead field names:', Object.keys(result));
      
      // Handle multiple possible field name variations from PhantomBuster
      const firstName = result.firstName || result.firstname || result.first_name || '';
      const lastName = result.lastName || result.lastname || result.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const title = result.title || result.jobTitle || result.headline || '';
      const company = result.company || result.companyName || result.company_name || '';
      const linkedinUrl = result.linkedinUrl || result.profileUrl || result.linkedin_url || result.profile_url || '';
      const location = result.location || result.city || result.region || '';
      const city = result.city || '';
      const state = result.state || result.region || '';
      const country = result.country || '';
      
      console.log('[handlePhantomBusterWebhook] Mapped fields:', {
        firstName, lastName, fullName, title, company, linkedinUrl, location
      });
      
      // Skip leads with no meaningful data to prevent duplicates
      if (!firstName && !lastName && !title && !company && !linkedinUrl) {
        console.log('[handlePhantomBusterWebhook] Skipping lead with no meaningful data');
        continue;
      }

      // Create lead in database
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: execution.user_id,
          campaign_id: execution.campaign_id,
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          title: title,
          company_name: company, // Use company_name instead of company
          linkedin_url: linkedinUrl || null, // Use null instead of empty string to avoid constraint issues
          location: location,
          city: city,
          state: state,
          country: country,
          campaign_location: location,
          status: 'New',
          source: 'Sales Navigator', // Use source instead of enrichment_source
          source_payload: JSON.stringify(result), // Use source_payload instead of enrichment_data for raw data
          enrichment_data: JSON.stringify({
            location: location,
            source: 'Sales Navigator',
            originalUrl: linkedinUrl
          }),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (leadError) {
        console.error('[handlePhantomBusterWebhook] Failed to create lead:', leadError);
        
        // If it's a duplicate constraint error, log and continue instead of failing
        if (leadError.code === '23505') {
          console.log('[handlePhantomBusterWebhook] Skipping duplicate lead:', { firstName, lastName, linkedinUrl });
          continue;
        }
        
        // For other errors, continue processing other leads
        continue;
      }

      if (!lead) {
        console.error('[handlePhantomBusterWebhook] Lead creation returned no data');
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
        // completed_at: new Date().toISOString(), // TODO: Add completed_at column to campaigns table
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