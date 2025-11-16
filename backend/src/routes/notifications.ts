import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pushNotification, CardSchema, recordInteraction, getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';
import fetch from 'node-fetch';

const router = express.Router();

function getUserId(req: ApiRequest): string | null {
  // Get user ID from authenticated user or fallback to header for testing
  return req.user?.id || req.headers['x-user-id'] as string || null;
}

// Get notifications for authenticated user
router.get('/notifications', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit, unread_only, thread_key, type } = req.query;
    
    const options = {
      limit: limit ? parseInt(limit as string) : 50,
      unreadOnly: unread_only === 'true',
      threadKey: thread_key as string,
      type: type as string
    };

    const notifications = await getUserNotifications(userId, options);
    return res.json({ notifications });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Create a new notification (used by agents, reply handler, analytics digest)
router.post('/notifications', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const body = CardSchema.parse(req.body);
    const notification = await pushNotification(body);
    
    // TODO: Optionally mirror to Slack here (see slack integration)
    // await mirrorToSlack(notification);
    
    return res.status(201).json(notification);
  } catch (error: any) {
    console.error('Error creating notification:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid notification data', details: error.errors });
    }
    return res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify notification belongs to user before marking as read
    const { data: notification } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!notification || notification.user_id !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await markNotificationRead(id);
    return res.json(updatedNotification);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read for user
