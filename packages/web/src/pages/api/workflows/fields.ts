export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { endpoint, type } = req.query || {};
  // Simple heuristic mapping for demo: choose field sets per area
  const base = [
    'candidate.id', 'candidate.name', 'candidate.email', 'candidate.phone',
    'job.id', 'job.title', 'job.department', 'job.location',
    'client.id', 'client.name'
  ];
  const pipeline = ['pipeline.stage', 'pipeline.prev_stage', 'pipeline.changed_at'];
  const deals = ['deal.id', 'deal.amount', 'deal.status'];
  const messaging = ['message.id', 'message.subject', 'message.body'];
  let fields = base;
  if (String(endpoint || '').includes('pipeline_')) fields = [...base, ...pipeline];
  else if (String(endpoint || '').includes('client_')) fields = [...base, 'client.owner', 'client.domain'];
  else if (String(endpoint || '').includes('job_')) fields = [...base, 'job.seniority', 'job.type'];
  else if (String(endpoint || '').includes('message') || String(endpoint || '').includes('notifications')) fields = [...base, ...messaging];
  else if (String(endpoint || '').includes('submit') || String(endpoint || '').includes('deal')) fields = [...base, ...deals];
  return res.status(200).json({ fields });
}


