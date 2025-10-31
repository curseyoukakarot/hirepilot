type NotifyArgs = {
  accountId: string | null;
  userId: string;
  campaignId?: string | null;
  sessionId: string;
  stats: { leadsFound?: number; duplicates?: number; enriched?: number; errors?: number };
  recipients?: { slackChannel?: string; emails?: string[] };
};

async function postJson(url: string, body: any) {
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) } as any);
    return await resp.text().catch(()=> 'ok');
  } catch (e) {
    console.warn('[Notifier] post failed', e);
    return null;
  }
}

export async function notifySourcingComplete({ accountId, userId, campaignId, sessionId, stats, recipients }: NotifyArgs) {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL || '';
  const appBase = process.env.APP_WEB_URL || process.env.FRONTEND_URL || '';
  const campaignUrl = campaignId ? `${appBase}/leads?campaignId=${encodeURIComponent(campaignId)}` : `${appBase}/leads`;

  // Slack
  if (slackWebhook) {
    const blocks = [
      { type:'section', text:{ type:'mrkdwn', text: ':white_check_mark: *REX Sourcing finished*' } },
      { type:'section', fields:[
        { type:'mrkdwn', text:`*Campaign:* ${campaignId || '—'}` },
        { type:'mrkdwn', text:`*Session:* ${sessionId}` },
        { type:'mrkdwn', text:`*Leads Found:* ${stats?.leadsFound ?? 0}` },
        { type:'mrkdwn', text:`*Errors:* ${stats?.errors ?? 0}` },
      ]},
      { type:'actions', elements:[
        { type:'button', text:{ type:'plain_text', text:'Open Campaign' }, url: campaignUrl },
      ]}
    ];
    await postJson(slackWebhook, { blocks });
  }

  // Email stub (integrate with SendGrid later)
  try {
    const subject = `REX: Sourcing complete — ${campaignId || 'Campaign'} — ${stats?.leadsFound ?? 0} leads`;
    const html = `<div><h3>REX Sourcing complete</h3><p>Session: ${sessionId}</p><ul><li>Leads Found: ${stats?.leadsFound ?? 0}</li><li>Duplicates: ${stats?.duplicates ?? 0}</li><li>Enriched: ${stats?.enriched ?? 0}</li><li>Errors: ${stats?.errors ?? 0}</li></ul><p><a href="${campaignUrl}">View Campaign</a></p></div>`;
    // Placeholder: emit to log for now
    console.log('[Notifier:email]', { to: recipients?.emails || [], subject, html });
  } catch {}
}


