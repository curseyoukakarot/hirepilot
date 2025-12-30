import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { supabase } from '../lib/supabase';

const router = express.Router();

async function getRoleTeam(userId: string): Promise<{ role: string; team_id: string | null }> {
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).maybeSingle();
  return { role: String((data as any)?.role || ''), team_id: (data as any)?.team_id || null };
}

async function canView(userId: string): Promise<boolean> {
  const { role, team_id } = await getRoleTeam(userId);
  const lc = String(role || '').toLowerCase();
  if (['super_admin','superadmin'].includes(lc)) return true;
  // Block Free plan explicitly (do not gate on missing/unknown)
  try {
    const { data: sub } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier = String((sub as any)?.plan_tier || '').toLowerCase();
    if (tier === 'free') return false;
    if (!tier) {
      const { data: usr } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
      const plan = String((usr as any)?.plan || '').toLowerCase();
      if (plan === 'free') return false;
    }
  } catch {}
  try {
    const { data: sub2 } = await supabase.from('subscriptions').select('plan_tier').eq('user_id', userId).maybeSingle();
    const tier2 = String((sub2 as any)?.plan_tier || '').toLowerCase();
    if (tier2 === 'team' && team_id && lc !== 'team_admin') {
      const { data } = await supabase.from('deal_permissions').select('can_view_opportunities').eq('user_id', userId).maybeSingle();
      return Boolean((data as any)?.can_view_opportunities);
    }
  } catch {}
  return true;
}

const defaultWeights: Record<string, number> = {
  'Pipeline': 25,
  'Best Case': 50,
  'Commit': 90,
  'Close Won': 100,
  'Closed Lost': 0,
};

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canView(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { team_id } = await getRoleTeam(userId);
    const { data: stages } = await supabase
      .from('opportunity_stages')
      .select('id,name,order_index,weight_percent')
      .eq('team_id', team_id)
      .order('order_index', { ascending: true });

    const stageList = (stages && stages.length)
      ? stages
      : Object.keys(defaultWeights).map((name, idx) => ({ id: `default_${idx}`, name, order_index: idx, weight_percent: defaultWeights[name] }));

    // Fetch opportunities with same scoping as opportunities page
    const roleTeam = await getRoleTeam(userId);
    const role = roleTeam.role;
    const tId = roleTeam.team_id;
    const isSuper = ['super_admin','superadmin'].includes(String(role||'').toLowerCase());
    const isTeamAdmin = String(role||'').toLowerCase() === 'team_admin';
    let base = supabase
      .from('opportunities')
      .select('id,title,value,stage,client_id,owner_id,created_at,forecast_date');
    if (!isSuper) {
      if (isTeamAdmin && tId) {
        const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', tId);
        const ids = (teamUsers || []).map((u: any) => u.id);
        base = base.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else {
        base = base.eq('owner_id', userId);
      }
    }
    const { data: opps } = await base;

    const clientIds = Array.from(new Set((opps || []).map((o: any) => o.client_id).filter(Boolean)));
    const [{ data: clients }] = await Promise.all([
      clientIds.length ? supabase.from('clients').select('id,name,domain').in('id', clientIds) : Promise.resolve({ data: [] as any })
    ] as any);
    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

    const byStage = new Map<string, any[]>();
    for (const st of stageList) byStage.set(st.name, []);
    for (const o of (opps || [])) {
      const stageName = String((o as any).stage || 'Pipeline');
      const normalized = ['Closed Won','Won'].includes(stageName) ? 'Close Won' : stageName;
      const arr = byStage.get(normalized) || byStage.get('Pipeline') || [];
      arr.push({ ...o, client: clientMap.get(o.client_id) || null });
      byStage.set(normalized || 'Pipeline', arr);
    }

    const payload = stageList.map((st) => {
      const items = byStage.get(st.name) || [];
      const total = items.reduce((s: number, it: any) => s + (Number(it.value) || 0), 0);
      const weight = st.weight_percent ?? defaultWeights[st.name] ?? 0;
      const weighted = Math.round(total * (weight / 100));
      return { stage: st.name, weight_percent: weight, order_index: st.order_index, total, weighted, items };
    });

    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

router.patch('/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canView(userId))) { res.status(403).json({ error: 'access_denied' }); return; }
    const { opportunity_id, to_stage } = req.body || {};
    if (!opportunity_id || !to_stage) { res.status(400).json({ error: 'Missing params' }); return; }

    const { error } = await supabase
      .from('opportunities')
      .update({ stage: to_stage })
      .eq('id', opportunity_id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

router.get('/stages', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!(await canView(userId))) { res.status(403).json({ error: 'access_denied' }); return; }

    const { team_id } = await getRoleTeam(userId);
    const { data, error } = await supabase
      .from('opportunity_stages')
      .select('id,name,order_index,weight_percent,team_id')
      .eq('team_id', team_id)
      .order('order_index', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    const defaults = Object.keys(defaultWeights).map((name, i) => ({ id: `default_${i}`, name, order_index: i, weight_percent: defaultWeights[name] }));
    res.json((data && data.length) ? data : defaults);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

router.patch('/stages/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { role, team_id } = await getRoleTeam(userId);
    if (!['super_admin','team_admin','superadmin'].includes(role.toLowerCase())) { res.status(403).json({ error: 'admin_only' }); return; }

    const { stages } = req.body || {} as { stages: Array<{ id: string; order_index: number; weight_percent?: number }> };
    if (!Array.isArray(stages)) { res.status(400).json({ error: 'Invalid payload' }); return; }

    for (const st of stages) {
      await supabase
        .from('opportunity_stages')
        .update({ order_index: st.order_index, weight_percent: st.weight_percent })
        .eq('id', st.id)
        .eq('team_id', team_id);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

export default router;


