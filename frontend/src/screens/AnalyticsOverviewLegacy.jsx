import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Lazy Chart.js singleton
let __chartConstructor = null;
async function getChartLib() {
  if (__chartConstructor) return __chartConstructor;
  const mod = await import('chart.js/auto');
  __chartConstructor = mod.Chart || mod.default;
  return __chartConstructor;
}

export default function AnalyticsOverviewLegacy() {
  const chartRef = useRef(null);
  const [overviewRange, setOverviewRange] = useState('30d'); // '30d'|'90d'|'6m'
  const [overviewSummary, setOverviewSummary] = useState({ sent: 0, openRate: 0, replyRate: 0, conversionRate: 0, converted: 0 });
  const [overviewSeries, setOverviewSeries] = useState({ labels: [], open: [], reply: [], conv: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('all');

  // Load campaigns for dropdown (backend preferred, Supabase fallback)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
        const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
        const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
        const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
        let list = [];
        if (base) {
          try {
            const resp = await fetch(`${base}/api/getCampaigns?user_id=${encodeURIComponent(user.id)}`);
            if (resp.ok) {
              const result = await resp.json();
              list = Array.isArray(result.campaigns) ? result.campaigns : [];
            }
          } catch {}
        }
        if (!list.length) {
          const { data: rows } = await supabase.from('campaigns').select('id,name,title,user_id').eq('user_id', user.id);
          list = rows || [];
        }
        setCampaigns(list.map(c => ({ id: c.id, name: c.name || c.title || 'Untitled' })));
      } catch {}
    })();
  }, []);

  // Load Overview data (summary and series)
  useEffect(() => {
    const loadOverview = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id || '';
        const days = overviewRange === '30d' ? 30 : overviewRange === '90d' ? 90 : 180;
        const sinceIso = new Date(Date.now() - days*24*3600*1000).toISOString();
        const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
        const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
        const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
        const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');

        let sent = 0, opens = 0, replies = 0, conversions = 0, convertedCandidates = 0, totalLeads = 0;
        if (base && uid) {
          try {
            const token = session?.access_token;
            const qs = new URLSearchParams({ user_id: uid, since: sinceIso });
            if (campaignId !== 'all') qs.set('campaign_id', String(campaignId));
            const r = await fetch(`${base}/api/campaigns/all/performance?${qs.toString()}`, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
            if (r.ok && (r.headers.get('content-type')||'').includes('application/json')) {
              const j = await r.json();
              sent = Number(j.sent||0); opens = Number(j.opens||0); replies = Number(j.replies||0); conversions = Number(j.conversions||0);
              convertedCandidates = Number(j.converted_candidates || 0);
              totalLeads = Number(j.total_leads || 0);
            }
          } catch {}
        }
        // If a specific campaign is selected, always ensure campaign-scoped metrics using Supabase as source of truth
        if (campaignId !== 'all' && uid) {
          try {
            const { data: evCounts } = await supabase
              .from('email_events')
              .select('event_type', { count: 'exact', head: false })
              .eq('user_id', uid)
              .eq('campaign_id', campaignId)
              .gte('event_timestamp', sinceIso);
            // Supabase doesn't aggregate here; do a second query to fetch rows to aggregate reliably
            const { data: evRows } = await supabase
              .from('email_events')
              .select('event_type')
              .eq('user_id', uid)
              .eq('campaign_id', campaignId)
              .gte('event_timestamp', sinceIso);
            let s=0,o=0,rp=0,cv=0;
            (evRows||[]).forEach(e=>{
              if (e.event_type==='sent') s++;
              else if (e.event_type==='open') o++;
              else if (e.event_type==='reply') rp++;
              else if (e.event_type==='conversion') cv++;
            });
            sent = s; opens = o; replies = rp; conversions = cv;
          } catch {}
          try {
            const { data: hires } = await supabase
              .from('candidates')
              .select('id, created_at, status, campaign_id')
              .eq('status','hired')
              .eq('campaign_id', campaignId)
              .gte('created_at', sinceIso);
            convertedCandidates = (hires||[]).length;
          } catch {}
          totalLeads = sent || totalLeads;
        }
        if (!sent && uid) {
          const { data: rows } = await supabase.from('email_events').select('event_type,event_timestamp,campaign_id').eq('user_id', uid).gte('event_timestamp', sinceIso);
          (rows||[]).forEach((r) => {
            if (campaignId !== 'all' && r.campaign_id && String(r.campaign_id) !== String(campaignId)) return;
            const t = r && r.event_type;
            if (t === 'sent') sent++;
            else if (t === 'open') opens++;
            else if (t === 'reply') replies++;
            else if (t === 'conversion') conversions++;
          });
          try {
            const { data: hires } = await supabase
              .from('candidates')
              .select('id,created_at,status,user_id,campaign_id')
              .eq('user_id', uid)
              .eq('status','hired')
              .gte('created_at', sinceIso);
            convertedCandidates = (hires || []).filter(h => campaignId === 'all' || !h.campaign_id || String(h.campaign_id) === String(campaignId)).length;
          } catch {}
          totalLeads = sent; // fallback when backend doesn't provide total leads
        }
        const openRate = sent ? ((opens/sent)*100) : 0;
        const replyRate = sent ? ((replies/sent)*100) : 0;
        const conversionRate = (totalLeads || sent) ? (((convertedCandidates / (totalLeads || sent))*100)) : 0;
        setOverviewSummary({ sent, openRate, replyRate, conversionRate, converted: convertedCandidates });

        const { data: evs } = await supabase.from('email_events').select('event_type,event_timestamp,campaign_id').eq('user_id', uid).gte('event_timestamp', sinceIso);
        const weekMs = 7*24*3600*1000;
        const bucketCount = overviewRange==='30d' ? 4 : overviewRange==='90d' ? 12 : 24;
        const labels = Array.from({ length: bucketCount }, (_, i) => 'Week ' + (i+1));
        const sentA = Array.from({ length: bucketCount }, () => 0);
        const openA = Array.from({ length: bucketCount }, () => 0);
        const replyA = Array.from({ length: bucketCount }, () => 0);
        (evs||[]).forEach((r) => {
          if (campaignId !== 'all' && r.campaign_id && String(r.campaign_id) !== String(campaignId)) return;
          const ts = r && r.event_timestamp ? new Date(r.event_timestamp).getTime() : null; if (!ts) return;
          const idxFromEnd = Math.min(bucketCount-1, Math.floor((Date.now() - ts) / weekMs));
          const b = bucketCount - 1 - idxFromEnd; if (b < 0 || b >= bucketCount) return;
          const t = r && r.event_type;
          if (t === 'sent') sentA[b]++; else if (t === 'open') openA[b]++; else if (t === 'reply') replyA[b]++;
        });
        const openS = labels.map((_,i)=> sentA[i] ? Math.round((openA[i]/sentA[i])*1000)/10 : 0);
        const replyS = labels.map((_,i)=> sentA[i] ? Math.round((replyA[i]/sentA[i])*1000)/10 : 0);
        setOverviewSeries({ labels, open: openS, reply: replyS, conv: [] });
      } catch {
        setOverviewSummary({ sent: 0, openRate: 0, replyRate: 0, conversionRate: 0, converted: 0 });
        setOverviewSeries({ labels: [], open: [], reply: [], conv: [] });
      }
    };
    loadOverview();
  }, [overviewRange, campaignId]);

  // Init and update chart
  useEffect(() => {
    (async () => {
      const el = document.getElementById('overview-chart');
      if (el) {
        const Chart = await getChartLib();
        if (!chartRef.current) {
          chartRef.current = new Chart(el, {
            type: 'line',
            data: {
              labels: [],
              datasets: [
                { label: 'Open Rate', data: [], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.10)', tension: 0.35, fill: true, borderWidth: 3 },
                { label: 'Reply Rate', data: [], borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)', tension: 0.35, fill: true, borderWidth: 3 }
              ]
            },
            options: {
              plugins: { legend: { position: 'top' } },
              scales: { y: { beginAtZero: true } }, // ensure zero baseline for clarity
              maintainAspectRatio: false,
              spanGaps: true
            }
          });
        }
        const inst = chartRef.current;
        inst.data.labels = overviewSeries.labels || [];
        if (inst.data.datasets?.[0]) inst.data.datasets[0].data = overviewSeries.open || [];
        if (inst.data.datasets?.[1]) inst.data.datasets[1].data = overviewSeries.reply || [];
        try { inst.update(); } catch {}
      }
    })();
    return () => { try { chartRef.current?.destroy(); } catch {} chartRef.current = null; };
  }, [overviewSeries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center text-sm text-green-700 bg-green-100 px-2 py-1 rounded-full">Active</span>
          <label className="text-sm text-gray-600">Campaign:</label>
          <select value={campaignId} onChange={(e)=>setCampaignId(e.target.value)} className="border rounded-md p-2 text-sm min-w-[200px]">
            <option value="all">All Campaigns</option>
            {campaigns.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Range:</label>
          <select value={overviewRange} onChange={(e)=>setOverviewRange(e.target.value)} className="border rounded-md p-2 text-sm">
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="6m">Last 6 months</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Leads Messaged</div><div className="text-2xl font-bold">{overviewSummary.sent.toLocaleString('en-US')}</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Open Rate</div><div className="text-2xl font-bold">{overviewSummary.openRate.toFixed(1)}%</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Reply Rate</div><div className="text-2xl font-bold">{overviewSummary.replyRate.toFixed(1)}%</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Conversion Rate</div><div className="text-2xl font-bold">{overviewSummary.conversionRate.toFixed(1)}%</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Converted Candidates</div><div className="text-2xl font-bold text-green-700">{overviewSummary.converted.toLocaleString('en-US')}</div></div>
      </div>
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800">Performance Overview</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span>Open Rate</span>
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span>Reply Rate</span>
          </div>
        </div>
        <div className="h-64">
          <canvas id="overview-chart"></canvas>
        </div>
      </div>
    </div>
  );
}



