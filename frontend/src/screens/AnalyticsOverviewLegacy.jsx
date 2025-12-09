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
  const [overviewSummary, setOverviewSummary] = useState({ sent: 0, openRateTotal: 0, openRateUnique: 0, replyRate: 0, conversionRate: 0, converted: 0 });
  const [overviewSeries, setOverviewSeries] = useState({ labels: [], openTotal: [], openUnique: [], reply: [], conv: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('all');
  const [analyticsBlocked, setAnalyticsBlocked] = useState(false);
  // no-op state removed; always show tick labels with proper colors

  // Load campaigns for dropdown (backend preferred, Supabase fallback)
  useEffect(() => {
    if (analyticsBlocked) {
      setCampaigns([]);
      return;
    }
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
            const token = (await supabase.auth.getSession())?.data?.session?.access_token;
            const resp = await fetch(`${base}/api/getCampaigns`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              credentials: 'include'
            });
            if (resp.ok) {
              const result = await resp.json();
              list = Array.isArray(result.campaigns) ? result.campaigns : [];
            } else if (resp.status === 403) {
              setAnalyticsBlocked(true);
              setCampaigns([]);
              return;
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
  }, [analyticsBlocked]);

  // Load Overview data (summary and series)
  useEffect(() => {
    const loadOverview = async () => {
      if (analyticsBlocked) {
        setOverviewSummary({ sent: 0, openRateTotal: 0, openRateUnique: 0, replyRate: 0, conversionRate: 0, converted: 0 });
        setOverviewSeries({ labels: [], openTotal: [], openUnique: [], reply: [], conv: [] });
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id || '';
        const days = overviewRange === '30d' ? 30 : overviewRange === '90d' ? 90 : 180;
        const sinceIso = new Date(Date.now() - days*24*3600*1000).toISOString();
        const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
        const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
        const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
        const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');

        let convertedCandidates = 0;
        let totalLeads = 0;
        const eventKey = (row) => {
          if (row?.message_id) return String(row.message_id);
          if (row?.lead_id) return `lead-${row.lead_id}`;
          if (row?.campaign_id && row?.event_timestamp) return `camp-${row.campaign_id}-${row.event_timestamp}`;
          return String(row?.event_timestamp || Math.random());
        };

        if (base && uid) {
          try {
            const token = session?.access_token;
            const endpointId = campaignId && campaignId !== 'all' ? campaignId : 'all';
            const r = await fetch(`${base}/api/campaigns/${encodeURIComponent(endpointId)}/performance`, {
              headers: token ? { Authorization: 'Bearer ' + token } : {},
              credentials: 'include'
            });
            if (r.status === 403) {
              setAnalyticsBlocked(true);
              setOverviewSummary({ sent: 0, openRateTotal: 0, openRateUnique: 0, replyRate: 0, conversionRate: 0, converted: 0 });
              setOverviewSeries({ labels: [], openTotal: [], openUnique: [], reply: [], conv: [] });
              return;
            }
            if (r.ok && (r.headers.get('content-type')||'').includes('application/json')) {
              const j = await r.json();
              convertedCandidates = Number(j.converted_candidates || 0);
              totalLeads = Number(j.total_leads || 0);
            }
          } catch {}
        }
        // Candidate conversions fallback when scoped to a campaign
        if (!convertedCandidates && campaignId !== 'all' && uid) {
          try {
            const { data: hires } = await supabase
              .from('candidates')
              .select('id, created_at, status')
              .eq('status','hired')
              .gte('created_at', sinceIso);
            convertedCandidates = (hires||[]).length;
          } catch {}
        }

        // Always compute messaging metrics from scoped email_events for the selected range
        const { data: rows } = await supabase
          .from('email_events')
          .select('event_type,event_timestamp,campaign_id,message_id,lead_id')
          .eq('user_id', uid)
          .gte('event_timestamp', sinceIso);

        const sentMessages = new Set();
        const openMessages = new Set();
        let sentEvents = 0, openEvents = 0, replyEvents = 0;

        (rows||[]).forEach((r) => {
          if (campaignId !== 'all' && r.campaign_id && String(r.campaign_id) !== String(campaignId)) return;
          const t = r && r.event_type;
          const key = eventKey(r);
          if (t === 'sent') { sentEvents++; sentMessages.add(key); }
          else if (t === 'open') { openEvents++; openMessages.add(key); }
          else if (t === 'reply') { replyEvents++; }
        });

        const sentBase = sentMessages.size || sentEvents;
        const uniqueOpens = Math.min(openMessages.size, sentBase || openMessages.size);
        const openRateTotal = sentBase ? ((openEvents / sentBase) * 100) : 0;
        const openRateUnique = sentBase ? ((uniqueOpens / sentBase) * 100) : 0;
        const replyRate = sentBase ? ((replyEvents / sentBase) * 100) : 0;
        const conversionRate = (totalLeads || sentBase) ? (((convertedCandidates / (totalLeads || sentBase)) * 100)) : 0;

        if (!totalLeads) totalLeads = sentBase;

        setOverviewSummary({ sent: sentBase, openRateTotal, openRateUnique, replyRate, conversionRate, converted: convertedCandidates });

        // Preferred: call backend overview-series which aggregates server-side with service role
        const loadSeries = async () => {
          const rangeParam = overviewRange;
          try {
            if (base) {
              const params = new URLSearchParams({
                campaign_id: String(campaignId || 'all'),
                range: String(rangeParam || '30d'),
              });
              const token = session?.access_token || '';
              const r = await fetch(`${base}/api/analytics/overview-series?${params.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: 'include',
              });
              if (r.ok) {
                const series = await r.json();
                if (Array.isArray(series)) {
                  const labels = series.map((d)=> String((d && d.period) || ''));
                  const openTotal = series.map((d)=> Number((d && (d.openRateTotal ?? d.openRate)) || 0));
                  const openUnique = series.map((d)=> Number((d && (d.openRateUnique ?? d.openRate)) || 0));
                  const replyS = series.map((d)=> Number((d && d.replyRate) || 0));
                  setOverviewSeries({ labels, openTotal, openUnique, reply: replyS, conv: [] });
                  return;
                }
              }
            }
          } catch {}
          // Fallback: local aggregation from Supabase (RLS dependent)
          try {
            const rangeDays = overviewRange==='30d' ? 30 : overviewRange==='90d' ? 90 : 180;
            const since = new Date(Date.now() - rangeDays*24*3600*1000).toISOString();
            const { data: rows } = await supabase
              .from('email_events')
              .select('event_timestamp,event_type,campaign_id,user_id,message_id,lead_id')
              .gte('event_timestamp', since)
              .eq('user_id', uid);
            const weekMs = 7*24*3600*1000;
            const bucketCount = overviewRange==='30d' ? 4 : overviewRange==='90d' ? 12 : 24;
            const labels = Array.from({ length: bucketCount }, (_, i) => `Week ${i+1}`);
            const buckets = Array.from({ length: bucketCount }, () => ({
              sentEvents: 0,
              sentMessages: new Set(),
              replies: 0,
              replyMessages: new Set(),
              opens: 0,
              openMessages: new Set()
            }));
            (rows||[]).forEach((r) => {
              if (campaignId !== 'all' && Object.prototype.hasOwnProperty.call(r,'campaign_id') && r.campaign_id && String(r.campaign_id) !== String(campaignId)) return;
              const ts = r && r.event_timestamp ? new Date(r.event_timestamp) : null; if (!ts) return;
              const diff = Date.now() - ts.getTime();
              const idxFromEnd = Math.min(bucketCount-1, Math.floor(diff / weekMs));
              const bucket = bucketCount - 1 - idxFromEnd; if (bucket < 0 || bucket >= bucketCount) return;
              const et = r && r.event_type;
              const key = eventKey(r);
              const target = buckets[bucket];
              if (et === 'sent') { target.sentEvents++; target.sentMessages.add(key); }
              if (et === 'reply') { target.replies++; target.replyMessages.add(key); }
              if (et === 'open') { target.opens++; target.openMessages.add(key); }
            });
            const replyS = labels.map((_, i) => {
              const bucket = buckets[i];
              const sentBase = bucket.sentMessages.size || bucket.sentEvents;
              const replyCount = bucket.replyMessages.size || bucket.replies;
              return sentBase ? Math.round((replyCount / sentBase) * 1000) / 10 : 0;
            });
            const openTotal = labels.map((_, i) => {
              const bucket = buckets[i];
              const sentBase = bucket.sentMessages.size || bucket.sentEvents;
              return sentBase ? Math.round((bucket.opens / sentBase) * 1000) / 10 : 0;
            });
            const openUnique = labels.map((_, i) => {
              const bucket = buckets[i];
              const sentBase = bucket.sentMessages.size || bucket.sentEvents;
              const uniqueOpens = bucket.openMessages.size || Math.min(bucket.opens, sentBase);
              return sentBase ? Math.round((uniqueOpens / sentBase) * 1000) / 10 : 0;
            });
            setOverviewSeries({ labels, openTotal, openUnique, reply: replyS, conv: [] });
          } catch {
            setOverviewSeries({ labels: [], openTotal: [], openUnique: [], reply: [], conv: [] });
          }
        };
        await loadSeries();
      } catch {
        if (analyticsBlocked) return;
        setOverviewSummary({ sent: 0, openRateTotal: 0, openRateUnique: 0, replyRate: 0, conversionRate: 0, converted: 0 });
        setOverviewSeries({ labels: [], openTotal: [], openUnique: [], reply: [], conv: [] });
      }
    };
    loadOverview();
  }, [overviewRange, campaignId, analyticsBlocked]);

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
                { label: 'Unique Open Rate', data: [], borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.12)', tension: 0.35, fill: true, borderWidth: 3 },
                { label: 'Total Open Rate', data: [], borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.10)', tension: 0.35, fill: true, borderWidth: 2.5, borderDash: [6,4] },
                { label: 'Reply Rate', data: [], borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)', tension: 0.35, fill: true, borderWidth: 3 }
              ]
            },
            options: {
              plugins: { legend: { position: 'top' } },
              // Show ticks with explicit colors so they are visible in dark mode
              scales: {
                y: { beginAtZero: true, grace: '15%', ticks: { display: true, color: '#9CA3AF', callback: (v) => `${Number(v).toFixed(1)}%` }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
                x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } }
              },
              maintainAspectRatio: false,
              spanGaps: true
            }
          });
        }
        const inst = chartRef.current;
        inst.data.labels = overviewSeries.labels || [];
        if (inst.data.datasets?.[0]) inst.data.datasets[0].data = overviewSeries.openUnique || [];
        if (inst.data.datasets?.[1]) inst.data.datasets[1].data = overviewSeries.openTotal || [];
        if (inst.data.datasets?.[2]) inst.data.datasets[2].data = overviewSeries.reply || [];
        // Let Chart.js auto-scale based on real % values from the backend (no manual max/suggestedMax)
        try { inst.update(); } catch {}
      }
    })();
    return () => { try { chartRef.current?.destroy(); } catch {} chartRef.current = null; };
  }, [overviewSeries]);

  if (analyticsBlocked) {
    return (
      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Campaign Performance</h1>
          <p className="text-gray-500">Your team admin has disabled analytics sharing for this account.</p>
        </div>
      </div>
    );
  }

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
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-xs text-gray-500 mb-2">Open Rate</div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold text-indigo-700">{overviewSummary.openRateUnique.toFixed(1)}%</div>
              <div className="text-[11px] uppercase tracking-wide text-indigo-500">Unique</div>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex flex-col items-center">
              <div className="text-lg font-semibold text-blue-600">{overviewSummary.openRateTotal.toFixed(1)}%</div>
              <div className="text-[11px] uppercase tracking-wide text-blue-500">Total</div>
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Reply Rate</div><div className="text-2xl font-bold">{overviewSummary.replyRate.toFixed(1)}%</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Conversion Rate</div><div className="text-2xl font-bold">{overviewSummary.conversionRate.toFixed(1)}%</div></div>
        <div className="bg-white border rounded-lg p-4 text-center"><div className="text-xs text-gray-500 mb-1">Converted Candidates</div><div className="text-2xl font-bold text-green-700">{overviewSummary.converted.toLocaleString('en-US')}</div></div>
      </div>
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800">Performance Overview</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span>Unique Open Rate</span>
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span>Total Open Rate</span>
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



