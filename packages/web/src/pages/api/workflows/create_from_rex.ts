export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { trigger, actions, name, prompt } = req.body || {};
  // TODO: Use Supabase admin client to insert securely with created_by_rex = true
  const id = 'uwf_' + Math.random().toString(36).slice(2);
  return res.status(200).json({ success: true, id });
}


