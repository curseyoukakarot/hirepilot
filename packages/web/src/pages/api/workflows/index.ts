export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Placeholder library list
  const items = [
    { id: 'wf-lib-1', title: 'Lead Reply → Slack Alert', description: 'Notify Slack on replies', trigger: '/api/events/message_reply', actions: [{ endpoint: '/api/actions/slack_notification' }] },
    { id: 'wf-lib-2', title: 'Candidate Hired → Stripe Invoice', description: 'Bill on hire', trigger: '/api/events/candidate_hired', actions: [{ endpoint: '/api/actions/stripe_invoice' }] },
  ];
  res.status(200).json({ items });
}


