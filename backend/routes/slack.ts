import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';
import axios from 'axios';

const router = Router();

// Debug environment variables
console.log('Slack OAuth Environment Variables:', {
  clientId: process.env.SLACK_CLIENT_ID,
  hasClientSecret: !!process.env.SLACK_CLIENT_SECRET,
  backendUrl: process.env.BACKEND_URL
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Slack client
const slack = new WebClient();

// Initiate Slack OAuth flow
router.get('/auth/slack/init', async (req, res) => {
  console.log('Slack init route hit:', {
    method: req.method,
    path: req.path,
    headers: {
      authorization: !!req.headers.authorization,
      contentType: req.headers['content-type'],
      accept: req.headers.accept
    }
  });

  try {
    // Get user ID from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header present');
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Got token, attempting to get user');

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error('Error getting user:', userError);
      return res.status(401).json({ error: 'Failed to get user' });
    }
    if (!user) {
      console.log('No user found');
      return res.status(401).json({ error: 'No user found' });
    }

    console.log('Got user:', user.id);

    // Include user ID in state parameter
    const state = JSON.stringify({
      userId: user.id,
      nonce: Math.random().toString(36).substring(7)
    });

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      console.error('Missing Slack client ID in environment');
      return res.status(500).json({ error: 'Missing Slack client ID' });
    }

    const redirectUri = `${process.env.BACKEND_URL}/api/auth/slack/callback`;
    const scope = 'incoming-webhook,chat:write';

    const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;
    
    console.log('Generated Slack OAuth URL:', url);
    
    // Ensure proper JSON response
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ url, success: true });
  } catch (error) {
    console.error('Error in Slack init route:', error);
    return res.status(500).json({ error: 'Failed to initiate Slack OAuth', success: false });
  }
});

// Handle Slack OAuth callback
router.get('/auth/slack/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      throw new Error('No code or state provided');
    }

    // Parse state to get user ID
    const { userId } = JSON.parse(decodeURIComponent(state as string));
    if (!userId) {
      throw new Error('No user ID in state');
    }

    // Exchange code for access token
    const result = await slack.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code: code as string,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/slack/callback`
    });

    if (!result.ok) {
      throw new Error('Failed to get access token');
    }

    // Store webhook URL in user settings
    const { error: updateError } = await supabase
      .from('user_settings')
      .update({
        slack_webhook_url: result.incoming_webhook?.url,
        slack_channel: result.incoming_webhook?.channel
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error('Failed to update user settings');
    }

    // Redirect back to frontend with success message
    res.redirect(`${process.env.FRONTEND_URL}/settings/notifications?slack=connected`);
  } catch (error) {
    console.error('Error handling Slack OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings/notifications?slack=error`);
  }
});

// Add test endpoint
router.post('/auth/slack/test', async (req, res) => {
  try {
    // Get user from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Failed to get user' });
    }

    // Get user's Slack webhook URL
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('slack_webhook_url, slack_channel')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !settings?.slack_webhook_url) {
      return res.status(400).json({ error: 'Slack webhook URL not found' });
    }

    // Send test message
    const response = await axios.post(settings.slack_webhook_url, {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 Test Notification",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Your Slack integration is working! You'll receive notifications here for important updates."
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Channel: ${settings.slack_channel || 'default'} • Sent: ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    });

    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Export the router
export default router; 