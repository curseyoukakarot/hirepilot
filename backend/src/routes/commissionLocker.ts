import { Router } from 'express';
import { lockMatureCommissions } from '../jobs/commissionLocker';

const r = Router();

r.post('/run', async (_req, res) => {
  try {
    const result = await lockMatureCommissions();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to lock commissions' });
  }
});

export default r;


