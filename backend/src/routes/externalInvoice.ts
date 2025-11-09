import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = express.Router();

// POST /api/integrations/external/invoice
router.post('/integrations/external/invoice', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const providedKey = req.headers['x-api-key'] as string | undefined;
    const expectedKey = process.env.HIREPILOT_API_KEY;

    // Optional API key check
    if (expectedKey && providedKey !== expectedKey) {
      console.warn('[External Invoice] Invalid API key');
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    console.log('🧾 [External Invoice] Payload received:', body);

    // Simulate invoice creation/forwarding
    const invoice = {
      id: randomUUID(),
      received_at: new Date().toISOString(),
      ...body
    };

    console.log('✅ [External Invoice] Simulated invoice created:', invoice);

    res.json({
      ok: true,
      message: 'Invoice endpoint received data',
      invoice
    });
  } catch (err: any) {
    console.error('[External Invoice] Error handling request:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;


