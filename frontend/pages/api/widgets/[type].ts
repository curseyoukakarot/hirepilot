import { createSupabaseForRequest, getBearerToken, assertAuth } from '../../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    const { type } = req.query as { type: string };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const qp = req.query || {};
    const timeRange = (qp.time_range as string) || '30d';
    const campaignId = (qp.campaign_id as string) || 'all';

    let data: any = [];

    switch (type) {
      case 'reply-rate': {
        // Aggregate reply rate by week from email_events
        const { data: rows } = await supabase
          .from('email_events')
          .select('timestamp,event_type')
          .eq('user_id', user.id)
          .gte('timestamp', new Date(Date.now() - 30*24*3600*1000).toISOString());
        // Lightweight in-API aggregation (fallback if SQL UDFs not present)
        const buckets = ['Week 1','Week 2','Week 3','Week 4'];
        const counts = [0,0,0,0];
        const sent: number[] = [0,0,0,0];
        (rows||[]).forEach(r => {
          const idx = Math.min(3, Math.floor(((Date.now() - new Date(r.timestamp).getTime())/(7*24*3600*1000))));
          if (idx>=0) {
            if (r.event_type==='reply') counts[3-idx]++; else if (r.event_type==='sent') sent[3-idx]++;
          }
        });
        const series = buckets.map((label,i)=>({ period: label, replyRate: sent[i] ? Math.round((counts[i]/sent[i])*1000)/10 : 0 }));
        data = series;
        break;
      }
      case 'deal-pipeline': {
        // Aggregate opportunity values by stage
        const { data: opps } = await supabase
          .from('opportunities')
          .select('stage,value,owner_id')
          .eq('owner_id', user.id);
        const sum = (st: string) => (opps||[]).filter(o => String(o.stage||'') === st).reduce((s,o:any)=> s + (Number(o.value)||0), 0);
        const cnt = (st: string) => (opps||[]).filter(o => String(o.stage||'') === st).length;
        const pipelineValue = sum('Pipeline');
        const bestCaseValue = sum('Best Case');
        const commitValue = sum('Commit');
        const closedWonValue = sum('Close Won');
        data = [{
          pipelineValue,
          bestCaseValue,
          commitValue,
          closedWonValue,
          pipelineDeals: cnt('Pipeline'),
          bestCaseDeals: cnt('Best Case'),
          commitDeals: cnt('Commit'),
          closedWonDeals: cnt('Close Won'),
          totalActiveDeals: (opps||[]).filter(o=>['Pipeline','Best Case','Commit'].includes(String(o.stage||''))).length,
          totalValue: pipelineValue + bestCaseValue + commitValue + closedWonValue,
        }];
        break;
      }
      case 'open-rate': {
        const { data: rows } = await supabase
          .from('email_events')
          .select('timestamp,event_type')
          .eq('user_id', user.id)
          .gte('timestamp', new Date(Date.now() - 30*24*3600*1000).toISOString());
        const buckets = [1,2,3,4,5];
        const opens = buckets.map(()=>0);
        const sent = buckets.map(()=>0);
        (rows||[]).forEach(r => {
          const dayIdx = Math.floor(Math.random()*5); // placeholder bucketing
          if (r.event_type==='open') opens[dayIdx]++; if (r.event_type==='sent') sent[dayIdx]++;
        });
        data = buckets.map((b,i)=>({ bucket: b, openRate: sent[i] ? Math.round((opens[i]/sent[i])*1000)/10 : 0 }));
        break;
      }
      case 'conversion-trends': {
        const { data: rows } = await supabase
          .from('candidates')
          .select('created_at')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 365*24*3600*1000).toISOString());
        const quarters = ['Q1','Q2','Q3','Q4'];
        const vals = [0,0,0,0];
        (rows||[]).forEach(r => {
          const d = new Date(r.created_at);
          const q = Math.floor(d.getMonth()/3);
          vals[q]++;
        });
        const sum = vals.reduce((a,b)=>a+b,0) || 1;
        data = quarters.map((q,i)=>({ quarter:q, conversion: Math.round((vals[i]/sum)*1000)/10 }));
        break;
      }
      case 'revenue-forecast': {
        // Stage-weighted forecast from opportunities created in the last 12 months
        const { data: opps } = await supabase
          .from('opportunities')
          .select('created_at,stage,value,owner_id')
          .eq('owner_id', user.id);
        const now = new Date();
        const buckets: Array<{ month: string; revenue: number }> = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
          buckets.push({ month: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, revenue: 0 });
        }
        const weights: Record<string, number> = { 'Pipeline': 0.25, 'Best Case': 0.5, 'Commit': 0.9, 'Close Won': 1, 'Closed Lost': 0 };
        (opps||[]).forEach((o:any) => {
          const created = new Date(o.created_at || now);
          const key = `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}`;
          const b = buckets.find(b => b.month === key);
          if (b) b.revenue += (Number(o.value)||0) * (weights[String(o.stage||'Pipeline')] ?? 0);
        });
        data = buckets;
        break;
      }
      case 'win-rate': {
        const { data: opps } = await supabase
          .from('opportunities')
          .select('stage,owner_id')
          .eq('owner_id', user.id);
        const total = (opps||[]).length || 1;
        const won = (opps||[]).filter(o => String(o.stage||'') === 'Close Won').length;
        data = [{ user_id: user.id, win_rate: Math.round((won/total)*1000)/10 }];
        break;
      }
      case 'engagement': {
        // Simple breakout from email_events
        const { data: rows } = await supabase
          .from('email_events')
          .select('event_type')
          .eq('user_id', user.id)
          .gte('timestamp', new Date(Date.now() - 30*24*3600*1000).toISOString());
        const agg = { open:0, reply:0, bounce:0, click:0 } as Record<string,number>;
        (rows||[]).forEach(r=>{ if(r.event_type in agg) agg[r.event_type]++; });
        const total = Object.values(agg).reduce((a,b)=>a+b,0)||1;
        data = Object.entries(agg).map(([k,v])=>({ metric:k, pct: Math.round((v/total)*1000)/10 }));
        break;
      }
      case 'pipeline-velocity': {
        const { data: rows } = await supabase
          .from('jobs')
          .select('created_at,updated_at,status')
          .eq('user_id', user.id)
          .limit(500);
        const stages = ['Applied','Screen','Interview','Offer','Hired'];
        const vals = stages.map(()=>Math.floor(Math.random()*8)+2); // placeholder if durations unknown
        data = stages.map((s,i)=>({ stage:s, days: vals[i] }));
        break;
      }
      case 'team-performance': {
        const { data: rows } = await supabase
          .from('users')
          .select('id, full_name')
          .limit(10);
        data = (rows||[]).map((r:any)=>({ owner: r.full_name||'Member', sent: Math.floor(Math.random()*500), opens: Math.floor(Math.random()*400), replies: Math.floor(Math.random()*120), hires: Math.floor(Math.random()*20) }));
        break;
      }
      default:
        data = [];
    }

    return res.status(200).json({ data });
  } catch (e: any) {
    const code = e?.statusCode || 500;
    return res.status(code).json({ error: e?.message || 'Failed' });
  }
}


