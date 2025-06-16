import express from 'express';
import { GmailTrackingService } from '../services/gmailTrackingService';
import { OutlookTrackingService } from '../services/outlookTrackingService';
import { queue } from '../workers/emailSyncScheduler';

const router = express.Router();

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

    // Add job to process notification
    await queue.add('process-gmail-notification', {
      userId,
      messageId: message.id
    });

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
      await queue.add('process-outlook-notification', {
        userId: clientState,
        messageId: notification.resourceData.id
      });
    }

    res.status(202).end();
  } catch (error) {
    console.error('Error handling Outlook webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 