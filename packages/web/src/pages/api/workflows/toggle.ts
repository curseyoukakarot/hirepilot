export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  const { id, is_active } = req.body || {};
  if (!id || typeof is_active !== 'boolean') return res.status(400).json({ error: 'id and is_active required' });
  // TODO: update Supabase user_workflows.is_active
  return res.status(200).json({ success: true });
}


