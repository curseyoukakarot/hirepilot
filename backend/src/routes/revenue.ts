import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canViewRevenue(userId: string): Promise<boolean> {
  const { role, team_id } = await getRoleTeam(userId);
  const lc = String(role || '').toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  // Block Free plan regardless of role
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
  } catch {}
  if (team_id && lc !== 'team_admin') {
    const { data } = await supabase.from('deal_permissions').select('can_view_revenue').eq('user_id', userId).maybeSingle();
    return Boolean((data as any)?.can_view_revenue);
  }
  return true;
}

function applyCurrency(n: number): number { return Math.max(0, Math.round(n)); }

// GET /api/revenue/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (!(await canViewRevenue(userId))) { res.status(403).json({ error: 'access_denied' }); return; }
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    // Scope opportunities
    let oppIds: string[] = [];
    if (isSuper) {
      const { data } = await supabase.from('opportunities').select('id');
      oppIds = (data || []).map((r: any) => r.id);
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      const { data } = await supabase.from('opportunities').select('id').in('owner_id', ids);
      oppIds = (data || []).map((r: any) => r.id);
    } else {
      const { data } = await supabase.from('opportunities').select('id').eq('owner_id', userId);
      oppIds = (data || []).map((r: any) => r.id);
    }

    // Totals from invoices
    const { data: invs } = await supabase
      .from('invoices')
      .select('amount,status,paid_at')
      .in('opportunity_id', oppIds.length ? oppIds : ['00000000-0000-0000-0000-000000000000']);
    const total_paid = applyCurrency((invs || []).filter(i => i.status === 'paid').reduce((s, i: any) => s + (Number(i.amount)||0), 0));
    const overdue = applyCurrency((invs || []).filter(i => i.status === 'overdue').reduce((s, i: any) => s + (Number(i.amount)||0), 0));
    const unpaid = applyCurrency((invs || []).filter(i => i.status === 'sent' || i.status === 'unbilled').reduce((s, i: any) => s + (Number(i.amount)||0), 0));

    // Forecast from opportunities by stage weight
    const { data: opps } = await supabase.from('opportunities').select('id,stage,value');
    const stageWeights: Record<string, number> = { 'Pipeline': 25, 'Best Case': 50, 'Commit': 90, 'Close Won': 100, 'Closed Lost': 0 };
    const forecasted = applyCurrency((opps || []).filter(o => oppIds.includes(o.id)).reduce((s, o: any) => {
      const w = stageWeights[String(o.stage||'Pipeline')] ?? 0;
      return s + (Number(o.value)||0) * (w/100);
    }, 0));

    // Open pipeline from opportunities in open stages (Pipeline/Best Case/Commit)
    const openStages = ['Pipeline','Best Case','Commit'];
    const open_pipeline = applyCurrency((opps || [])
      .filter(o => oppIds.includes(o.id) && openStages.includes(String(o.stage||'')))
      .reduce((s, o: any) => s + (Number(o.value)||0), 0));

    res.json({ total_paid, forecasted, overdue, unpaid: open_pipeline });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/revenue/by-client
router.get('/by-client', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (!(await canViewRevenue(userId))) { res.status(403).json({ error: 'access_denied' }); return; }
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let oppIds: string[] = [];
    if (isSuper) {
      const { data } = await supabase.from('opportunities').select('id');
      oppIds = (data || []).map((r: any) => r.id);
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      const { data } = await supabase.from('opportunities').select('id').in('owner_id', ids);
      oppIds = (data || []).map((r: any) => r.id);
    } else {
      const { data } = await supabase.from('opportunities').select('id').eq('owner_id', userId);
      oppIds = (data || []).map((r: any) => r.id);
    }

    const { data: invs } = await supabase
      .from('invoices')
      .select('client_id,amount,status')
      .in('opportunity_id', oppIds.length ? oppIds : ['00000000-0000-0000-0000-000000000000']);
    const byClient: Record<string, { total: number; paid: number; unpaid: number }> = {};
    for (const r of (invs || [])) {
      const key = (r as any).client_id as string;
      const amt = Number((r as any).amount)||0;
      byClient[key] = byClient[key] || { total: 0, paid: 0, unpaid: 0 };
      byClient[key].total += amt;
      if ((r as any).status === 'paid') byClient[key].paid += amt; else byClient[key].unpaid += amt;
    }
    // Fetch client names
    const ids = Object.keys(byClient).filter(Boolean);
    const { data: clients } = ids.length ? await supabase.from('clients').select('id,name').in('id', ids) : { data: [] as any };
    const map = new Map((clients || []).map((c: any) => [c.id, c.name]));
    const rows = ids.map(id => ({ client_id: id, client_name: map.get(id) || id, ...byClient[id] }))
      .sort((a,b)=>b.total-a.total).slice(0,5);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/revenue/projected-by-client (from opportunities)
router.get('/projected-by-client', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (!(await canViewRevenue(userId))) { res.status(403).json({ error: 'access_denied' }); return; }
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase.from('opportunities').select('client_id,value,stage');
    if (!isSuper) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('owner_id', userId);
      }
    }
    const { data: opps, error } = await base;
    if (error) { res.status(500).json({ error: error.message }); return; }
    const openStages = ['Pipeline','Best Case','Commit'];
    const byClient: Record<string, number> = {};
    for (const o of (opps || [])) {
      if (!openStages.includes(String((o as any).stage||''))) continue;
      const key = String((o as any).client_id || 'unknown');
      byClient[key] = (byClient[key] || 0) + (Number((o as any).value)||0);
    }
    const ids = Object.keys(byClient).filter(Boolean);
    const { data: clients } = ids.length ? await supabase.from('clients').select('id,name').in('id', ids) : { data: [] as any };
    const nameMap = new Map((clients || []).map((c: any) => [c.id, c.name]));
    const rows = ids.map(id => ({ client_id: id, client_name: nameMap.get(id) || id, total: byClient[id] }))
      .sort((a,b)=>b.total-a.total).slice(0,5);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/revenue/monthly
