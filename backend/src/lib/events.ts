import { z } from 'zod';
import { supabase } from './supabase';
import { logger } from './logger';

export const EVENT_TYPES = {
  // --- Existing (keep stable) ---
  lead_created: 'lead_created',
  lead_updated: 'lead_updated',
  lead_converted: 'lead_converted',
  lead_enriched: 'lead_enriched',
  candidate_created: 'candidate_created',
  candidate_hired: 'candidate_hired',
  candidate_rejected: 'candidate_rejected',
  candidate_moved_to_stage: 'candidate_moved_to_stage',
  candidate_interviewed: 'candidate_interviewed',
  candidate_offered: 'candidate_offered',
  message_sent: 'message_sent',
  message_reply: 'message_reply',
  email_opened: 'email_opened',
  email_clicked: 'email_clicked',
  email_bounced: 'email_bounced',

  // --- Deals & Submissions ---
  opportunity_submitted: 'opportunity_submitted',
  opportunity_application_created: 'opportunity_application_created',
  opportunity_note_added: 'opportunity_note_added',
  opportunity_collaborator_added: 'opportunity_collaborator_added',
  deal_activity_logged: 'deal_activity_logged',

  // --- Campaigns & Sourcing ---
  campaign_launched: 'campaign_launched',
  campaign_paused: 'campaign_paused',
  campaign_resumed: 'campaign_resumed',
  campaign_relaunched: 'campaign_relaunched',
  campaign_stats_snapshot: 'campaign_stats_snapshot',
  sequence_scheduled: 'sequence_scheduled',
  message_batch_scheduled: 'message_batch_scheduled',

  // --- Enrichment ---
  lead_enrich_requested: 'lead_enrich_requested',
  candidate_enrich_requested: 'candidate_enrich_requested',

  // --- Clients & Contacts ---
  client_created: 'client_created',
  client_updated: 'client_updated',
  client_enriched: 'client_enriched',
  contact_created: 'contact_created',

  // --- Billing & Credits ---
  credits_purchased: 'credits_purchased',
  subscription_checkout_started: 'subscription_checkout_started',
  subscription_cancelled: 'subscription_cancelled',
  invoice_created: 'invoice_created',
  invoice_paid: 'invoice_paid',

  // --- Teams / Collaboration ---
  team_invite_sent: 'team_invite_sent',
  team_role_updated: 'team_role_updated',

  // --- Notifications ---
  notification_created: 'notification_created',

  // --- Sniper / Prospecting ---
  sniper_target_added: 'sniper_target_added',
  sniper_capture_triggered: 'sniper_capture_triggered',

  // --- REX & Tools ---
  rex_chat_triggered: 'rex_chat_triggered',
  rex_linkedin_connect_sent: 'rex_linkedin_connect_sent'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

const CreateZapEventInput = z.object({
  event_type: z.string() as unknown as z.ZodType<EventType>,
  user_id: z.string().uuid(),
  entity: z.string().optional(),
  entity_id: z.string().optional(),
  payload: z.any().optional()
});

export async function createZapEvent(input: z.infer<typeof CreateZapEventInput>) {
  const parsed = CreateZapEventInput.parse(input);
  const eventPayload = parsed.payload ?? {};
  try {
    const { data, error } = await supabase
      .from('zap_events')
      .insert({
        event_type: parsed.event_type,
        user_id: parsed.user_id,
        // Our schema uses event_data + optional source_table/source_id
        event_data: {
          ...eventPayload,
          entity: parsed.entity || null,
          entity_id: parsed.entity_id || null
        },
        source_table: parsed.entity || null,
        source_id: parsed.entity_id || null
      })
      .select('id')
      .single();

    if (error) {
      logger.error({ at: 'createZapEvent', event_type: parsed.event_type, user_id: parsed.user_id, error: error.message });
      return { ok: false, error: error.message };
    }
    logger.info({ at: 'createZapEvent', event_type: parsed.event_type, user_id: parsed.user_id, zap_event_id: (data as any)?.id || null });
    return { ok: true, id: (data as any)?.id || null };
  } catch (e: any) {
    logger.error({ at: 'createZapEvent.catch', event_type: parsed.event_type, user_id: parsed.user_id, error: e?.message || String(e) });
    return { ok: false, error: e?.message || 'createZapEvent_failed' };
  }
}


