/**
 * Slack notification helper
 * Sends notifications to Slack webhook when users are added as collaborators
 */

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