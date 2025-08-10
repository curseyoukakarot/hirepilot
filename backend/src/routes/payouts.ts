import { Router } from 'express';
import { processPayouts } from '../jobs/payouts';

const r = Router();

// Admin or CRON-triggered
r.post('/run', async (req, res) => {
  // compute last period
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const until = new Date();
  await processPayouts({ since, until });
  res.json({ ok: true });
});
export default r;


