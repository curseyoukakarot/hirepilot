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

// Lists for dropdowns (names)
analyticsRouter.get('/api/analytics/template-list', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from('email_templates').select('id, name').order('updated_at', { ascending: false }).limit(500);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, data: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

analyticsRouter.get('/api/analytics/sequence-list', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from('message_sequences').select('id, name').order('updated_at', { ascending: false }).limit(500);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, data: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Time series by template/sequence (last N days)
analyticsRouter.get('/api/analytics/time-series', async (req, res) => {
  try {
    const entity = String(req.query.entity || 'template'); // 'template' | 'sequence'
    const id = String(req.query.id || '');
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    if (!id) { res.json({ ok: true, data: [] }); return; }
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const col = entity === 'sequence' ? 'sequence_id' : 'template_id';
    const sql = `
      select date_trunc('day', e.occurred_at) as day,
             count(*) filter (where e.event_type='sent') as sent,
             count(*) filter (where e.event_type='open') as opens,
             count(*) filter (where e.event_type='reply') as replies
      from email_events e
      join messages m on e.message_id = m.id::text
      where m.${col} = :id and e.occurred_at >= now() - interval '${days} days'
      group by 1
      order by 1 asc`;
    // Execute via PostgREST RPC wrapper function 'exec_sql_params' if available; otherwise fallback not provided
    const { data, error } = await client.rpc('exec_sql_params', { sql, params: { id } } as any);
    if (error) { res.json({ ok: true, data: [] }); return; }
    const rows = (data as any[]) || [];
    const out = rows.map(r => {
      const sent = Number(r.sent)||0; const opens = Number(r.opens)||0; const replies = Number(r.replies)||0;
      const openRate = sent>0 ? Math.round((opens/sent)*1000)/10 : 0;
      const replyRate = sent>0 ? Math.round((replies/sent)*1000)/10 : 0;
      return { period: new Date(r.day).toISOString().slice(0,10), openRate, replyRate, conversionRate: 0 };
    });
    res.json({ ok: true, data: out });
  } catch (e: any) {
    res.json({ ok: true, data: [] });
  }
});


