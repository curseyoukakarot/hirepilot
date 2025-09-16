/**
 * Slack notification helper
 * Sends notifications to Slack webhook when users are added as collaborators
 */

// Legacy exports for backward compatibility
export async function notifySlack(message: string) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: message,
        username: 'HirePilot',
        icon_emoji: ':robot_face:'
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.status, response.statusText);
    } else {
      console.log('Slack notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

// Legacy SlackMessages enum for backward compatibility
export enum SlackMessages {
  CAMPAIGN_LAUNCHED = 'Campaign launched successfully',
  CAMPAIGN_FAILED = 'Campaign failed to launch',
  LEADS_ENRICHED = 'Leads enriched successfully',
  ERROR_OCCURRED = 'An error occurred'
}

export async function sendSlackNotification(userId: string, message: string) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: message,
        username: 'HirePilot',
        icon_emoji: ':robot_face:'
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.status, response.statusText);
    } else {
      console.log('Slack notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

export async function sendSlackNotificationToUser(userEmail: string, message: string) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('SLACK_WEBHOOK_URL not configured, skipping Slack notification');
      return;
    }

    // Format message with user mention
    const formattedMessage = `@${userEmail} ${message}`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: formattedMessage,
        username: 'HirePilot',
        icon_emoji: ':robot_face:'
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification:', response.status, response.statusText);
    } else {
      console.log('Slack notification sent successfully to', userEmail);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}