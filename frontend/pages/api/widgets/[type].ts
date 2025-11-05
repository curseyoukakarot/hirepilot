import { createSupabaseForRequest, getBearerToken, assertAuth } from '../_utils/supabaseServer';

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    assertAuth(token);
    const supabase = createSupabaseForRequest(req);
    const { type } = req.query as { type: string };

    const { data: { user } } = await supabase.auth.getUser(token || undefined as any);
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
        // True revenue pacing with configurable mode & horizon
        const mode = (qp.mode as string) || 'paid'; // 'paid' | 'closewon' | 'blended'
        const horizon = (qp.horizon as string) || 'eoy'; // 'eoy' | '12m'

        const now = new Date();
        const start12 = new Date(now.getFullYear(), now.getMonth()-11, 1);
        const keyFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

        // Build 12-month buckets
        const months12: Array<{ month: string; revenue: number; projected?: boolean }> = [];
        for (let i=11; i>=0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
          months12.push({ month: keyFor(d), revenue: 0 });
        }

        const applyWeights = (stage?: string) => {
          const weights: Record<string, number> = { 'Pipeline': 0.25, 'Best Case': 0.5, 'Commit': 0.9, 'Close Won': 1, 'Closed Lost': 0 };
          return weights[String(stage||'Pipeline')] ?? 0;
        };

        const base = process.env.BACKEND_URL || '';
        if (mode === 'paid') {
          // Use backend revenue monthly (service role) to get paid amounts safely
          if (base) {
            const r = await fetch(`${base.replace(/\/$/, '')}/api/revenue/monthly`, { headers: token ? { Authorization: `Bearer ${token}` } : {} } as any);
            const monthly = r.ok ? await r.json() : [];
            (monthly||[]).forEach((row:any)=>{
              const parts = String(row.month||'').split('-');
              if (parts.length===2) {
                const k = `${parts[0]}-${parts[1]}`;
                const b = months12.find(m=>m.month===k);
                if (b) b.revenue += Number(row.paid||0);
              }
            });
          }
        } else if (mode === 'closewon') {
          let have = false;
          if (base) {
            const qs = new URLSearchParams({ status: 'Close Won' });
            const r = await fetch(`${base.replace(/\/$/, '')}/api/opportunities?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} } as any);
            const opps = r.ok ? await r.json() : [];
            (opps||[]).forEach((o:any)=>{
              const d = new Date(o.created_at || now);
              const k = keyFor(new Date(d.getFullYear(), d.getMonth(), 1));
              const b = months12.find(m=>m.month===k);
              if (b) b.revenue += Number(o.value)||0;
            });
            have = (opps||[]).length > 0;
          }
          // fallback to direct supabase (user-owned only) if backend returned none
          if (!have) {
            const { data: opps } = await supabase
              .from('opportunities')
              .select('created_at,stage,value,owner_id')
              .eq('owner_id', user.id)
              .in('stage', ['Close Won','Closed Won','Won']);
            (opps||[]).forEach((o:any) => {
              const d = new Date(o.created_at || now);
              const k = keyFor(new Date(d.getFullYear(), d.getMonth(), 1));
              const b = months12.find(m => m.month === k);
              if (b) b.revenue += Number(o.value)||0;
            });
          }
        } else { // blended (stage-weighted)
          if (base) {
            const r = await fetch(`${base.replace(/\/$/, '')}/api/revenue/monthly-projected`, { headers: token ? { Authorization: `Bearer ${token}` } : {} } as any);
            const proj = r.ok ? await r.json() : [];
            (proj||[]).forEach((row:any)=>{
              const parts = String(row.month||'').split('-');
              if (parts.length===2) {
                const k = `${parts[0]}-${parts[1]}`;
                const b = months12.find(m=>m.month===k);
                if (b) b.revenue += Number(row.forecasted||0);
              }
            });
          }
        }

        // Pacing projection
        const monthsElapsed = now.getMonth() + 1; // 1..12
        const curYear = now.getFullYear();
        const ytd = months12.filter(m => Number(m.month.split('-')[0]) === curYear && Number(m.month.split('-')[1]) <= (now.getMonth()+1)).reduce((s,m)=>s+m.revenue,0);
        const monthlyAvgYTD = monthsElapsed ? (ytd / monthsElapsed) : 0;
        const projectedYearTotal = monthlyAvgYTD * 12;
        const monthlyPace = horizon === 'eoy' ? monthlyAvgYTD : (months12.reduce((s,m)=>s+m.revenue,0) / 12);

        // Fill future months
        const out: Array<{ month: string; revenue: number; projected?: boolean }> = months12.map(m => ({ ...m }));
        if (horizon === 'eoy') {
          for (let m=now.getMonth()+1; m<12; m++) {
            const k = keyFor(new Date(curYear, m, 1));
            const ex = out.find(x => x.month === k);
            if (ex) { ex.revenue = ex.revenue || monthlyPace; ex.projected = true; }
            else out.push({ month: k, revenue: monthlyPace, projected: true });
          }
        } else {
          // rolling next 12 months
          for (let i=1; i<=12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
            out.push({ month: keyFor(d), revenue: monthlyPace, projected: true });
          }
        }
        // Return last N points (default 6) for UI
        const limit = Math.max(1, Math.min(24, Number(qp.limit || 6)));
        data = out.slice(-limit);
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


