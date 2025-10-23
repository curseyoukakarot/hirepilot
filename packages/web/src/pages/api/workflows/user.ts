export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Placeholder user workflows
  const items = [
    { id: 'uwf-1', name: 'My Hiring Slack Alerts', status: 'ok', is_active: true, last_tested_at: new Date().toISOString() },
    { id: 'uwf-2', name: 'Weekly Enrichment', status: 'pending', is_active: false, last_tested_at: null },
  ];
  res.status(200).json({ items });
}


