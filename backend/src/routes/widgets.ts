import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { supabase } from '../lib/supabase';
import { getDealsSharingContext } from '../lib/teamDealsScope';

const router = express.Router();

const authMw = (String(process.env.ENABLE_SESSION_COOKIE_AUTH || 'false').toLowerCase() === 'true'
  ? (requireAuthUnified as any)
  : (requireAuth as any));

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clampSeriesToHorizon(series: Array<{ month: string; revenue: number; projected?: boolean }>, horizon: string) {
  if (horizon !== 'eoy') return series;
  const now = new Date();
  const year = now.getFullYear();
  return series.filter((r) => Number(String(r.month).split('-')[0]) === year);
}

// GET /api/widgets/revenue-forecast?mode=paid&horizon=eoy&limit=12
router.get('/revenue-forecast', authMw, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const mode = String((req.query as any)?.mode || 'paid').toLowerCase();
    const horizon = String((req.query as any)?.horizon || 'eoy').toLowerCase();
    const limit = Math.max(1, Math.min(36, Number((req.query as any)?.limit || 12)));

    // Only support "paid" mode for now (DealsPage uses this).
    if (mode !== 'paid') {
      res.json({ data: [] });
      return;
    }

    const ctx = await getDealsSharingContext(userId, {
      teamId: (req as any).user?.team_id || null,
      invitedBy: (req as any).user?.invited_by || null,
      role: (req as any).user?.role || null,
    });

    const owners = (ctx.visibleOwnerIds || [userId]).length ? (ctx.visibleOwnerIds || [userId]) : [userId];

    // Build series: paid invoice totals by month (use paid_at when available, else created_at)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (limit - 1), 1);

    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount,status,paid_at,created_at,opportunity_id')
      .in('status', ['paid'] as any);

    // Scope by opportunities owned by visible owners
    const { data: opps } = await supabase
      .from('opportunities')
      .select('id,owner_id')
      .in('owner_id', owners);
    const visibleOppIds = new Set((opps || []).map((o: any) => String(o.id)));

    const buckets = new Map<string, number>();
    for (let i = limit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(monthKey(d), 0);
    }

    (invoices || []).forEach((inv: any) => {
      const oppId = String(inv?.opportunity_id || '');
      if (!oppId || !visibleOppIds.has(oppId)) return;
      const dt = new Date(inv?.paid_at || inv?.created_at || now);
      if (dt < start) return;
      const key = monthKey(new Date(dt.getFullYear(), dt.getMonth(), 1));
      if (!buckets.has(key)) return;
      buckets.set(key, (buckets.get(key) || 0) + (Number(inv?.amount) || 0));
    });

    let series = Array.from(buckets.entries()).map(([month, revenue]) => ({ month, revenue: Math.round(Math.max(0, revenue)) }));
    series = clampSeriesToHorizon(series, horizon);

    // Projection to EOY (optional): simple pacing using average of non-zero months in series
    if (horizon === 'eoy') {
      const year = now.getFullYear();
      const ytd = series.filter((r) => Number(String(r.month).split('-')[0]) === year && Number(String(r.month).split('-')[1]) <= (now.getMonth() + 1));
      const nonZero = ytd.filter((r) => (Number(r.revenue) || 0) > 0);
      const avg = nonZero.length ? (nonZero.reduce((s, r) => s + (Number(r.revenue) || 0), 0) / nonZero.length) : 0;
      for (let m = now.getMonth() + 1; m < 12; m++) {
        const k = monthKey(new Date(year, m, 1));
        if (!series.some((r) => r.month === k)) {
          series.push({ month: k, revenue: Math.round(avg), projected: true });
        }
      }
      series = series.sort((a, b) => a.month.localeCompare(b.month));
    }

    res.json({ data: series });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal server error' });
  }
});

export default router;


