import { Router } from 'express';
export const analyticsRouter = Router();

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

analyticsRouter.get('/api/analytics/templates', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: rows, error } = await client
      .from('template_performance_mv')
      .select('template_id, sent, opens, replies, bounces')
      .not('template_id', 'is', null);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const ids = (rows||[]).map((r:any)=>r.template_id).filter(Boolean);
    let nameMap: Record<string,string> = {};
    if (ids.length) {
      const { data: tplRows } = await client.from('email_templates').select('id, name').in('id', ids);
      (tplRows||[]).forEach((t:any)=>{ nameMap[t.id] = t.name; });
    }
    res.json({ ok: true, data: rows.map(r => {
      const sent = Number(r.sent)||0, opens = Number(r.opens)||0, replies = Number(r.replies)||0, bounces = Number(r.bounces)||0;
      return { template_id: r.template_id, template_name: nameMap[r.template_id] || r.template_id, sent, opens, open_rate: pct(opens, sent), replies, reply_rate: pct(replies, sent), bounces, bounce_rate: pct(bounces, sent) };
    })});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

analyticsRouter.get('/api/analytics/sequences', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: rows, error } = await client
      .from('sequence_performance_mv')
      .select('sequence_id, sent, opens, replies, bounces')
      .not('sequence_id', 'is', null);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const ids = (rows||[]).map((r:any)=>r.sequence_id).filter(Boolean);
    let nameMap: Record<string,string> = {};
    if (ids.length) {
      const { data: seqRows } = await client.from('message_sequences').select('id, name').in('id', ids);
      (seqRows||[]).forEach((t:any)=>{ nameMap[t.id] = t.name; });
    }
    res.json({ ok: true, data: rows.map(r => {
      const sent = Number(r.sent)||0, opens = Number(r.opens)||0, replies = Number(r.replies)||0, bounces = Number(r.bounces)||0;
      return { sequence_id: r.sequence_id, sequence_name: nameMap[r.sequence_id] || r.sequence_id, sent, opens, open_rate: pct(opens, sent), replies, reply_rate: pct(replies, sent), bounces, bounce_rate: pct(bounces, sent) };
    })});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});


