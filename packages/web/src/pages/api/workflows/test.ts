export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { trigger_endpoint, action_endpoint } = req.body || {};
  try {
    // Mock outward requests
    const ok1 = !!trigger_endpoint;
    const ok2 = !!action_endpoint;
    if (ok1 && ok2) {
      // TODO: update user_workflows.status = 'ok', last_tested_at = now()
      return res.status(200).json({ status: 'ok' });
    }
    return res.status(400).json({ status: 'error', message: 'Missing endpoints' });
  } catch (e) {
    return res.status(500).json({ status: 'error' });
  }
}


