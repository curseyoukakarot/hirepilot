import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { generateAnalyticsInsights, AnalyticsSnapshot } from '../services/analytics/insights';

const router = express.Router();

// POST /api/analytics/insights/dashboard/:dashboardId
router.post('/insights/dashboard/:dashboardId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { question } = req.body || {};
    // Minimal snapshot placeholder (until dashboards storage is wired)
    const snapshot: AnalyticsSnapshot = {
      dashboardId: req.params.dashboardId,
      title: 'Dashboard',
      kpis: req.body?.kpis || [],
      series: req.body?.series || [],
      meta: { userId }
    };
    const out = await generateAnalyticsInsights(snapshot, question);
    res.json({ summary: out.summary, bulletInsights: out.bulletInsights, suggestions: out.suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'insights_failed' });
  }
});

// POST /api/analytics/insights/widget/:widgetId
router.post('/insights/widget/:widgetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { question } = req.body || {};
    const snapshot: AnalyticsSnapshot = {
      widgetId: req.params.widgetId,
      title: 'Widget',
      kpis: req.body?.kpis || [],
      series: req.body?.series || [],
      meta: { userId }
    };
    const out = await generateAnalyticsInsights(snapshot, question);
    res.json({ summary: out.summary, bulletInsights: out.bulletInsights, suggestions: out.suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'insights_failed' });
  }
});

// POST /api/analytics/query
router.post('/query', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    const { question, snapshots } = req.body || {};
    const combined: AnalyticsSnapshot = {
      title: 'Query',
      kpis: [],
      series: [],
      meta: { userId, multi: true }
    };
    try {
      if (Array.isArray(snapshots)) {
        for (const s of snapshots) {
          if (Array.isArray(s?.kpis)) combined.kpis.push(...s.kpis);
          if (Array.isArray(s?.series)) combined.series.push(...s.series);
        }
      }
    } catch {}
    const out = await generateAnalyticsInsights(combined, question || 'Summarize the provided analytics.');
    res.json({ answer: out.summary, summary: out.summary, bulletInsights: out.bulletInsights, suggestions: out.suggestions });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'query_failed' });
  }
});

export default router;


