import express, { Request, Response } from 'express';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { slack, sendEphemeralMessage } from '../services/slack';
import { recordInteraction } from '../lib/notifications';

const router = express.Router();

/**
 * Verify Slack signature for security
 */
function verifySlackSignature(headers: any, rawBody: string): boolean {
  try {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];
    
    if (!timestamp || !signature) {
      console.warn('Missing Slack signature headers');
      return false;
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      console.warn('Slack request timestamp too old');
      return false;
    }

    // Verify signature
    const baseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!);
    hmac.update(baseString);
    const expectedSignature = `v0=${hmac.digest('hex')}`;
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error('Error verifying Slack signature:', error);
    return false;
  }
}

/**
 * Middleware to capture raw body for Slack signature verification
 */
function captureRawBody(req: any, res: Response, next: any) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
}

// Slack slash command: /sourcing <instruction>
router.post('/slack/commands', captureRawBody, async (req: any, res: Response) => {
  try {
    const rawBody = req.rawBody || '';
    
    // Verify Slack signature
    if (!verifySlackSignature(req.headers, rawBody)) {
      console.warn('Invalid Slack signature for command');
      return res.status(401).send('Unauthorized');
    }

    // Parse form data from Slack
    const params = new URLSearchParams(rawBody);
    const text = params.get('text') || '';
    const userId = params.get('user_id')!;
    const channelId = params.get('channel_id')!;
    const userName = params.get('user_name') || 'Unknown';
    const command = params.get('command') || '/sourcing';

    console.log(`📱 Slack command received: ${command} "${text}" from ${userName} (${userId}) in ${channelId}`);

    // Send immediate acknowledgment to user
    await sendEphemeralMessage(
      channelId,
      userId,
      `Got it! Starting Sourcing wizard for: "${text}". I'll follow up here with next steps.`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🤖 *Sourcing Agent Activated*\n\nProcessing your request: "${text}"\n\nI'll guide you through creating a sourcing campaign step by step.`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Initiated by ${userName} • ${new Date().toLocaleTimeString()}`
            }
          ]
        }
      ]
    );

    // Record the interaction and forward to REX orchestrator
    await recordInteraction({
      user_id: userId,
      source: 'slack',
      thread_key: `slack:${channelId}`,
      action_type: 'input',
      action_id: 'slash_sourcing',
      data: {
        text,
        command,
        user_name: userName,
        channel_id: channelId,
        timestamp: new Date().toISOString()
      },
      metadata: {
        slack_user: userId,
        slack_channel: channelId,
        command_text: text
      }
    });

    console.log(`✅ Recorded Slack command interaction for user ${userId}`);

    // Slack requires a 200 response within 3 seconds
    return res.status(200).send('');
  } catch (error) {
    console.error('❌ Error handling Slack command:', error);
    return res.status(500).send('Internal server error');
  }
});

