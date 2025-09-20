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
    
    // Prefer relationship if present, otherwise we will do a manual fallback below
    const { data: eventsWithoutCampaign, error: eventsError } = await supabaseDb
      .from('email_events')
      .select(`
        id,
        message_id,
        campaign_id,
        event_type,
        event_timestamp,
        lead_id,
        metadata
      `)
      .eq('user_id', userId)
      .is('campaign_id', null)
      .limit(1000);

    if (eventsError) {
      console.error('[backfillCampaignAttribution] Error finding email events:', eventsError);
      results.errors.push({ step: 'find_email_events', error: eventsError.message });
    } else {
      console.log(`[backfillCampaignAttribution] Found ${eventsWithoutCampaign?.length || 0} email events to fix`);
      
      if (eventsWithoutCampaign && eventsWithoutCampaign.length > 0) {
        if (!dryRun) {
          const batchSize = 50;
          for (let i = 0; i < eventsWithoutCampaign.length; i += batchSize) {
            const batch = eventsWithoutCampaign.slice(i, i + batchSize);
            for (const ev of batch as any[]) {
              let campaignIdToSet: string | null = null;
              // 1) Try to resolve via message identifiers
              if (ev.message_id) {
                try {
                  const { data: msgByHeader } = await supabaseDb
                    .from('messages')
                    .select('campaign_id')
                    .or(`message_id.eq.${ev.message_id},message_id_header.eq.${ev.message_id},sg_message_id.eq.${ev.message_id}`)
                    .limit(1)
                    .maybeSingle();
                  if (msgByHeader?.campaign_id) campaignIdToSet = msgByHeader.campaign_id;
                } catch {}
              }
              // 2) Try via lead_id
              if (!campaignIdToSet && ev.lead_id) {
                try {
                  const { data: leadRow } = await supabaseDb
                    .from('leads')
                    .select('campaign_id')
                    .eq('id', ev.lead_id)
                    .maybeSingle();
                  if (leadRow?.campaign_id) campaignIdToSet = leadRow.campaign_id;
                } catch {}
              }
              // 3) Try via recipient email (metadata.email) → latest message
              const metaEmail = (ev.metadata && ev.metadata.email) ? ev.metadata.email : null;
              if (!campaignIdToSet && metaEmail) {
                try {
                  const { data: msgByEmail } = await supabaseDb
                    .from('messages')
                    .select('campaign_id,sent_at')
                    .eq('to_email', metaEmail)
                    .order('sent_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (msgByEmail?.campaign_id) campaignIdToSet = msgByEmail.campaign_id;
                } catch {}
              }

              if (campaignIdToSet) {
                const { error: updErr } = await supabaseDb
                  .from('email_events')
                  .update({ campaign_id: campaignIdToSet })
                  .eq('id', ev.id);
                if (updErr) {
                  console.error(`[backfillCampaignAttribution] Error updating email_event ${ev.id}:`, updErr);
                  results.errors.push({ step: 'update_email_event', event_id: ev.id, error: updErr.message });
                } else {
                  results.email_events_fixed++;
                }
              }
            }
          }
        } else {
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

    // Step 4: Events with null user_id but resolvable via messages by recipient (attach to this user only)
    console.log('[backfillCampaignAttribution] Step 4: Resolving events with null user_id via recipient email → latest message for this user');
    try {
      const { data: unknownEvents } = await supabaseDb
        .from('email_events')
        .select('id, user_id, campaign_id, message_id, metadata')
        .is('campaign_id', null)
        .is('user_id', null)
        .limit(1000);
      for (const ev of (unknownEvents || []) as any[]) {
        const metaEmail = ev?.metadata?.email;
        if (!metaEmail) continue;
        const { data: msgByEmail } = await supabaseDb
          .from('messages')
          .select('campaign_id, user_id, sent_at')
          .eq('to_email', metaEmail)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msgByEmail?.campaign_id && msgByEmail?.user_id === userId) {
          if (!dryRun) {
            const { error: upd } = await supabaseDb
              .from('email_events')
              .update({ campaign_id: msgByEmail.campaign_id, user_id: userId })
              .eq('id', ev.id);
            if (!upd) results.email_events_fixed++;
          } else {
            results.email_events_fixed++;
          }
        }
      }
    } catch (e) {
      console.warn('[backfillCampaignAttribution] Step 4 warning:', e);
    }

    // Step 5: Backfill email_replies.campaign_id using leads/messages
    console.log('[backfillCampaignAttribution] Step 5: Backfilling email_replies campaign_id');
    try {
      const { data: replies } = await supabaseDb
        .from('email_replies')
        .select('id, user_id, lead_id, campaign_id')
        .eq('user_id', userId)
        .is('campaign_id', null)
        .limit(1000);
      for (const r of (replies || []) as any[]) {
        let cid: string | null = null;
        // Prefer lead.campaign_id
        if (r.lead_id) {
          const { data: leadRow } = await supabaseDb
            .from('leads')
            .select('campaign_id')
            .eq('id', r.lead_id)
            .maybeSingle();
          if (leadRow?.campaign_id) cid = leadRow.campaign_id;
        }
        // Fallback: latest message to same lead for this user
        if (!cid && r.lead_id) {
          const { data: msgRow } = await supabaseDb
            .from('messages')
            .select('campaign_id')
            .eq('user_id', userId)
            .eq('lead_id', r.lead_id)
            .not('campaign_id', 'is', null)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (msgRow?.campaign_id) cid = msgRow.campaign_id;
        }
        if (cid && !dryRun) {
          const { error: upd } = await supabaseDb
            .from('email_replies')
            .update({ campaign_id: cid })
            .eq('id', r.id);
          if (!upd) results.email_events_fixed++; // reuse counter for simplicity
        }
      }
    } catch (e) {
      console.warn('[backfillCampaignAttribution] Step 5 warning:', e);
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