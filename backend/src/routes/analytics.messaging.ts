import { Router } from 'express';
import { requireAuthUnified as requireAuth } from '../../middleware/requireAuthUnified';
export const analyticsRouter = Router();

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

analyticsRouter.get('/api/analytics/templates', requireAuth as any, async (req: any, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    // Compute live to avoid MV staleness and bad joins
    const userId = req.user.id as string;
    const sql = `
      select m.template_id,
             count(*) filter (where e.event_type='sent')   as sent,
             count(*) filter (where e.event_type='open')   as opens,
             count(*) filter (where e.event_type='reply')  as replies,
             count(*) filter (where e.event_type='bounce') as bounces
      from email_events e
      left join messages m
        on (e.message_id = m.message_id or e.sg_message_id = m.sg_message_id or e.message_id = m.id::text)
      where e.user_id = '${userId}' and m.template_id is not null
      group by m.template_id`;
    const { data: rows, error } = await client.rpc('exec_sql', { sql } as any);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const ids = (rows||[]).map((r:any)=>r.template_id).filter(Boolean);
    const userIdQuery = (req.query.user_id as string) || '';
    let nameMap: Record<string,string> = {};
    let allowed: string[] = [];
    if (ids.length) {
      // email_templates use user_id (not owner_user_id)
      let q = client.from('email_templates').select('id, name').in('id', ids).eq('user_id', req.user.id);
      const { data: tplRows } = await q;
      (tplRows||[]).forEach((t:any)=>{ nameMap[t.id] = t.name; });
      // Restrict to templates owned by the authenticated user only
      allowed = (tplRows||[]).map((t:any)=>t.id);
    }
    res.json({ ok: true, data: rows.filter((r:any)=> allowed.includes(r.template_id)).map(r => {
      const sent = Number(r.sent)||0, opens = Number(r.opens)||0, replies = Number(r.replies)||0, bounces = Number(r.bounces)||0;
      return { template_id: r.template_id, template_name: nameMap[r.template_id] || r.template_id, sent, opens, open_rate: pct(opens, sent), replies, reply_rate: pct(replies, sent), bounces, bounce_rate: pct(bounces, sent) };
    })});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

analyticsRouter.get('/api/analytics/sequences', requireAuth as any, async (req: any, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const userId = req.user.id as string;
    const sql = `
      select m.sequence_id,
             count(*) filter (where e.event_type='sent')   as sent,
             count(*) filter (where e.event_type='open')   as opens,
             count(*) filter (where e.event_type='reply')  as replies,
             count(*) filter (where e.event_type='bounce') as bounces
      from email_events e
      left join messages m
        on (e.message_id = m.message_id or e.sg_message_id = m.sg_message_id or e.message_id = m.id::text)
      where e.user_id = '${userId}' and m.sequence_id is not null
      group by m.sequence_id`;
    const { data: rows, error } = await client.rpc('exec_sql', { sql } as any);
    if (error) { res.status(500).json({ error: error.message }); return; }
    const ids = (rows||[]).map((r:any)=>r.sequence_id).filter(Boolean);
    const userIdQuery = (req.query.user_id as string) || '';
    let nameMap: Record<string,string> = {};
    let allowed: string[] = [];
    if (ids.length) {
      let q = client.from('message_sequences').select('id, name').in('id', ids).eq('owner_user_id', req.user.id);
      const { data: seqRows } = await q;
      (seqRows||[]).forEach((t:any)=>{ nameMap[t.id] = t.name; });
      // Restrict to sequences owned by the authenticated user only
      allowed = (seqRows||[]).map((t:any)=>t.id);
    }
    res.json({ ok: true, data: rows.filter((r:any)=> allowed.includes(r.sequence_id)).map(r => {
      const sent = Number(r.sent)||0, opens = Number(r.opens)||0, replies = Number(r.replies)||0, bounces = Number(r.bounces)||0;
      return { sequence_id: r.sequence_id, sequence_name: nameMap[r.sequence_id] || r.sequence_id, sent, opens, open_rate: pct(opens, sent), replies, reply_rate: pct(replies, sent), bounces, bounce_rate: pct(bounces, sent) };
    })});
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Lists for dropdowns (names)
analyticsRouter.get('/api/analytics/template-list', requireAuth as any, async (req: any, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const userIdQuery = (req.query.user_id as string) || '';
    // email_templates use user_id (not owner_user_id)
    let q = client.from('email_templates').select('id, name').order('updated_at', { ascending: false }).limit(500).eq('user_id', req.user.id);
    const { data, error } = await q;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, data: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

analyticsRouter.get('/api/analytics/sequence-list', requireAuth as any, async (req: any, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const userIdQuery = (req.query.user_id as string) || '';
    let q = client.from('message_sequences').select('id, name').order('updated_at', { ascending: false }).limit(500).eq('owner_user_id', req.user.id);
    const { data, error } = await q;
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ ok: true, data: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

// Time series by template/sequence (last N days)
analyticsRouter.get('/api/analytics/time-series', requireAuth as any, async (req: any, res) => {
  try {
    const entity = String(req.query.entity || 'template'); // 'template' | 'sequence'
    const id = String(req.query.id || '');
    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const userId = req.user.id as string;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const col = entity === 'sequence' ? 'sequence_id' : 'template_id';
    let idList: string[] = [];
    if (id && id !== 'all') {
      idList = [id];
    } else {
      // build allowed list by owner
      if (entity === 'sequence') {
        let q = client.from('message_sequences').select('id').eq('owner_user_id', userId);
        const { data: ids } = await q;
        idList = (ids||[]).map((x:any)=>x.id);
      } else {
        // email_templates use user_id
        let q = client.from('email_templates').select('id').eq('user_id', userId);
        const { data: ids } = await q;
        idList = (ids||[]).map((x:any)=>x.id);
      }
    }
    if (idList.length === 0) { res.json({ ok: true, data: [] }); return; }
    const inList = idList.map(x=>`'${x}'`).join(',');
    const sql = `
      select date_trunc('day', e.occurred_at) as day,
             count(*) filter (where e.event_type='sent') as sent,
             count(*) filter (where e.event_type='open') as opens,
             count(*) filter (where e.event_type='reply') as replies
      from email_events e
      left join messages m on (e.message_id = m.message_id or e.sg_message_id = m.sg_message_id or e.message_id = m.id::text)
      where m.${col} in (${inList}) and e.occurred_at >= now() - interval '${days} days'
      group by 1
      order by 1 asc`;
    const { data, error } = await client.rpc('exec_sql', { sql } as any);
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


