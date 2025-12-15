import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { fetchOnboardingProgress, STEP_CREDITS, StepKey, completeOnboardingStep } from '../lib/onboarding';

const router = express.Router();

router.get('/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const data = await fetchOnboardingProgress(userId);
    const steps = Object.entries(STEP_CREDITS).map(([key, credits]) => {
      const match = data.steps.find((s) => s.step_key === key);
      return {
        key,
        credits,
        completed_at: match?.completed_at || null,
        metadata: match?.metadata || {},
      };
    });

    res.json({
      steps,
      total_completed: data.total_completed,
      total_steps: data.total_steps,
      total_credits_awarded: data.total_credits_awarded,
    });
  } catch (e: any) {
    console.error('onboarding progress error', e);
    res.status(500).json({ error: e?.message || 'progress_error' });
  }
});

router.post('/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { step, metadata } = req.body || {};
    if (!step || !STEP_CREDITS[step as StepKey]) {
      return res.status(400).json({ error: 'invalid_step' });
    }
    const completion = await completeOnboardingStep(userId, step as StepKey, metadata || {});
    res.json(completion);
  } catch (e: any) {
    console.error('onboarding complete error', e);
    res.status(500).json({ error: e?.message || 'complete_error' });
  }
});

export default router;
