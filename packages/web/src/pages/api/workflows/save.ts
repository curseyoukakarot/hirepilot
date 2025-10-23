export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { name, graph_data, trigger, actions, workflow_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  // TODO: Insert into Supabase user_workflows for authenticated user
  const id = 'uwf_' + Math.random().toString(36).slice(2);
  res.status(200).json({ success: true, id });
}


