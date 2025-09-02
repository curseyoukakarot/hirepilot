import { supabase } from './supabase';
import { z } from 'zod';

// Action schemas for interactive notification elements
export const ButtonAction = z.object({
  id: z.string(),
  type: z.literal('button'),
  label: z.string(),
  style: z.enum(['primary', 'secondary', 'danger']).default('primary'),
  disabled: z.boolean().default(false)
});

export const SelectAction = z.object({
  id: z.string(),
  type: z.literal('select'),
  label: z.string(),
  options: z.array(z.string()),
  placeholder: z.string().optional()
});

export const ChipsAction = z.object({
  id: z.string(),
  type: z.literal('chips'),
  options: z.array(z.string()),
  multiple: z.boolean().default(false)
});

export const InputAction = z.object({
  id: z.string(),
  type: z.literal('input'),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  multiline: z.boolean().default(false)
});

export const Action = z.union([ButtonAction, SelectAction, ChipsAction, InputAction]);

// Main notification card schema
export const CardSchema = z.object({
  user_id: z.string(),
  source: z.enum(['inapp', 'slack']).default('inapp'),
  thread_key: z.string().optional(),
  title: z.string(),
  body_md: z.string().optional(),
  type: z.string().default('general'),
  actions: z.array(Action).default([]),
  metadata: z.record(z.any()).optional()
});

export type Card = z.infer<typeof CardSchema>;
export type ActionType = z.infer<typeof Action>;

