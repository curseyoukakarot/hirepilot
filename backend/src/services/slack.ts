import { WebClient, KnownBlock } from '@slack/web-api';
import { Card } from '../lib/notifications';

// Initialize Slack client
export const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Send a notification card to Slack as an interactive message
 */
export async function sendCardToSlack(channel: string, card: {
  title: string;
  body_md?: string;
  actions?: Array<any>;
  thread_key?: string;
  metadata?: Record<string, any>;
}) {
  try {
    // Build Slack blocks from card data
    const blocks: KnownBlock[] = [
      // Header block with title
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: card.title
        }
      }
    ];

    // Add body content if present
    if (card.body_md) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: card.body_md
        }
      } as KnownBlock);
    }

    // Add interactive actions if present
    if (card.actions && card.actions.length > 0) {
      const buttonElements = card.actions
        .filter(action => action.type === 'button')
        .map(action => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: action.label || action.id
          },
          value: JSON.stringify({
            action_id: action.id,
            thread_key: card.thread_key,
            metadata: card.metadata
          }),
          action_id: action.id,
          style: action.style === 'danger' ? 'danger' : 
                 action.style === 'primary' ? 'primary' : undefined
        }));

      if (buttonElements.length > 0) {
        blocks.push({
          type: 'actions',
          elements: buttonElements
        } as KnownBlock);
      }

      // Handle select actions
      const selectElements = card.actions
        .filter(action => action.type === 'select')
        .map(action => ({
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: action.label || 'Select an option'
          },
          options: (action.options || []).map(option => ({
            text: {
              type: 'plain_text',
              text: option
            },
            value: option
          })),
          action_id: action.id
        }));

      if (selectElements.length > 0) {
        blocks.push({
          type: 'actions',
          elements: selectElements
        } as KnownBlock);
      }
    }

    // Add context footer with thread info
    if (card.thread_key || card.metadata) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Thread: \`${card.thread_key || 'general'}\` • ${new Date().toLocaleTimeString()}`
          }
        ]
      });
    }

    // Send message to Slack
    const result = await slack.chat.postMessage({
      channel,
      text: card.title, // Fallback text for notifications
      blocks,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log(`📤 Sent Slack message to ${channel}:`, result.ts);
    return result;
  } catch (error) {
    console.error('❌ Failed to send Slack message:', error);
    throw error;
  }
}

/**
 * Send an ephemeral message (only visible to specific user)
 */
export async function sendEphemeralMessage(
  channel: string,
  user: string,
  text: string,
  blocks?: KnownBlock[]
) {
  try {
    const result = await slack.chat.postEphemeral({
      channel,
      user,
      text,
      blocks
    });

    console.log(`📤 Sent ephemeral message to ${user} in ${channel}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to send ephemeral message:', error);
    throw error;
  }
}

/**
 * Update an existing Slack message
 */
export async function updateSlackMessage(
  channel: string,
  ts: string,
  card: {
    title: string;
    body_md?: string;
    actions?: Array<any>;
  }
) {
  try {
    const blocks: KnownBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: card.title
        }
      }
    ];

    if (card.body_md) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: card.body_md
        }
      } as KnownBlock);
    }

    const result = await slack.chat.update({
      channel,
      ts,
      text: card.title,
      blocks
    });

    console.log(`📝 Updated Slack message ${ts} in ${channel}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to update Slack message:', error);
    throw error;
  }
}

/**
 * Send a sourcing campaign notification to Slack
 */
export async function sendSourcingNotificationToSlack(
  channel: string,
  notification: {
    campaignId: string;
    campaignTitle: string;
    type: 'reply' | 'campaign_status' | 'sequence_generated';
    data: any;
  }
) {
  let card: any;

  switch (notification.type) {
    case 'reply':
      card = {
        title: `🔔 New ${notification.data.classification} reply`,
        body_md: `*Campaign:* ${notification.campaignTitle}\n*From:* ${notification.data.fromEmail}\n*Subject:* ${notification.data.subject}\n\n${notification.data.body.substring(0, 200)}${notification.data.body.length > 200 ? '...' : ''}`,
        actions: [
          {
            id: 'draft_reply',
            type: 'button',
            label: '🤖 Draft with REX',
            style: 'primary'
          },
          {
            id: 'view_campaign',
            type: 'button',
            label: '👀 View Campaign'
          }
        ],
        thread_key: `sourcing:${notification.campaignId}:${notification.data.leadId}`,
        metadata: notification.data
      };
      break;

    case 'campaign_status':
      card = {
        title: `📊 Campaign ${notification.data.status}`,
        body_md: `*Campaign:* ${notification.campaignTitle}\n\n${notification.data.message}`,
        actions: [
          {
            id: 'view_campaign',
            type: 'button',
            label: '👀 View Campaign',
            style: 'primary'
          }
        ],
        thread_key: `sourcing:${notification.campaignId}`,
        metadata: notification.data
      };
      break;

    case 'sequence_generated':
      card = {
        title: `✨ Email sequence generated`,
        body_md: `*Campaign:* ${notification.campaignTitle}\n*Target titles:* ${notification.data.titleGroups.join(', ')}\n\nYour 3-step email sequence is ready for review.`,
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
            label: '🚀 Schedule Sends'
          }
        ],
        thread_key: `sourcing:${notification.campaignId}`,
        metadata: notification.data
      };
      break;

    default:
      throw new Error(`Unknown notification type: ${notification.type}`);
  }

  return sendCardToSlack(channel, card);
}

/**
 * Get Slack user info
 */
export async function getSlackUserInfo(userId: string) {
  try {
    const result = await slack.users.info({ user: userId });
    return result.user;
  } catch (error) {
    console.error('❌ Failed to get Slack user info:', error);
    return null;
  }
}

/**
 * Get Slack channel info
 */
export async function getSlackChannelInfo(channelId: string) {
  try {
    const result = await slack.conversations.info({ channel: channelId });
    return result.channel;
  } catch (error) {
    console.error('❌ Failed to get Slack channel info:', error);
    return null;
  }
}

/**
 * Verify Slack bot token and permissions
 */
export async function verifySlackConnection() {
  try {
    const authResult = await slack.auth.test();
    console.log('✅ Slack connection verified:', {
      team: authResult.team,
      user: authResult.user,
      bot_id: authResult.bot_id
    });
    return authResult;
  } catch (error) {
    console.error('❌ Slack connection failed:', error);
    throw error;
  }
}
