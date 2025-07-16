import { supabaseDb as supabase } from '../lib/supabase';
import { triggerLinkedInSearch } from '../services/phantombuster/triggerLinkedInSearch';
import { enrichLead as enrichWithApollo } from '../services/apollo/enrichLead';
import { validateEmail } from '../services/neverbounce/validateEmail';
import { 
  sendSalesNavigatorStartNotifications,
  sendSalesNavigatorSuccessNotifications, 
  sendSalesNavigatorNoResultsNotifications 
} from '../services/salesNavigatorNotificationService';

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

    // 2. Send start notifications with timing expectations
    try {
      await sendSalesNavigatorStartNotifications(
        userId,
        campaignId,
        { searchUrl }
      );
    } catch (notificationError) {
      console.error('[startCampaignFlow] Error sending start notifications:', notificationError);
      // Don't fail the campaign start if notifications fail
    }

    // 3. Set up webhook listener for PhantomBuster results
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

    // 2. Try Apollo enrichment
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
      console.warn('[processLead] Apollo enrichment failed:', apolloError);
      // Continue with email validation even if enrichment fails
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

    // 2. Deduct credits for LinkedIn lead sourcing (50 credits per campaign)
    const LINKEDIN_CAMPAIGN_COST = 50; // Fixed cost per LinkedIn campaign
    try {
      const { CreditService } = await import('../services/creditService');
      await CreditService.useCreditsEffective(execution.user_id, LINKEDIN_CAMPAIGN_COST);
      
      // Log the specific usage for LinkedIn campaign
      await CreditService.logCreditUsage(
        execution.user_id, 
        LINKEDIN_CAMPAIGN_COST, 
        'api_usage', 
        `LinkedIn campaign execution: ${LINKEDIN_CAMPAIGN_COST} credits for ${results.length} leads found`
      );
      
      console.log(`[handlePhantomBusterWebhook] Deducted ${LINKEDIN_CAMPAIGN_COST} credits for LinkedIn campaign`);
    } catch (creditError) {
      console.error('[handlePhantomBusterWebhook] Error deducting credits:', creditError);
      // Continue processing but log the credit error
    }

    // 3. Process each lead from PhantomBuster results
    console.log('[handlePhantomBusterWebhook] Processing', results.length, 'results for execution:', execution);
    
    for (const result of results) {
      console.log('[handlePhantomBusterWebhook] Processing lead:', result);
      console.log('[handlePhantomBusterWebhook] Lead field names:', Object.keys(result));
      
      // Handle multiple possible field name variations from PhantomBuster
      const firstName = result.firstName || result.firstname || result.first_name || '';
      const lastName = result.lastName || result.lastname || result.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const title = result.title || result.jobTitle || result.linkedinJobTitle || result.headline || '';
      const company = result.company || result.companyName || result.company_name || '';
      
      // CRITICAL: Use the correct LinkedIn profile URL field from PhantomBuster
      // defaultProfileUrl contains the REAL LinkedIn profile URL (perfect for enrichment)
      // profileUrl and linkedInProfileUrl contain Sales Navigator URLs (useless for enrichment)
      let linkedinUrl = result.defaultProfileUrl || result.default_profile_url || '';
      
      // Add https:// if missing
      if (linkedinUrl && !linkedinUrl.startsWith('http')) {
        linkedinUrl = 'https://' + linkedinUrl;
      }
      
      console.log(`[handlePhantomBusterWebhook] Found LinkedIn URL: ${linkedinUrl}`);
      
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
          company: company, // Frontend expects 'company' not 'company_name'
          linkedin_url: linkedinUrl || null, // Use null instead of empty string to avoid constraint issues
          city: city,
          state: state,
          country: country,
          campaign_location: location,
          status: 'New',
          source_payload: JSON.stringify(result), // Store raw data in source_payload
          enrichment_data: JSON.stringify({
            location: location, // Frontend reads location from enrichment_data.location
            source: 'Sales Navigator', // Frontend reads source from enrichment_data.source
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
      // for better Apollo enrichment compatibility
    }

    // 4. Update campaign counts
    console.log('[handlePhantomBusterWebhook] Updating campaign lead counts for campaign:', execution.campaign_id);
    
    const { count: totalLeads, error: totalError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', execution.campaign_id);

    const { count: enrichedLeads, error: enrichedError } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', execution.campaign_id)
      .not('email', 'is', null)
      .neq('email', '');

    if (totalError) {
      console.error('[handlePhantomBusterWebhook] Error getting total leads count:', totalError);
    }
    if (enrichedError) {
      console.error('[handlePhantomBusterWebhook] Error getting enriched leads count:', enrichedError);
    }

    // 5. Update campaign execution status
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

    // 6. Update campaign status to completed with proper lead counts
    console.log('[handlePhantomBusterWebhook] Updating campaign status to completed for campaign:', execution.campaign_id);
    
    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        total_leads: totalLeads || 0,
        enriched_leads: enrichedLeads || 0,
        // completed_at: new Date().toISOString(), // TODO: Add completed_at column to campaigns table
        updated_at: new Date().toISOString()
      })
      .eq('id', execution.campaign_id);

    if (campaignUpdateError) {
      console.error('[handlePhantomBusterWebhook] Failed to update campaign status:', campaignUpdateError);
      // Don't fail the request since leads were already processed
    } else {
      console.log(`[handlePhantomBusterWebhook] Campaign status updated to completed with ${totalLeads} total leads, ${enrichedLeads} enriched`);
    }

    // 7. Send completion notifications (no results case - success case handled by CRON monitor)
    try {
      // Get campaign details for search URL
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('lead_source_payload')
        .eq('id', execution.campaign_id)
        .single();
        
      const searchUrl = campaign?.lead_source_payload?.linkedin_search_url;
      
      if ((totalLeads || 0) === 0) {
        // Send no results notifications
        console.log('[handlePhantomBusterWebhook] Sending no results notifications');
        await sendSalesNavigatorNoResultsNotifications(
          execution.user_id,
          execution.campaign_id,
          { searchUrl }
        );
      } else {
        console.log('[handlePhantomBusterWebhook] Success notifications will be sent by CRON monitor');
      }
    } catch (notificationError) {
      console.error('[handlePhantomBusterWebhook] Error sending completion notifications:', notificationError);
      // Don't fail the request since leads were already processed
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