router.get('/monthly', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (!(await canViewRevenue(userId))) { res.status(403).json({ error: 'access_denied' }); return; }
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let oppIds: string[] = [];
    if (isSuper) {
      const { data } = await supabase.from('opportunities').select('id');
      oppIds = (data || []).map((r: any) => r.id);
    } else if (isTeamAdmin && team_id) {
      const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
      const ids = (teamUsers || []).map((u: any) => u.id);
      const { data } = await supabase.from('opportunities').select('id').in('owner_id', ids);
      oppIds = (data || []).map((r: any) => r.id);
    } else {
      const { data } = await supabase.from('opportunities').select('id').eq('owner_id', userId);
      oppIds = (data || []).map((r: any) => r.id);
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth()-11, 1);
    const { data: invs } = await supabase
      .from('invoices')
      .select('amount,status,paid_at,sent_at')
      .in('opportunity_id', oppIds.length ? oppIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('sent_at', start.toISOString());
    const buckets: Array<{ month: string; paid: number; forecasted: number; outstanding: number }> = [];
    for (let i=0; i<12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      buckets.push({ month: key, paid: 0, forecasted: 0, outstanding: 0 });
    }
    for (const r of (invs || [])) {
      const dt = (r as any).paid_at || (r as any).sent_at;
      if (!dt) continue;
      const d = new Date(dt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const b = buckets.find(b => b.month === key);
      if (!b) continue;
      const amt = Number((r as any).amount)||0;
      if ((r as any).status === 'paid') b.paid += amt; else b.outstanding += amt;
    }
    res.json(buckets);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/revenue/monthly-projected from opportunities (stage-weighted)
router.get('/monthly-projected', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase.from('opportunities').select('created_at,stage,value,owner_id');
    if (!isSuper) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('owner_id', userId);
      }
    }
    const { data: opps, error } = await base;
    if (error) { res.status(500).json({ error: error.message }); return; }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth()-11, 1);
    const buckets: Array<{ month: string; paid: number; forecasted: number; outstanding: number }> = [];
    for (let i=0; i<12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      buckets.push({ month: key, paid: 0, forecasted: 0, outstanding: 0 });
    }

    const stageWeights: Record<string, number> = { 'Pipeline': 25, 'Best Case': 50, 'Commit': 90, 'Close Won': 100, 'Closed Lost': 0 };
    for (const o of (opps || [])) {
      const created = new Date((o as any).created_at || new Date());
      if (created < start) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}`;
      const b = buckets.find(b => b.month === key);
      if (!b) continue;
      const w = stageWeights[String((o as any).stage || 'Pipeline')] ?? 0;
      b.forecasted += (Number((o as any).value)||0) * (w/100);
    }

    // round
    for (const b of buckets) b.forecasted = applyCurrency(b.forecasted);
    res.json(buckets);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/revenue/engagement-types (projected from opportunities)
router.get('/engagement-types', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    const isSuper = ['super_admin','superadmin'].includes(role.toLowerCase());
    const isTeamAdmin = role.toLowerCase() === 'team_admin';

    let base = supabase.from('opportunities').select('billing_type,stage,value');
    if (!isSuper) {
      if (isTeamAdmin && team_id) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', team_id);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('owner_id', userId);
      }
    }
    const { data: opps, error } = await base;
    if (error) { res.status(500).json({ error: error.message }); return; }
    const openStages = ['Pipeline','Best Case','Commit','Close Won'];
    const map: Record<string, number> = {};
    for (const o of (opps || [])) {
      if (!openStages.includes(String((o as any).stage||''))) continue;
      const key = String((o as any).billing_type || 'unknown');
      map[key] = (map[key] || 0) + (Number((o as any).value)||0);
    }
    const rows = Object.keys(map).map(k => ({ type: k, total: map[k] })).sort((a,b)=>b.total-a.total);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


