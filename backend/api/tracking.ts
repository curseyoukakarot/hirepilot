import express from 'express';
import { GmailTrackingService } from '../services/gmailTrackingService';
import { OutlookTrackingService } from '../services/outlookTrackingService';
import { queue } from '../workers/emailSyncScheduler';
import { supabase } from '../lib/supabaseClient';

const router = express.Router();

// Debug endpoint to check tracking configuration
router.get('/debug/:messageId?', async (req, res) => {
  try {
    const messageId = req.params.messageId || 'test_message_123';
    const baseUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';
    
    const debugInfo: any = {
      environment: {
        BACKEND_URL: process.env.BACKEND_URL,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        NODE_ENV: process.env.NODE_ENV
      },
      tracking: {
        pixelUrl: `${baseUrl}/api/tracking/pixel/${messageId}`,
        baseUrl,
        messageId
      },
      routes: {
        pixelEndpoint: `${baseUrl}/api/tracking/pixel/:messageId`,
        gmailWebhook: `${baseUrl}/api/tracking/gmail/webhook`,
        outlookWebhook: `${baseUrl}/api/tracking/outlook/webhook`
      },
      timestamp: new Date().toISOString(),
      database: null
    };

    // Test database connection for tracking
    if (messageId !== 'test_message_123') {
      try {
        const { data: message, error } = await supabase
          .from('email_events')
          .select('user_id, campaign_id, lead_id, event_type, provider, created_at')
          .eq('message_id', messageId)
          .order('created_at', { ascending: false });

        debugInfo.database = {
          messageFound: !error && message && message.length > 0,
          events: message || [],
          error: error?.message
        };
      } catch (dbError) {
        debugInfo.database = {
          error: dbError.message
        };
      }
    }

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve tracking pixel
router.get('/pixel/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    if (!messageId) {
      res.status(400).send('Missing messageId parameter');
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Handle tracking pixel for both Gmail and Outlook
    await Promise.all([
      GmailTrackingService.handleTrackingPixel(messageId, ip, userAgent),
      OutlookTrackingService.handleTrackingPixel(messageId, ip, userAgent)
    ]);

    // Return a 1x1 transparent pixel
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': '43',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (error) {
    console.error('Error handling tracking pixel:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle Gmail push notifications
router.post('/gmail/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.headers['x-goog-channel-token'] as string;

    if (!userId || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (queue) {
      await queue.add('process-gmail-notification', {
        userId,
        messageId: message.id
      });
    } else {
      console.warn('[tracking] Queue disabled – skipping Gmail notification job');
    }

    res.status(200).end();
  } catch (error) {
    console.error('Error handling Gmail webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle Outlook webhook notifications
router.post('/outlook/webhook', async (req, res) => {
  try {
    const { value } = req.body;
    const clientState = req.headers['clientstate'] as string;

    if (!clientState || !value) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Process each notification
    for (const notification of value) {
      if (queue) {
        await queue.add('process-outlook-notification', {
          userId: clientState,
          messageId: notification.resourceData.id
        });
      }
    }

    res.status(202).end();
  } catch (error) {
    console.error('Error handling Outlook webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 