// Slack interactivity (button clicks, select menus, etc.)
router.post('/slack/interactivity', captureRawBody, async (req: any, res: Response) => {
  try {
    const rawBody = req.rawBody || '';
    
    // Verify Slack signature
    if (!verifySlackSignature(req.headers, rawBody)) {
      console.warn('Invalid Slack signature for interactivity');
      return res.status(401).send('Unauthorized');
    }

    // Parse the payload from Slack
    const params = new URLSearchParams(rawBody);
    const payloadString = params.get('payload');
    
    if (!payloadString) {
      console.warn('No payload in Slack interactivity request');
      return res.status(400).send('Missing payload');
    }

    const payload = JSON.parse(payloadString);
    const userId = payload.user?.id;
    const channelId = payload.channel?.id;
    const action = payload.actions?.[0];
    const actionId = action?.action_id || action?.value;

    console.log(`🔘 Slack interaction: ${actionId} from ${userId} in ${channelId}`);

    // Extract action data
    let actionData: any = {};
    try {
      if (action?.value) {
        actionData = JSON.parse(action.value);
      }
    } catch {
      actionData = { raw_value: action?.value };
    }

    // Determine action type
    let actionType = 'button';
    if (action?.type === 'static_select') {
      actionType = 'select';
      actionData.selected_option = action.selected_option?.value;
    }

    // Record the interaction
    await recordInteraction({
      user_id: userId,
      source: 'slack',
      thread_key: actionData.thread_key || `slack:${channelId}`,
      action_type: actionType as any,
      action_id: actionId,
      data: {
        ...actionData,
        slack_payload: payload,
        timestamp: new Date().toISOString()
      },
      metadata: {
        slack_user: userId,
        slack_channel: channelId,
        message_ts: payload.message?.ts,
        response_url: payload.response_url
      }
    });

    console.log(`✅ Recorded Slack interaction ${actionId} for user ${userId}`);

    // Send acknowledgment (can be used to update the original message)
    const acknowledgment = {
      text: `Processing your ${actionId} action...`,
      replace_original: false,
      response_type: 'ephemeral'
    };

    // Slack requires fast response
    return res.status(200).json(acknowledgment);
  } catch (error) {
    console.error('❌ Error handling Slack interactivity:', error);
    return res.status(500).send('Internal server error');
  }
});

// Slack Events API (for mentions, app_home_opened, etc.)
router.post('/slack/events', express.json(), async (req: Request, res: Response) => {
  try {
    const { type, challenge, event } = req.body;

    // Handle URL verification challenge
    if (type === 'url_verification') {
      console.log('📋 Slack URL verification challenge received');
      return res.status(200).send(challenge);
    }

    // Handle events
    if (type === 'event_callback' && event) {
      console.log(`📨 Slack event received: ${event.type}`);
      
      // Handle app mentions
      if (event.type === 'app_mention') {
        const userId = event.user;
        const channelId = event.channel;
        const text = event.text;
        
        // Record the mention as an interaction
        await recordInteraction({
          user_id: userId,
          source: 'slack',
          thread_key: `slack:${channelId}`,
          action_type: 'input',
          action_id: 'app_mention',
          data: {
            text,
            event_ts: event.ts,
            timestamp: new Date().toISOString()
          },
          metadata: {
            slack_user: userId,
            slack_channel: channelId,
            event_type: 'app_mention'
          }
        });

        // Send response
        await sendEphemeralMessage(
          channelId,
          userId,
          `👋 Hi there! Use \`/sourcing <your request>\` to start a sourcing campaign, or check your notifications in the HirePilot dashboard.`
        );
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error handling Slack event:', error);
    return res.status(500).send('Internal server error');
  }
});

// Health check for Slack integration
router.get('/slack/health', async (req: Request, res: Response) => {
  try {
    // Test Slack connection
    const authResult = await slack.auth.test();
    
    return res.json({
      status: 'healthy',
      slack_connected: true,
      team: authResult.team,
      bot_user: authResult.user,
      bot_id: authResult.bot_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Slack health check failed:', error);
    return res.status(500).json({
      status: 'unhealthy',
      slack_connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for sending Slack messages (development only)
router.post('/slack/test', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint not available in production' });
    }

    const { channel, message } = req.body;
    
    if (!channel || !message) {
      return res.status(400).json({ error: 'Channel and message are required' });
    }

    const result = await slack.chat.postMessage({
      channel,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🧪 *Test Message*\n\n${message}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Test Button'
              },
              action_id: 'test_button',
              value: JSON.stringify({ test: true })
            }
          ]
        }
      ]
    });

    try { const uid = (req as any)?.user?.id; if (uid) { await createZapEvent({ event_type: EVENT_TYPES.notification_created, user_id: uid, entity: 'notification', entity_id: undefined, payload: { kind: 'slack_test' } }); } } catch {}
    return res.json({
      success: true,
      message_ts: result.ts,
      channel: result.channel
    });
  } catch (error) {
    console.error('❌ Error sending test Slack message:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