router.patch('/notifications/read-all', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { thread_key } = req.body;
    const updatedNotifications = await markAllNotificationsRead(userId, thread_key);
    
    return res.json({ 
      updated: updatedNotifications.length,
      notifications: updatedNotifications 
    });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Get notification statistics for user
router.get('/notifications/stats', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: stats, error } = await supabase
      .from('notifications')
      .select('type, read_at')
      .eq('user_id', userId);

    if (error) throw error;

    const totalCount = stats.length;
    const unreadCount = stats.filter(n => !n.read_at).length;
    const typeBreakdown = stats.reduce((acc: Record<string, number>, notification) => {
      const type = notification.type || 'general';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      total: totalCount,
      unread: unreadCount,
      read: totalCount - unreadCount,
      by_type: typeBreakdown
    });
  } catch (error: any) {
    console.error('Error fetching notification stats:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Record user interaction with notifications (from in-app and Slack)
router.post('/agent-interactions', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      user_id: z.string(),
      source: z.enum(['inapp', 'slack']),
      thread_key: z.string().optional(),
      action_type: z.enum(['button', 'select', 'input', 'chips']),
      action_id: z.string(),
      data: z.record(z.any()).optional(),
      metadata: z.record(z.any()).optional()
    }).parse(req.body);

    // Record the interaction
    const interaction = await recordInteraction(body);

    // Optional: Forward to REX orchestrator for follow-up wizard steps
    if (process.env.REX_WEBHOOK_URL) {
      try {
        const webhookPayload = {
          ...body,
          interaction_id: interaction.id,
          timestamp: new Date().toISOString()
        };

        await fetch(process.env.REX_WEBHOOK_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AGENTS_API_TOKEN || ''}`,
            'User-Agent': 'HirePilot-Backend/1.0'
          },
          body: JSON.stringify(webhookPayload),
          timeout: 5000 // 5 second timeout
        });

        console.log(`Forwarded interaction ${interaction.id} to REX webhook`);
      } catch (webhookError) {
        // Log but don't fail the request if webhook fails
        console.warn('Failed to forward interaction to REX webhook:', webhookError);
      }
    }

    return res.json({ 
      ok: true, 
      interaction_id: interaction.id,
      forwarded_to_rex: !!process.env.REX_WEBHOOK_URL
    });
  } catch (error: any) {
    console.error('Error recording agent interaction:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid interaction data', details: error.errors });
    }
    return res.status(500).json({ error: error.message });
  }
});

// Get interaction history for a thread (useful for debugging and analytics)
router.get('/agent-interactions', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { thread_key, limit, action_type } = req.query;
    
    let query = supabase
      .from('agent_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (thread_key) {
      query = query.eq('thread_key', thread_key);
    }

    if (action_type) {
      query = query.eq('action_type', action_type);
    }

    if (limit) {
      query = query.limit(parseInt(limit as string));
    } else {
      query = query.limit(100); // Default limit
    }

    const { data: interactions, error } = await query;
    if (error) throw error;

    return res.json({ interactions });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Health check endpoint for notifications system
router.get('/notifications/health', async (req: Request, res: Response) => {
  try {
    // Test database connectivity
    const { data, error } = await supabase
      .from('notifications')
      .select('count')
      .limit(1);

    if (error) throw error;

    // Test REX webhook connectivity (if configured)
    let rexStatus = 'not_configured';
    if (process.env.REX_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.REX_WEBHOOK_URL, {
          method: 'HEAD',
          timeout: 3000
        });
        rexStatus = response.ok ? 'healthy' : 'unhealthy';
      } catch {
        rexStatus = 'unreachable';
      }
    }

    return res.json({
      status: 'healthy',
      database: 'connected',
      rex_webhook: rexStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Notifications health check failed:', error);
    return res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Agent Mode read/write (stored in user_settings.agent_mode_enabled)
router.get('/agent-mode', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
      .from('user_settings')
      .select('agent_mode_enabled')
      .eq('user_id', userId)
      .single();
    if (error && (error as any).code !== 'PGRST116') throw error;
    return res.json({ agent_mode_enabled: data?.agent_mode_enabled ?? false });
  } catch (e: any) {
    console.error('Error reading agent mode:', e);
    return res.status(500).json({ error: e.message });
  }
});

router.post('/agent-mode', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const body = z.object({ enabled: z.boolean() }).parse(req.body);

    const { data: existing } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('user_settings')
        .update({ agent_mode_enabled: body.enabled })
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_settings')
        .insert({ user_id: userId, agent_mode_enabled: body.enabled });
      if (error) throw error;
    }

    return res.json({ ok: true, agent_mode_enabled: body.enabled });
  } catch (e: any) {
    console.error('Error toggling agent mode:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Team Agent Mode read/write. team_admin_id identifies the owning admin for the team
router.get('/agent-mode/team', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const teamAdminId = (req.query.team_id as string) || userId;
    const { data } = await supabase
      .from('team_settings')
      .select('agent_mode_enabled')
      .eq('team_admin_id', teamAdminId)
      .single();
    return res.json({ agent_mode_enabled: data?.agent_mode_enabled ?? false });
  } catch (e: any) {
    console.error('Error reading team agent mode:', e);
    return res.status(500).json({ error: e.message });
  }
});

router.post('/agent-mode/team', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const body = z.object({ team_id: z.string().optional(), enabled: z.boolean() }).parse(req.body);
    const teamAdminId = body.team_id || userId;

    // Upsert
    const { data: existing } = await supabase
      .from('team_settings')
      .select('team_admin_id')
      .eq('team_admin_id', teamAdminId)
      .single();
    if (existing) {
      const { error } = await supabase
        .from('team_settings')
        .update({ agent_mode_enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq('team_admin_id', teamAdminId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('team_settings')
        .insert({ team_admin_id: teamAdminId, agent_mode_enabled: body.enabled });
      if (error) throw error;
    }
    return res.json({ ok: true, agent_mode_enabled: body.enabled });
  } catch (e: any) {
    console.error('Error toggling team agent mode:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Admin-only: backfill Action Inbox notifications from existing email replies
router.post('/notifications/backfill/email-replies', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const requesterId = getUserId(req);
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });

    // Optional filter controls
    const { user_id, since, limit } = req.body as {
      user_id?: string;
      since?: string; // Ignored if email_replies has no created_at
      limit?: number;
    };

    // Verify requester is privileged: allow token role or DB flag
    const role = (req as any).user?.role;
    const { data: requester } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', requesterId)
      .maybeSingle();
    const isPrivileged = role === 'super_admin' || role === 'admin' || requester?.is_admin;
    if (!isPrivileged) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch replies missing notifications
    let query = supabase
      .from('email_replies')
      .select('id, user_id, campaign_id, lead_id, message_id, from_email, subject, text_body, html_body')
      .order('id', { ascending: false });

    if (user_id) query = query.eq('user_id', user_id);
    // Note: email_replies may not have created_at; ignoring 'since' filter for portability
    if (limit) query = query.limit(limit);
    else query = query.limit(500);

    const { data: replies, error } = await query;
    if (error) throw error;

    let created = 0;

    for (const r of replies || []) {
      let campaignId = (r as any).campaign_id as string | null;
      let leadId = (r as any).lead_id as string | null;
      const replyId = (r as any).id as string;
      const userId = (r as any).user_id as string;
      const fromEmail = String((r as any).from_email || '').toLowerCase();

      // Resolve any missing attribution
      if (!campaignId || !leadId) {
        try {
          // 1) messages by tracking message_id
          if ((r as any).message_id) {
            const { data: m1 } = await supabase
              .from('messages')
              .select('lead_id,campaign_id')
              .eq('message_id', (r as any).message_id)
              .maybeSingle();
            if (m1) {
              leadId = leadId || (m1 as any).lead_id || null;
              campaignId = campaignId || (m1 as any).campaign_id || null;
            }
            if (!leadId || !campaignId) {
              const { data: m2 } = await supabase
                .from('messages')
                .select('lead_id,campaign_id')
                .eq('id', (r as any).message_id)
                .maybeSingle();
              if (m2) {
                leadId = leadId || (m2 as any).lead_id || null;
                campaignId = campaignId || (m2 as any).campaign_id || null;
              }
            }
            if (!leadId || !campaignId) {
              const { data: ev } = await supabase
                .from('email_events')
                .select('lead_id,campaign_id')
                .eq('message_id', (r as any).message_id)
                .maybeSingle();
              if (ev) {
                leadId = leadId || (ev as any).lead_id || null;
                campaignId = campaignId || (ev as any).campaign_id || null;
              }
            }
          }
          // 2) Email-based fallback for the same user
          if (!leadId && fromEmail && userId) {
            const { data: baseLead } = await supabase
              .from('leads')
              .select('id,campaign_id')
              .eq('user_id', userId)
              .ilike('email', fromEmail)
              .maybeSingle();
            if (baseLead?.id) {
              leadId = baseLead.id;
              campaignId = campaignId || (baseLead as any).campaign_id || campaignId;
            } else {
              const { data: srcLead } = await supabase
                .from('sourcing_leads')
                .select('id,name,title,company,campaign_id,email,linkedin_url')
                .ilike('email', fromEmail)
                .maybeSingle();
              if (srcLead) {
                // Mirror minimal base lead
                const { data: existing } = await supabase
                  .from('leads')
                  .select('id')
                  .eq('user_id', userId)
                  .ilike('email', fromEmail)
                  .maybeSingle();
                if (existing?.id) {
                  leadId = existing.id;
                } else {
                  const insert = {
                    user_id: userId,
                    name: (srcLead as any).name || fromEmail,
                    email: fromEmail,
                    title: (srcLead as any).title || null,
                    company: (srcLead as any).company || null,
                    linkedin_url: (srcLead as any).linkedin_url || null,
                    source: 'sourcing_campaign',
                    created_at: new Date().toISOString()
                  } as any;
                  const { data: created } = await supabase
                    .from('leads')
                    .insert(insert)
                    .select('id')
                    .single();
                  if (created?.id) leadId = created.id;
                }
                campaignId = campaignId || (srcLead as any).campaign_id || campaignId;
              }
            }
          }
          // 3) Update the reply row if anything was resolved
          if ((leadId && leadId !== (r as any).lead_id) || (campaignId && campaignId !== (r as any).campaign_id)) {
            await supabase
              .from('email_replies')
              .update({ lead_id: leadId, campaign_id: campaignId })
              .eq('id', replyId);
          }
        } catch (e) {
          console.warn('[backfill] attribution resolution failed for reply', replyId, (e as any)?.message || e);
        }
      }

      const threadKey = campaignId && leadId ? `sourcing:${campaignId}:${leadId}` : undefined;

      // Skip if a notification already exists for this reply (by metadata.reply_id)
      if (threadKey) {
        const { data: existing, error: existErr } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'sourcing_reply')
          .eq('thread_key', threadKey)
          .contains('metadata', { reply_id: r.id })
          .limit(1);
        if (!existErr && existing && existing.length > 0) continue;
      }

      const actions: any[] = [
        { id: 'reply_draft', type: 'button', label: '🤖 Draft with REX', style: 'primary' },
        { id: 'book_meeting', type: 'button', label: '📅 Book Meeting', style: 'secondary' },
        { id: 'disqualify', type: 'button', label: '❌ Disqualify', style: 'danger' },
        { id: 'free_text', type: 'input', placeholder: 'Type an instruction…' }
      ];

      // Try insert with metadata; if schema doesn't have column, retry without
      let insertErr: any | null = null;
      try {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            source: 'inapp',
            thread_key: threadKey,
            title: `New reply from ${fromEmail || 'candidate'}`,
            body_md: `${((r as any).text_body || (r as any).html_body || '').slice(0, 700)}`,
            type: 'sourcing_reply',
            actions,
            metadata: {
              campaign_id: campaignId,
              lead_id: leadId,
              reply_id: replyId,
              from_email: fromEmail,
              subject: (r as any).subject
            }
          });
        insertErr = error;
      } catch (e: any) {
        insertErr = e;
      }

      if (insertErr) {
        const msg = `${insertErr?.message || ''}`.toLowerCase();
        if (msg.includes('metadata')) {
          const { error: retryErr } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              source: 'inapp',
              thread_key: threadKey,
              title: `New reply from ${fromEmail || 'candidate'}`,
              body_md: `${((r as any).text_body || (r as any).html_body || '').slice(0, 700)}`,
              type: 'sourcing_reply',
              actions
            });
          if (!retryErr) created += 1;
        }
      } else {
        created += 1;
      }
    }

    return res.json({ ok: true, scanned: replies?.length || 0, created });
  } catch (e: any) {
    console.error('Backfill error:', e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
