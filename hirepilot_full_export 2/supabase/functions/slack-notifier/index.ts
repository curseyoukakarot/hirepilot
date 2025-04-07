// supabase/functions/slack-notifier/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  const slackEnabled = Deno.env.get('SLACK_NOTIFICATIONS_ENABLED') === 'true';

  if (!slackEnabled || !webhookUrl) {
    return new Response('Slack notifications disabled', { status: 200 });
  }

  try {
    const { event_type, event_data } = await req.json();
    const text = `📢 *${event_type}*\n\`\`\`${JSON.stringify(event_data, null, 2)}\`\`\``;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    return new Response('Slack notification sent', { status: 200 });
  } catch (error) {
    console.error('[Slack Notifier Error]', error);
    return new Response('Failed to send Slack notification', { status: 500 });
  }
});
