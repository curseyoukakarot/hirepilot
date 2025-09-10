export type NotifyType = 'collaborator_added' | 'comment_added' | 'stage_moved' | 'file_uploaded';

export const slackBlocks = (p: {
  type: NotifyType;
  job: { id: string; title: string };
  actor: { id: string; name: string };
  payload?: Record<string, unknown>;
}) => {
  const title = p.job.title ?? 'Job';
  const who = p.actor.name ?? 'Someone';
  const summary: Record<NotifyType, string> = {
    collaborator_added: `${who} added a collaborator to *${title}*`,
    comment_added: `${who} commented on *${title}*`,
    stage_moved: `${who} moved a candidate stage in *${title}*`,
    file_uploaded: `${who} uploaded a file to *${title}*`,
  };
  return [
    { type: 'section', text: { type: 'mrkdwn', text: summary[p.type] } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Job ID: ${p.job.id}` }] },
    ...(p.payload
      ? [{ type: 'section', text: { type: 'mrkdwn', text: '```' + JSON.stringify(p.payload, null, 2) + '```' } }]
      : []),
  ];
};

export const sendgridMessage = (p: {
  type: NotifyType;
  job: { id: string; title: string };
  actor: { id: string; name: string };
  recipient: { email: string; name?: string };
  payload?: Record<string, unknown>;
}) => {
  const subjMap: Record<NotifyType, string> = {
    collaborator_added: `New collaborator · ${p.job.title}`,
    comment_added: `New comment · ${p.job.title}`,
    stage_moved: `Stage moved · ${p.job.title}`,
    file_uploaded: `File uploaded · ${p.job.title}`,
  };
  const text = `${p.actor.name ?? 'Someone'} triggered ${p.type} on ${p.job.title}.\n\n` +
    (p.payload ? JSON.stringify(p.payload, null, 2) : '');
  return {
    personalizations: [{ to: [{ email: p.recipient.email, name: p.recipient.name }] }],
    from: { email: 'notifications@thehirepilot.com', name: 'HirePilot' },
    subject: subjMap[p.type],
    content: [{ type: 'text/plain', value: text }],
  };
};
