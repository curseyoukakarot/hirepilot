const memory: any[] = [];

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const { name, mode, config } = req.body || {};
    const item = { id: 'tmpl_' + Math.random().toString(36).slice(2), name, mode, config, created_at: new Date().toISOString() };
    memory.push(item);
    return res.status(200).json({ success: true, id: item.id });
  }
  if (req.method === 'GET') {
    return res.status(200).json({ items: memory });
  }
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    const idx = memory.findIndex(x => x.id === id);
    if (idx >= 0) memory.splice(idx, 1);
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}


