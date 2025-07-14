import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function backfillCampaignAttribution(req: Request, res: Response) {
  try {
    const userId = req.query.user_id as string;
    const dryRun = req.query.dry_run === 'true';

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' });
    }

    console.log('[backfillCampaignAttribution] Starting backfill for user:', userId, 'dry_run:', dryRun);

    const results = {
      user_id: userId,
      dry_run: dryRun,
      messages_fixed: 0,
      email_events_fixed: 0,
      errors: [] as any[]
    };

    // Step 1: Fix messages with null campaign_id by getting it from their associated lead
    console.log('[backfillCampaignAttribution] Step 1: Finding messages with null campaign_id...');
    
    const { data: messagesWithoutCampaign, error: messagesError } = await supabaseDb
      .from('messages')
      .select(`
        id, 
        lead_id, 
        campaign_id,
        to_email,
        subject,
        created_at,
        leads!inner(campaign_id, email, first_name, last_name)
      `)
      .eq('user_id', userId)
      .is('campaign_id', null)
      .not('leads.campaign_id', 'is', null);

    if (messagesError) {
      console.error('[backfillCampaignAttribution] Error finding messages:', messagesError);
      results.errors.push({ step: 'find_messages', error: messagesError.message });
    } else {
      console.log(`[backfillCampaignAttribution] Found ${messagesWithoutCampaign?.length || 0} messages to fix`);
      
      if (messagesWithoutCampaign && messagesWithoutCampaign.length > 0) {
        if (!dryRun) {
          // Update messages in batches
          const batchSize = 10;
          for (let i = 0; i < messagesWithoutCampaign.length; i += batchSize) {
            const batch = messagesWithoutCampaign.slice(i, i + batchSize);
            
            for (const message of batch) {
              const { error: updateError } = await supabaseDb
                .from('messages')
                .update({ campaign_id: (message.leads as any).campaign_id })
                .eq('id', message.id);

              if (updateError) {
                console.error(`[backfillCampaignAttribution] Error updating message ${message.id}:`, updateError);
                results.errors.push({ step: 'update_message', message_id: message.id, error: updateError.message });
              } else {
                results.messages_fixed++;
              }
            }
          }
        } else {
          // Dry run - just count
          results.messages_fixed = messagesWithoutCampaign.length;
        }
      }
    }

    // Step 2: Fix email_events with null campaign_id by getting it from their associated message
    console.log('[backfillCampaignAttribution] Step 2: Finding email_events with null campaign_id...');
    
    const { data: eventsWithoutCampaign, error: eventsError } = await supabaseDb
      .from('email_events')
      .select(`
        id, 
        message_id, 
        campaign_id,
        event_type,
        event_timestamp,
        messages!inner(campaign_id, to_email, subject)
      `)
      .eq('user_id', userId)
      .is('campaign_id', null)
      .not('messages.campaign_id', 'is', null);

    if (eventsError) {
      console.error('[backfillCampaignAttribution] Error finding email events:', eventsError);
      results.errors.push({ step: 'find_email_events', error: eventsError.message });
    } else {
      console.log(`[backfillCampaignAttribution] Found ${eventsWithoutCampaign?.length || 0} email events to fix`);
      
      if (eventsWithoutCampaign && eventsWithoutCampaign.length > 0) {
        if (!dryRun) {
          // Update email_events in batches
          const batchSize = 10;
          for (let i = 0; i < eventsWithoutCampaign.length; i += batchSize) {
            const batch = eventsWithoutCampaign.slice(i, i + batchSize);
            
            for (const event of batch) {
              const { error: updateError } = await supabaseDb
                .from('email_events')
                .update({ campaign_id: (event.messages as any).campaign_id })
                .eq('id', event.id);

              if (updateError) {
                console.error(`[backfillCampaignAttribution] Error updating event ${event.id}:`, updateError);
                results.errors.push({ step: 'update_email_event', event_id: event.id, error: updateError.message });
              } else {
                results.email_events_fixed++;
              }
            }
          }
        } else {
          // Dry run - just count
          results.email_events_fixed = eventsWithoutCampaign.length;
        }
      }
    }

    // Step 3: Handle orphaned email_events (events without corresponding messages)
    console.log('[backfillCampaignAttribution] Step 3: Finding orphaned email_events...');
    
    const { data: orphanedEvents, error: orphanedError } = await supabaseDb
      .from('email_events')
      .select(`
        id,
        message_id,
        lead_id,
        campaign_id,
        event_type,
        leads!inner(campaign_id, email, first_name, last_name)
      `)
      .eq('user_id', userId)
      .is('campaign_id', null)
      .not('leads.campaign_id', 'is', null);

    if (orphanedError) {
      console.error('[backfillCampaignAttribution] Error finding orphaned events:', orphanedError);
      results.errors.push({ step: 'find_orphaned_events', error: orphanedError.message });
    } else {
      console.log(`[backfillCampaignAttribution] Found ${orphanedEvents?.length || 0} orphaned email events to fix`);
      
      if (orphanedEvents && orphanedEvents.length > 0) {
        if (!dryRun) {
          // Update orphaned events using lead.campaign_id
          for (const event of orphanedEvents) {
            const { error: updateError } = await supabaseDb
              .from('email_events')
              .update({ campaign_id: (event.leads as any).campaign_id })
              .eq('id', event.id);

            if (updateError) {
              console.error(`[backfillCampaignAttribution] Error updating orphaned event ${event.id}:`, updateError);
              results.errors.push({ step: 'update_orphaned_event', event_id: event.id, error: updateError.message });
            } else {
              results.email_events_fixed++;
            }
          }
        } else {
          // Dry run - add to count
          results.email_events_fixed += orphanedEvents.length;
        }
      }
    }

    const summary = {
      status: 'completed',
      ...results,
      summary: {
        messages_fixed: results.messages_fixed,
        email_events_fixed: results.email_events_fixed,
        total_fixes: results.messages_fixed + results.email_events_fixed,
        errors_count: results.errors.length,
        recommendation: results.errors.length === 0 && (results.messages_fixed > 0 || results.email_events_fixed > 0) 
          ? 'Backfill completed successfully. Campaign metrics should now show correct numbers.'
          : results.errors.length > 0 
            ? 'Some errors occurred. Check the errors array for details.'
            : 'No attribution issues found.'
      }
    };

    console.log('[backfillCampaignAttribution] Backfill completed:', summary);
    return res.json(summary);

  } catch (error) {
    console.error('[backfillCampaignAttribution] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 