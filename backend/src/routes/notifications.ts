import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pushNotification, CardSchema, recordInteraction, getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import fetch from 'node-fetch';

const router = express.Router();

interface ApiRequest extends Request {
  user?: { id: string };
}

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

export default router;
