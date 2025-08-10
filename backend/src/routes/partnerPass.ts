import { Router } from 'express';
import { runPartnerPass } from '../jobs/partnerPass';

const r = Router();

// Admin/cron endpoint to apply Partner Pass perks
r.post('/run', async (req, res) => {
  try {
    const result = await runPartnerPass();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to run partner pass' });
  }
});

export default r;


