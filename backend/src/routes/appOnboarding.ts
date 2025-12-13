import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { completeAppOnboardingStep, fetchAppOnboardingProgress } from '../lib/appOnboarding';

const router = express.Router();

// Progress fetch
router.get('/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const progress = await fetchAppOnboardingProgress(userId);
    res.json(progress);
  } catch (e: any) {
    console.error('app onboarding progress error', e);
    res.status(500).json({ error: e?.message || 'progress_error' });
  }
});

// Optional manual step completion hook (useful for testing)
router.post('/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { step_key, metadata } = req.body || {};
    if (!step_key) return res.status(400).json({ error: 'step_key required' });
    const result = await completeAppOnboardingStep(userId, step_key, metadata || {});
    res.json(result);
  } catch (e: any) {
    console.error('app onboarding complete error', e);
    res.status(500).json({ error: e?.message || 'complete_error' });
  }
});

export default router;