// Interaction data schema
export const InteractionSchema = z.object({
  user_id: z.string(),
  source: z.enum(['inapp', 'slack']),
  thread_key: z.string().optional(),
  action_type: z.enum(['button', 'select', 'input', 'chips']),
  action_id: z.string(),
  data: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export type Interaction = z.infer<typeof InteractionSchema>;

/**
 * Push a notification card to the database
 */
export async function pushNotification(card: Card) {
  const validated = CardSchema.parse(card);
  
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: validated.user_id,
      source: validated.source,
      thread_key: validated.thread_key,
      title: validated.title,
      body_md: validated.body_md,
      type: validated.type,
      actions: validated.actions,
      metadata: validated.metadata,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * Record a user interaction with a notification
 */
export async function recordInteraction(interaction: Interaction) {
  const validated = InteractionSchema.parse(interaction);
  
  const { data, error } = await supabase
    .from('agent_interactions')
    .insert({
      user_id: validated.user_id,
      source: validated.source,
      thread_key: validated.thread_key,
      action_type: validated.action_type,
      action_id: validated.action_id,
      data: validated.data,
      metadata: validated.metadata,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId: string, options: {
  limit?: number;
  unreadOnly?: boolean;
  threadKey?: string;
  type?: string;
} = {}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  if (options.unreadOnly) {
    query = query.is('read_at', null);
  }
  
  if (options.threadKey) {
    query = query.eq('thread_key', options.threadKey);
  }
  
  if (options.type) {
    query = query.eq('type', options.type);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string, threadKey?: string) {
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
    
  if (threadKey) {
    query = query.eq('thread_key', threadKey);
  }
  
  const { data, error } = await query.select();
  if (error) throw error;
  return data;
}

/**
 * Get interaction history for a thread
 */
export async function getThreadInteractions(threadKey: string, options: {
  limit?: number;
  userId?: string;
} = {}) {
  let query = supabase
    .from('agent_interactions')
    .select('*')
    .eq('thread_key', threadKey)
    .order('created_at', { ascending: false });
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Helper to create sourcing-specific notifications
 */
export class SourcingNotifications {
  /**
   * Create a new reply notification
   */
  static async newReply(params: {
    userId: string;
    campaignId: string;
    leadId: string;
    replyId: string;
    classification: string;
    subject: string;
    fromEmail: string;
    body: string;
    source?: 'inapp' | 'slack';
  }) {
    const threadKey = `sourcing:${params.campaignId}:${params.leadId}`;
    
    // Create interactive actions based on classification
    const actions: ActionType[] = [
      {
        id: 'reply_draft',
        type: 'button',
        label: '🤖 Draft with REX',
        style: 'primary'
      },
      {
        id: 'book_meeting',
        type: 'button',
        label: '📅 Book Meeting',
        style: 'secondary'
      },
      {
        id: 'disqualify',
        type: 'button',
        label: '❌ Disqualify',
        style: 'secondary'
      },
      {
        id: 'free_text',
        type: 'input',
        placeholder: 'Type an instruction…'
      }
    ];
    
    // Add classification-specific actions
    if (params.classification === 'positive') {
      actions.push({
        id: 'book_demo',
        type: 'button',
        label: '📅 Book Demo',
        style: 'primary'
      });
    }
    
    actions.push({
      id: 'disqualify',
      type: 'button',
      label: '❌ Disqualify',
      style: 'danger'
    });
    
    return pushNotification({
      user_id: params.userId,
      source: params.source || 'inapp',
      thread_key: threadKey,
      title: `New reply from ${params.fromEmail}`,
      body_md: `_${params.classification}_ • Suggested next action: *${getNextActionFromClassification(params.classification)}*\n\n${(params.body || '').slice(0, 700)}`,
      type: 'sourcing_reply',
      actions,
      metadata: {
        campaign_id: params.campaignId,
        lead_id: params.leadId,
        reply_id: params.replyId,
        classification: params.classification,
        from_email: params.fromEmail,
        subject: params.subject
      }
    });
  }
  
  /**
   * Create a campaign status notification
   */
  static async campaignStatus(params: {
    userId: string;
    campaignId: string;
    campaignTitle: string;
    status: string;
    message: string;
    source?: 'inapp' | 'slack';
  }) {
    const threadKey = `sourcing:${params.campaignId}`;
    
    const actions: ActionType[] = [
      {
        id: 'view_campaign',
        type: 'button',
        label: '👀 View Campaign',
        style: 'primary'
      }
    ];
    
    if (params.status === 'running') {
      actions.push({
        id: 'pause_campaign',
        type: 'button',
        label: '⏸️ Pause',
        style: 'secondary'
      });
    } else if (params.status === 'paused') {
      actions.push({
        id: 'resume_campaign',
        type: 'button',
        label: '▶️ Resume',
        style: 'primary'
      });
    }
    
    return pushNotification({
      user_id: params.userId,
      source: params.source || 'inapp',
      thread_key: threadKey,
      title: `Campaign ${params.status}`,
      body_md: `**${params.campaignTitle}**\n\n${params.message}`,
      type: 'sourcing_campaign',
      actions,
      metadata: {
        campaign_id: params.campaignId,
        status: params.status
      }
    });
  }
  
  /**
   * Create a sequence generation notification
   */
  static async sequenceGenerated(params: {
    userId: string;
    campaignId: string;
    campaignTitle: string;
    titleGroups: string[];
    source?: 'inapp' | 'slack';
  }) {
    const threadKey = `sourcing:${params.campaignId}`;
    
    return pushNotification({
      user_id: params.userId,
      source: params.source || 'inapp',
      thread_key: threadKey,
      title: 'Email sequence generated',
      body_md: `**${params.campaignTitle}**\n\nGenerated 3-step sequence for: ${params.titleGroups.join(', ')}`,
      type: 'sourcing_sequence',
      actions: [
        {
          id: 'review_sequence',
          type: 'button',
          label: '📝 Review Sequence',
          style: 'primary'
        },
        {
          id: 'schedule_campaign',
          type: 'button',
          label: '🚀 Schedule Sends',
          style: 'primary'
        }
      ],
      metadata: {
        campaign_id: params.campaignId,
        title_groups: params.titleGroups
      }
    });
  }
}

/**
 * Helper to get suggested next action from classification
 */
function getNextActionFromClassification(classification: string): string {
  switch (classification) {
    case 'positive': return 'book meeting';
    case 'neutral': return 'reply';
    case 'negative': return 'disqualify';
    case 'oos': return 'disqualify';
    case 'auto': return 'hold';
    default: return 'reply';
  }
}

/**
 * Helper to process interaction results
 */
export async function processInteractionResult(interactionId: string, result: any) {
  const { data, error } = await supabase
    .from('agent_interactions')
    .update({
      result,
      processed_at: new Date().toISOString()
    })
    .eq('id', interactionId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}
