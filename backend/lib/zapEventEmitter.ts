// backend/lib/zapEventEmitter.ts
// Centralized event emitter for Zapier/Make.com events
// Integrates with both the new zap_events table and existing webhook system

import { supabaseDb } from './supabase';
import { emitWebhook } from './webhookEmitter';

// Define all supported event types
export const ZAP_EVENT_TYPES = {
  // Lead Events
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  LEAD_TAG_ADDED: 'lead_tag_added',
  LEAD_CONVERTED: 'lead_converted',
  LEAD_ENRICHED: 'lead_enriched',
  LEAD_SOURCED: 'lead_sourced',
  LEAD_RESPONDED: 'lead_responded',
  LEAD_STAGE_CHANGED: 'lead_stage_changed',

  // Candidate Events
  CANDIDATE_CREATED: 'candidate_created',
  CANDIDATE_UPDATED: 'candidate_updated',
  CANDIDATE_TAGGED: 'candidate_tagged',
  CANDIDATE_INTERVIEWED: 'candidate_interviewed',
  CANDIDATE_OFFERED: 'candidate_offered',
  CANDIDATE_HIRED: 'candidate_hired',
  CANDIDATE_REJECTED: 'candidate_rejected',

  // Pipeline Events
  PIPELINE_STAGE_UPDATED: 'pipeline_stage_updated',
  PIPELINE_CREATED: 'pipeline_created',
  CANDIDATE_MOVED_TO_STAGE: 'candidate_moved_to_stage',

  // Messaging Events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_REPLY: 'message_reply',
  EMAIL_BOUNCED: 'email_bounced',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',

  // Calendar Events
  CALENDAR_SCHEDULED: 'calendar_scheduled',

  // Campaign Events
  CAMPAIGN_CREATED: 'campaign_created',
  CAMPAIGN_LAUNCHED: 'campaign_launched',
  CAMPAIGN_COMPLETED: 'campaign_completed',
} as const;

export type ZapEventType = typeof ZAP_EVENT_TYPES[keyof typeof ZAP_EVENT_TYPES];

// Event data interface
export interface ZapEventData {
  userId: string;
  eventType: ZapEventType;
  eventData: Record<string, any>;
  sourceTable?: string;
  sourceId?: string;
}

// Dynamic pipeline stage event generator
export function generatePipelineStageEvent(stageName: string, action: 'moved_to' | 'moved_from'): string {
  const cleanStageName = stageName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `candidate_${action}_${cleanStageName}`;
}

/**
 * Emit a Zapier event to both the zap_events table and existing webhook system
 * This maintains backward compatibility while adding the new event system
 */
export async function emitZapEvent({
  userId,
  eventType,
  eventData,
  sourceTable,
  sourceId
}: ZapEventData): Promise<void> {
  try {
    // 1. Store event in zap_events table for polling triggers
    const { error: zapEventError } = await supabaseDb
      .from('zap_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
        source_table: sourceTable,
        source_id: sourceId,
        created_at: new Date().toISOString()
      });

    if (zapEventError) {
      console.error('[zapEventEmitter] Error storing zap event:', zapEventError);
    }

    // 2. Emit to existing webhook system for backward compatibility
    // Map new event types to existing webhook events where applicable
    const legacyEventType = mapToLegacyEvent(eventType);
    if (legacyEventType) {
      await emitWebhook(userId, legacyEventType, eventData);
    }

    console.log(`[zapEventEmitter] Emitted event: ${eventType} for user: ${userId}`);
  } catch (error) {
    console.error('[zapEventEmitter] Unexpected error:', error);
  }
}

/**
 * Map new event types to existing webhook event types for backward compatibility
 */
function mapToLegacyEvent(eventType: ZapEventType): string | null {
  const mappings: Record<string, string> = {
    [ZAP_EVENT_TYPES.LEAD_CREATED]: 'lead.created',
    [ZAP_EVENT_TYPES.LEAD_UPDATED]: 'lead.updated',
    [ZAP_EVENT_TYPES.LEAD_STAGE_CHANGED]: 'lead.stage_changed',
    [ZAP_EVENT_TYPES.PIPELINE_STAGE_UPDATED]: 'lead.stage_changed',
  };

  return mappings[eventType] || null;
}

/**
 * Emit multiple events in batch (useful for bulk operations)
 */
export async function emitZapEvents(events: ZapEventData[]): Promise<void> {
  const promises = events.map(event => emitZapEvent(event));
  await Promise.all(promises);
}

/**
 * Create a standardized event payload for a lead
 */
export function createLeadEventData(lead: any, additionalData: Record<string, any> = {}): Record<string, any> {
  return {
    id: lead.id,
    email: lead.email,
    first_name: lead.first_name,
    last_name: lead.last_name,
    full_name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    company: lead.company,
    title: lead.title,
    status: lead.status,
    campaign_id: lead.campaign_id,
    linkedin_url: lead.linkedin_url,
    enriched_at: lead.enriched_at,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    ...additionalData
  };
}

/**
 * Create a standardized event payload for a candidate
 */
export function createCandidateEventData(candidate: any, additionalData: Record<string, any> = {}): Record<string, any> {
  return {
    id: candidate.id,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    full_name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
    email: candidate.email,
    phone: candidate.phone,
    status: candidate.status,
    lead_id: candidate.lead_id,
    avatar_url: candidate.avatar_url,
    notes: candidate.notes,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
    ...additionalData
  };
}

/**
 * Create a standardized event payload for a campaign
 */
export function createCampaignEventData(campaign: any, additionalData: Record<string, any> = {}): Record<string, any> {
  return {
    id: campaign.id,
    title: campaign.title,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    job_id: campaign.job_id,
    lead_source_type: campaign.lead_source_type,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
    ...additionalData
  };
}

/**
 * Create a standardized event payload for a message
 */
export function createMessageEventData(message: any, additionalData: Record<string, any> = {}): Record<string, any> {
  return {
    id: message.id,
    lead_id: message.lead_id,
    campaign_id: message.campaign_id,
    provider: message.provider,
    subject: message.subject,
    content: message.content,
    status: message.status,
    created_at: message.created_at,
    ...additionalData
  };
} 