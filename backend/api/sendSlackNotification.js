// frontend/api/sendSlackNotification.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const {
    event_type,
    user_email,
    campaign_name,
    error_message,
    candidate_name
  } = req.body;

  const slackWebhookUrl = 'https://hooks.slack.com/services/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';

  if (!slackWebhookUrl) {
    return res.status(500).json({ message: 'Slack webhook URL is not configured.' });
  }

  let message = {};

  switch (event_type) {
    case 'user_signed_up':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "👤 New User Signup!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Email:*\n${user_email}` },
              { type: "mrkdwn", text: `*Time:*\n${new Date().toLocaleString()}` }
            ]
          }
        ]
      };
      break;

    case 'campaign_created':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🛠️ Campaign Created!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Campaign:*\n${campaign_name}` },
              { type: "mrkdwn", text: `*Created By:*\n${user_email}` }
            ]
          }
        ]
      };
      break;

    case 'campaign_sent':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🚀 Campaign Launched!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Campaign:*\n${campaign_name}` },
              { type: "mrkdwn", text: `*Launched By:*\n${user_email}` }
            ]
          }
        ]
      };
      break;

    case 'campaign_failed':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "❌ Campaign Error!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Campaign:*\n${campaign_name}` },
              { type: "mrkdwn", text: `*Error:*\n${error_message}` }
            ]
          }
        ]
      };
      break;

    case 'first_reply_received':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "📩 First Reply Received!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Candidate:*\n${candidate_name}` },
              { type: "mrkdwn", text: `*Campaign:*\n${campaign_name}` }
            ]
          }
        ]
      };
      break;

    case 'onboarding_complete':
      message = {
        blocks: [
          { type: "header", text: { type: "plain_text", text: "🎉 Onboarding Complete!", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*User:*\n${user_email}` },
              { type: "mrkdwn", text: `*Finished At:*\n${new Date().toLocaleString()}` }
            ]
          }
        ]
      };
      break;

    default:
      message = { text: `⚠️ Unknown event type: ${event_type}` };
  }

  try {
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      return res.status(500).json({ message: 'Slack error', error: errorText });
    }

    return res.status(200).json({ message: 'Slack notification sent successfully!' });
  } catch (error) {
    console.error('Slack notification failed:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
