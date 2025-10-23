export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { endpoint, method, headers, body } = req.body || {};
  try {
    // Placeholder that just validates shape
    if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}


