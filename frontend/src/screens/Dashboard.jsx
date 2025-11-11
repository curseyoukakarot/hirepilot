import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../context/PlanContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Lazy Chart.js singleton to avoid TDZ/cross-bundle issues
let __wrap0 = null;
async function getChartLib() {
  if (__wrap0) return __wrap0;
  const mod = await import('chart.js/auto');
  __wrap0 = mod.Chart || mod.default;
  return __wrap0;
}

// Helper to build default dashboard widgets
const DEFAULT_WIDGETS = ['Reply Rate Chart', 'Open Rate Widget', 'Engagement Breakdown'];

// Map widget name to corresponding Analytics tab for "View" action
const WIDGET_TAB = {
  'Reply Rate Chart': 'outreach',
  'Open Rate Widget': 'outreach',
  'Engagement Breakdown': 'deals',
  'Revenue Forecast': 'deals',
  'Deal Pipeline': 'deals',
  'Win Rate KPI': 'deals',
};

// Helper function to generate avatar URL
const getAvatarUrl = (name) => `https://app.thehirepilot.com/api/avatar?name=${encodeURIComponent(name)}`;

export default function Dashboard() {
  const chartRef = useRef(null);
  const dashCharts = useRef({});
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState(null);
  // helper: robustly turn stored layout (objects or names) into names[]
  const toNames = (val) => {
    try {
      const arr = typeof val === 'string' ? JSON.parse(val) : val;
      if (Array.isArray(arr)) {
        return arr.map((it) => (typeof it === 'string' ? it : (it && it.widget_id) || null)).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  };
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [rexEnabled, setRexEnabled] = useState(false);
  const [customWidgets, setCustomWidgets] = useState([]);
  const [dealPipeline, setDealPipeline] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [engageCampaignId, setEngageCampaignId] = useState('all');
  const [openProvider, setOpenProvider] = useState('all'); // 'all' | 'google' | 'outlook' | 'sendgrid'
  const [openRateDisplay, setOpenRateDisplay] = useState(null);
  const [openRange, setOpenRange] = useState('90d'); // '30d' | '90d' | '6m'
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const navigate = useNavigate();
  const { isFree } = usePlan();

  // Persist layout helper
  const persistLayout = async (names) => {
    setCustomWidgets(names);
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const uid = sessionData?.user?.id;
      if (uid) {
        const { data: existing } = await supabase
          .from('user_dashboards')
          .select('user_id, layout')
          .eq('user_id', uid)
          .maybeSingle();
        const layout = (names || []).slice(0, 6).map((w, i) => ({
          widget_id: w,
          position: { x: 0, y: 0 },
          config: {},
        }));
        if (existing) {
          await supabase.from('user_dashboards').update({ layout, updated_at: new Date().toISOString() }).eq('user_id', uid);
        } else {
          await supabase.from('user_dashboards').insert({ user_id: uid, layout, updated_at: new Date().toISOString() });
        }
      } else {
        const key = `dashboard_widgets_${'anon'}`;
        localStorage.setItem(key, JSON.stringify(names));
      }
    } catch (_) {
      const key = `dashboard_widgets_${user?.id || 'anon'}`;
      try { localStorage.setItem(key, JSON.stringify(names)); } catch {}
    }
  };

  useEffect(() => {
    const fetchUserAndMetrics = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        // Avoid noisy 404s: skip legacy tables in production
        try {
          const response = await fetch(`${BACKEND_URL}/api/campaigns/all/performance?user_id=${data.user.id}`);
          const result = await response.json();
          setMetrics(result);
        } catch (_) {
          setMetrics(null);
        }
        setRexEnabled(false);
      }
      setLoading(false);
    };
    fetchUserAndMetrics();
  }, [navigate]);

  // Load per-user dashboard widgets from API (fallback to localStorage -> defaults)
  useEffect(() => {
    // Immediate render from seed/local (no awaits, no network) to avoid any race
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id || 'anon';
        const seed = localStorage.getItem(`dashboard_seed_${uid}`) || localStorage.getItem('dashboard_seed_anon');
        if (seed) {
          try {
            const arr = JSON.parse(seed);
            const names = Array.isArray(arr) ? arr.map((it)=> (typeof it === 'string' ? it : (it?.widget_id || it))) : [];
            if (names.length) {
              setCustomWidgets(names.slice(0, 6));
              return;
            }
          } catch {}
        }
        const local = localStorage.getItem(`dashboard_widgets_${uid}`);
        if (local) {
          try {
            const arr = JSON.parse(local);
            const names = Array.isArray(arr) ? arr.map((it)=> (typeof it === 'string' ? it : (it?.widget_id || it))) : [];
            if (names.length) {
              setCustomWidgets(names.slice(0, 6));
              return;
            }
          } catch {}
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      // If we already have widgets from the immediate render, don't override them here.
      if (Array.isArray(customWidgets) && customWidgets.length > 0) {
        try {
          const { data: u } = await supabase.auth.getUser();
          const uid = u?.user?.id || 'anon';
          const seedKey = `dashboard_seed_${uid}`;
          if (localStorage.getItem(seedKey)) {
            try { localStorage.removeItem(seedKey); } catch {}
          }
        } catch {}
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.access_token;
        // One-time seed: if present, apply immediately (handle auth race by checking both anon and uid)
        try {
          const candidates = [];
          const uid = sessionData?.user?.id || '';
          if (uid) candidates.push(`dashboard_seed_${uid}`);
          candidates.push(`dashboard_seed_${'anon'}`);
          let raw = null, keyUsed = '';
          for (const k of candidates) {
            const v = localStorage.getItem(k);
            if (v) { raw = v; keyUsed = k; break; }
          }
          if (raw) {
            const arr = JSON.parse(raw);
            const names = Array.isArray(arr) ? arr.map((it)=> (typeof it === 'string' ? it : (it?.widget_id || it))) : [];
            if (names.length) {
              setCustomWidgets(names.slice(0,6));
              // Persist in background; if no uid yet, persistLayout will fallback to localStorage
              try { await persistLayout(names); } catch (_) {}
              try { if (keyUsed) localStorage.removeItem(keyUsed); } catch {}
              return; // show seeded layout immediately
            }
          }
        } catch (_) {}

        const r = await fetch('/api/dashboard/layout', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        if (r.ok) {
          const j = await r.json();
          const names = (Array.isArray(j.layout) ? j.layout : []).map((w) => w.widget_id || w).slice(0, 6);
          if (names.length) {
            setCustomWidgets(names);
            return;
          }
        }
      } catch (_) {}
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (uid) {
          const { data: row } = await supabase
            .from('user_dashboards')
            .select('layout')
            .eq('user_id', uid)
            .maybeSingle();
          if (row?.layout && row.layout.length) {
            const names = (Array.isArray(row.layout) ? row.layout : []).map((w) => w?.widget_id || w).slice(0, 6);
            setCustomWidgets(names);
            return;
          }
          }
      } catch (_) {}
      // Default for new accounts / no remote layout – check per-user and legacy keys
      const uid = (await supabase.auth.getUser()).data?.user?.id || 'anon';
      const key = `dashboard_widgets_${uid}`;
      let local = [];
      try { local = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
      if (!Array.isArray(local) || !local.length) {
        try { local = JSON.parse(localStorage.getItem('dashboard_widgets_local') || '[]'); } catch {}
      }
      const fallback = Array.isArray(local) && local.length ? local.slice(0, 6) : DEFAULT_WIDGETS;
      setCustomWidgets(fallback);
      try { localStorage.setItem('dashboard_widgets_' + uid, JSON.stringify(fallback)); } catch (_) {}
    };
    load();
  }, []);

  // Initialize snapshot charts with real data when widgets or filters change
  useEffect(() => {
    Object.values(dashCharts.current || {}).forEach((c) => {
      try { c.destroy(); } catch (_) {}
    });
    dashCharts.current = {};
    const fetchWithAuth = async (path) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
    };

    (async () => {
      const Chart = await getChartLib();
      if (customWidgets.includes('Deal Pipeline')) {
        try {
          const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
          const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
          const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
          const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const hdrs = token ? { Authorization: `Bearer ${token}` } : {};

          let rows = [];
          if (base) {
            const r = await fetch(`${base}/api/opportunity-pipeline`, { headers: hdrs });
            rows = r.ok ? await r.json() : [];
          }
          if (!Array.isArray(rows) || !rows.length) {
            const { data: me } = await supabase.from('users').select('role, team_id').eq('id', session?.user?.id).maybeSingle();
            const role = String((me||{}).role||'').toLowerCase();
            const teamId = (me||{}).team_id || null;
            const isTeamAdmin = role === 'team_admin';
            let baseQ = supabase.from('opportunities').select('stage,value,owner_id');
            if (!['super_admin','superadmin'].includes(role)) {
              if (isTeamAdmin && teamId) {
                const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', teamId);
                const ids = (teamUsers||[]).map(u=>u.id);
                baseQ = baseQ.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        } else {
                baseQ = baseQ.eq('owner_id', session?.user?.id);
              }
            }
            const { data: opps } = await baseQ;
            const stageOf = (o)=>{ const s=String(o.stage||''); return ['Closed Won','Won'].includes(s)?'Close Won':s; };
            const agg = (st)=> (opps||[]).filter(o=>stageOf(o)===st);
            rows = [
              { stage:'Pipeline', items: agg('Pipeline'), total: agg('Pipeline').reduce((s,o)=>s+(Number(o.value)||0),0) },
              { stage:'Best Case', items: agg('Best Case'), total: agg('Best Case').reduce((s,o)=>s+(Number(o.value)||0),0) },
              { stage:'Commit', items: agg('Commit'), total: agg('Commit').reduce((s,o)=>s+(Number(o.value)||0),0) },
              { stage:'Close Won', items: agg('Close Won'), total: agg('Close Won').reduce((s,o)=>s+(Number(o.value)||0),0) },
            ];
          }
          const get = (name)=> rows.find(r=>String(r.stage||'')===name) || { total:0, items:[] };
          const payload = {
            pipelineValue: Number(get('Pipeline').total||0),
            bestCaseValue: Number(get('Best Case').total||0),
            commitValue: Number(get('Commit').total||0),
            closedWonValue: Number((get('Close Won').total||0) || (get('Closed Won').total||0)),
            pipelineDeals: (get('Pipeline').items||[]).length,
            bestCaseDeals: (get('Best Case').items||[]).length,
            commitDeals: (get('Commit').items||[]).length,
            closedWonDeals: (get('Close Won').items||[]).length || (get('Closed Won').items||[]).length,
          };
          setDealPipeline(payload);
        } catch { setDealPipeline({ pipelineValue:0,bestCaseValue:0,commitValue:0,closedWonValue:0,pipelineDeals:0,bestCaseDeals:0,commitDeals:0,closedWonDeals:0 }); }
      }
      if (customWidgets.includes('Engagement Breakdown')) {
        try {
          const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
          const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
          const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
          const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const uid = session?.user?.id || '';
          const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
          let payload = null;
          if (base) {
            const qs = new URLSearchParams({ user_id: String(uid) });
            if (engageCampaignId && engageCampaignId !== 'all') {
              qs.set('campaign_id', String(engageCampaignId));
            }
            const r = await fetch(`${base}/api/campaigns/all/performance?${qs.toString()}`, { headers: hdrs });
            const ct = r.headers?.get?.('content-type') || '';
            if (r.ok && ct.includes('application/json')) {
              const p = await r.json();
              const sent = Number(p.sent || 0);
              const opens = Number(p.opens || 0);
              const replies = Number(p.replies || 0);
              const conversions = Number(p.conversions || 0);
              const openPct = sent ? (opens / sent) * 100 : 0;
              const replyPct = sent ? (replies / sent) * 100 : 0;
              const bouncePct = sent ? ((sent - opens) / sent) * 100 : 0;
              const clickPct = sent ? (conversions / sent) * 100 : 0;
              payload = [
                { metric: 'open', pct: Math.round(openPct * 10) / 10 },
                { metric: 'reply', pct: Math.round(replyPct * 10) / 10 },
                { metric: 'bounce', pct: Math.round(bouncePct * 10) / 10 },
                { metric: 'click', pct: Math.round(clickPct * 10) / 10 },
              ];
            }
          }
          if (!payload) {
            let q = supabase
              .from('email_events')
              .select('event_timestamp,event_type')
              .eq('user_id', uid)
              .gte('event_timestamp', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
            if (engageCampaignId && engageCampaignId !== 'all') {
              q = q.eq('campaign_id', engageCampaignId);
            }
            const { data: rows } = await q;
            const agg = { open: 0, reply: 0, bounce: 0, click: 0 };
            (rows || []).forEach((r) => { const ev = r && r.event_timestamp ? r.event_type : null; if (ev && (ev in agg)) agg[ev] = (agg[ev] || 0) + 1; });
            const total = Object.values(agg).reduce((a, b) => a + b, 0) || 1;
            payload = Object.entries(agg).map(([k, v]) => ({ metric: k, pct: Math.round(((v / total) * 1000)) / 10 }));
          }
          setEngagement(payload);
        } catch {
          setEngagement([{ metric: 'open', pct: 0 }, { metric: 'reply', pct: 0 }, { metric: 'bounce', pct: 0 }, { metric: 'click', pct: 0 }]);
        }
      }
      if (customWidgets.includes('Reply Rate Chart')) {
        try {
          let labels = [];
          let vals = [];
          try {
            const r = await fetchWithAuth('/api/widgets/reply-rate');
            const j = r.ok ? await r.json() : { data: [] };
            if (Array.isArray(j.data) && j.data.length) {
              labels = j.data.map((d) => d.period || '');
              vals = j.data.map((d) => d.replyRate || 0);
            }
          } catch {}
          if (!vals.length) {
            const { data: rows } = await supabase
              .from('email_events')
              .select('event_timestamp,event_type');
            const bucketCount = 12;
            const weekMs = 7 * 24 * 3600 * 1000;
            labels = Array.from({ length: bucketCount }, (_, i) => `W${i + 1}`);
            const sent = Array.from({ length: bucketCount }, () => 0);
            const replies = Array.from({ length: bucketCount }, () => 0);
            (rows || []).forEach((r) => {
              const ts = r && r.event_timestamp ? new Date(r.event_timestamp).getTime() : null;
              if (!ts) return;
              const diff = Date.now() - ts;
              const idxFromEnd = Math.min(bucketCount - 1, Math.floor(diff / (7 * 24 * 3600 * 1000)));
              const bucket = bucketCount - 1 - idxFromEnd;
              if (bucket < 0 || bucket >= bucketCount) return;
              const et = r && r.event_type;
              if (et === 'sent') sent[bucket]++;
              if (et === 'reply') replies[bucket]++;
            });
            vals = labels.map((_, i) => (sent[i] ? Math.round((replies[i] / sent[i]) * 1000) / 10 : 0));
          }
          const ctx = document.getElementById('dash-reply-rate');
    if (ctx) {
            const Chart = await getChartLib();
            dashCharts.current.reply = new Chart(ctx, {
              type: 'line',
              data: { labels, datasets: [{ label: 'Reply %', data: vals, borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.10)', fill: true, tension: 0.3 }] },
              options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#9CA3AF', callback: (v) => `${v}%` } }, x: { grid: { color: '#f3f4f6' } } }, maintainFrame: false },
            });
          }
        } catch {}
      }
      if (customWidgets.includes('Open Rate Widget')) {
        try {
          // Fetch series filtered by provider and range
          const r = await fetchWithAuth(`/api/widgets/open-rate?time_range=${encodeURIComponent(openRange)}&provider=${encodeURIComponent(openProvider)}`);
          const j = r.ok ? await r.json() : { data: [] };
          const labels = (j.data||[]).map(d=>d.period||''); const vals = (j.data||[]).map(d=>d.openRate||0);
          // Compute top-level open rate for this provider within selected window
          try {
            const days = openRange==='90d' ? 90 : (openRange==='6m' ? 180 : 30);
            const sinceIso = new Date(Date.now() - days*24*3600*1000).toISOString();
            let q = supabase.from('email_events').select('event_timestamp,event_type,provider').gte('event_timestamp', sinceIso).eq('user_id', (await supabase.auth.getUser()).data?.user?.id);
            if (openProvider !== 'all') q = q.eq('provider', openProvider);
            const { data: evs } = await q;
            let sentAll = 0, opensAll = 0;
            (evs||[]).forEach(e=>{ if (e.event_type==='sent') sentAll++; else if (e.event_type==='open') opensAll++; });
            setOpenRateDisplay(sentAll ? Math.round((opensAll/sentAll)*1000)/10 : 0);
          } catch { setOpenRateDisplay(null); }
          const ctx = document.getElementById('dash-open-rate'); if (ctx) {
            const Chart = await getChartLib();
            dashCharts.current.open = new Chart(ctx, {
        type: 'line',
              data: { labels, datasets: [{ label: 'Open %', data: vals, borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.12)', fill: true, tension: 0.3 }] },
              options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { color: '#9CA3AF', callback: (v) => `${v}%` } }, x: { grid: { color: '#f3f4f6' } } }, responsive: true, maintainAspectRatio: false },
            });
          }
        } catch {}
      }
      if (customWidgets.includes('Revenue Forecast')) {
        try {
          const fromProcess = (typeof process !== 'undefined' && process.env) ? (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL) : '';
          const fromVite = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_BACKEND_URL) : '';
          const fromWindow = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : '';
          const base = String(fromProcess || fromVite || fromWindow || '').replace(/\/$/, '');
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token; const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
          let actual = [];
          let projected = [];
          if (base) {
            const [paidRes, projRes] = await Promise.all([
              fetch(`${base}/api/revenue/monthly`, { headers: hdrs }),
              fetch(`${base}/api/revenue/monthly-projected`, { headers: hdrs }),
            ]);
            const paidCt = paidRes.headers?.get?.('content-type') || '';
            const projCt = projRes.headers?.get?.('content-type') || '';
            if (paidRes.ok && paidCt.includes('application/json')) {
              const paid = await paidRes.json();
              actual = (paid || []).map((r) => ({ month: r.month, revenue: Number(r.paid) || 0 }));
            }
            if (projRes.ok && projCt.includes('application/json')) {
              const pr = await projRes.json();
              projected = (pr || []).map((r) => ({ month: r.month, revenue: Number(r.forecasted) || 0, projected: true }));
            }
            if (!actual.length || actual.reduce((s,r)=>s+r.revenue,0) === 0) {
              // fallback to Close Won series
              const [cwRes, cwProj] = await Promise.all([
                fetch(`${base}/api/revenue/closewon-monthly?range=1y`, { headers: hdrs }),
                fetch(`${base}/api/revenue/closewon-projected?horizon=eoy`, { headers: hdrs }),
              ]);
              const mCt = cwRes.headers?.get?.('content-type') || '';
              const pCt = cwProj.headers?.get?.('content-type') || '';
              if (cwRes.ok && mCt.includes('application/json')) {
                const m = await cwRes.json();
                actual = (m.series||[]).map((r)=>({ month: r.month, revenue: Number(r.revenue)||0 }));
              }
              if (cwProj.ok && pCt.includes('application/json')) {
                const p = await cwProj.json();
                projected = (p.series||[]).filter((r)=>r.projected).map((r)=>({ month: r.month, revenue: Number(r.revenue)||0, projected: true }));
              }
            }
          }
          // Final fallback: derive from Supabase opportunities (Close Won) scoped to user/team
          if ((!actual.length || actual.every(r=>!r.revenue)) && session?.user?.id) {
            try {
              const { data: me } = await supabase.from('users').select('role, team_id').eq('id', session.user.id).maybeSingle();
              const role = String((me||{}).role||'').toLowerCase();
              const isTeamAdmin = role === 'team_admin';
              const teamId = (me||{}).team_id || null;
              let q = supabase.from('opportunities').select('created_at,stage,value,owner_id');
              if (!['super_admin','superadmin'].includes(role)) {
                if (isTeamAdmin && teamId) {
                  const { data: teamUsers } = await supabase.from('users').select('id').eq('team_id', teamId);
                  const ids = (teamUsers||[]).map(u=>u.id);
                  q = q.in('owner_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
                } else {
                  q = q.eq('owner_id', session.user.id);
                }
              }
              const { data: opps } = await q;
              const closeWon = (opps||[]).filter((o)=> ['Close Won','Closed Won','Won'].includes(String(o.stage||'')));
              const byMonth = {};
              (closeWon||[]).forEach((o)=>{
                const key = new Date(o.created_at||Date.now()).toISOString().slice(0,7);
                byMonth[key] = (byMonth[key]||0) + (Number(o.value)||0);
              });
              actual = Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
              projected = [];
            } catch {}
          }
          const byMonth = new Map();
          actual.forEach(r=>byMonth.set(r.month, { month: r.month, actual: r.revenue, projected: 0 }));
          projected.forEach(r=>{
            const v = byMonth.get(r.month) || { month: r.month, actual: 0, projected: 0 };
            v.projected = r.revenue; byMonth.set(r.month, v);
          });
          // Keep only last 6 months for snapshot clarity
          const rowsAll = Array.from(byMonth.values()).sort((a,b)=> a.month.localeCompare(b.month));
          const rows = rowsAll.slice(-6);
          const labels = rows.map(r=>r.month);
          const aData = rows.map(r=>r.actual);
          const pData = rows.map(r=>r.projected);
          const ctx = document.getElementById('dash-revenue');
          if (ctx) {
            const Chart = await getChartLib();
            dashCharts.current.revenue = new Chart(ctx, {
              type: 'line',
              data: {
                labels,
                datasets: [
                  { label: 'Revenue', data: aData, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)', fill: true, tension: 0.3 },
                  { label: 'Forecasted', data: pData, borderColor: '#6B46C1', backgroundColor: 'rgba(107,70,193,0.08)', fill: true, tension: 0.3, borderDash: [6,4] },
                ],
              },
              options: { plugins: { legend: { display: true, position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { color: '#9CA3AF', callback: (v)=> `$${Number(v).toLocaleString('en-US')}` } }, x: { grid: { color: '#f3f4f6' } } }, responsive: true, maintainAspectRatio: false },
      });
    }
        } catch {}
      }
    })();

    return () => {
      Object.values(dashCharts.current || {}).forEach((c) => {
        try { c.destroy(); } catch (_) {}
      });
      dashCharts.current = {};
    };
  }, [customWidgets, engageCampaignId, openProvider, openRange]);

  // Calculate reply rate & conversion
  const replyRate = metrics && metrics.sent ? (metrics.replies / metrics.sent) * 100 : 0;
  const conversionRate = metrics && metrics.total_leads ? (metrics.converted || metrics.converted_candidates || 0) / (metrics.sent || 1) * 100 : 0;

  const removeWidget = async (name) => {
    const names = customWidgets.filter((w) => w !== name);
    await persistLayout(names);
    setMenuOpenFor(null);
  };

  const headerWithMenu = (title, widgetName, extraQuery='') => (
    <div className="flex justify-between items-center mb-4 relative">
      <h3 className="text-lg font-semibold">{title}</h3>
      <button className="text-gray-400 hover:text-purple-600" onClick={(e)=>{e.stopPropagation(); setMenuOpenFor(menuOpenFor===widgetName? null : widgetName);}}>⚙️</button>
      {menuOpenFor===widgetName && (
        <div className="absolute right-0 top-8 z-20 w-44 bg-white border rounded-lg shadow">
          <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={()=>{ setMenuOpenFor(null); navigate(`/analytics?${`tab=${encodeURIComponent(WIDGET_TAB[widgetName]||'deals')}&open=${encodeURIComponent(widgetName)}${extraQuery?`&${extraQuery}`:''}`}`); }}>View details</button>
          <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={()=>{ setMenuOpenFor(null); navigate(`/analytics?${`tab=${encodeURIComponent(WIDGET_TAB[widgetName]||'deals')}&open=${encodeURIComponent(widgetName)}&edit=1${extraQuery?`&${extraQuery}`:''}`}`); }}>Edit</button>
          <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100" onClick={()=> removeWidget(widgetName)}>Remove from dashboard</button>
          </div>
        )}
            </div>
  );

  const renderCustom = () => (
    <>
      {customWidgets.includes('Reply Rate Chart') && (
        <div className="bg-white dark:bg-gray-900/60 dark:border dark:border-white/10 rounded-2xl shadow-md dark:shadow-none p-6 relative">
          {headerWithMenu('Reply Rate Chart','Reply Rate Chart')}
          <div className="h-40"><canvas id="dash-reply-rate"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"><option>By Template</option></select>
            <button className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm">Export</button>
              </div>
            </div>
      )}
      {customWidgets.includes('Open Rate Widget') && (
        <div className="bg-white dark:bg-gray-900/60 dark:border dark:border-white/10 rounded-2xl shadow-md dark:shadow-none p-6 relative">
          {headerWithMenu('Open Rate','Open Rate Widget', `provider=${encodeURIComponent(openProvider)}&time_range=${encodeURIComponent(openRange)}`)}
          <div className="text-4xl font-bold text-purple-700 dark:text-purple-300">{(openRateDisplay ?? (metrics?.sent ? Math.round((metrics.opens/Math.max(1,metrics.sent))*1000)/10 : 0)).toString()}%</div>
          <div className="text-green-600 text-sm mt-1">↑ +2.3% vs last week</div>
          <div className="h-24 mt-3"><canvas id="dash-open-rate"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" value={openProvider} onChange={(e)=>setOpenProvider(e.target.value)}>
              <option value="all">All Providers</option>
              <option value="google">Google</option>
              <option value="outlook">Outlook</option>
              <option value="sendgrid">SendGrid</option>
            </select>
            <select className="border rounded-md p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700" value={openRange} onChange={(e)=>setOpenRange(e.target.value)}>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
            </select>
          </div>
            </div>
      )}
      {customWidgets.includes('Engagement Breakdown') && (
        <div className="bg-white dark:bg-gray-900/60 dark:border dark:border-white/10 rounded-2xl shadow-md dark:shadow-none p-6 relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Engagement Breakdown</h3>
            <div className="flex items-center gap-2">
              <select value={engageCampaignId} onChange={(e)=>setEngageCampaignId(e.target.value)} className="border rounded-md p-2 text-sm dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
                <option value="">All Campaigns</option>
                {Array.isArray(campaigns) && campaigns.map((c)=> (
                  <option key={c.id} value={c.id}>{c.name || c.title}</option>
                ))}
              </select>
              <button className="text-gray-400 hover:text-gray-600" onClick={(e)=>{e.stopPropagation(); setMenuOpenFor(menuOpenFor==='Engagement Breakdown'? null : 'Engagement Breakdown');}}>⚙️</button>
              {menuOpenFor==='Engagement Breakdown' && (
                <div className="absolute right-0 top-10 z-20 w-64 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow">
                  <button className="w-full text-left px=3 py=2 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={()=>{ const extra = (engageCampaignId && engageCampaignId!=='all') ? `&campaign_id=${encodeURIComponent(engageCampaignId)}` : ''; setMenuOpenFor(null); navigate(`/analytics?tab=${encodeURIComponent(WIDGET_TAB['Engagement Breakdown'])}&open=${encodeURIComponent('Engagement Breakdown')}${extra}`); }}>View details</button>
                  <button className="w-full text-left px=3 py=2 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={()=>{ const extra = (engageCampaignId && engageCampaignId!=='all') ? `&campaign_id=${encodeURIComponent(engageCampaignId)}` : ''; setMenuOpenFor(null); navigate(`/analytics?tab=${encodeURIComponent(WIDGET_TAB['Engagement Breakdown'])}&open=${encodeURIComponent('Engagement Breakdown')}&edit=1${extra}`); }}>Edit</button>
                  <button className="w-full text-left px=3 py=2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700" onClick={()=>{ removeWidget('Engagement Breakdown'); }}>Remove from dashboard</button>
                </div>
              )}
            </div>
            </div>
          <div className="space-y-2 text-sm">
                          {(() => {
              const pct = (k) => {
                const row = (engagement || []).find((d) => String(d.metric) === k);
                const v = Number(row && row.pct) || 0;
                return `${Math.round(v * 10) / 10}%`;
              };
              return (
                <>
                  <div className="flex items-center justify-between"><span className="text-indigo-700">Opens</span><span className="font-semibold">{pct('open')}</span></div>
                  <div className="flex items-center justify_between"><span className="text-green-700">Replies</span><span className="font-semibold">{pct('reply')}</span></div>
                  <div className="flex items-center justify_between"><span className="text-amber-700">Bounces</span><span className="font-semibold">{pct('bounce')}</span></div>
                  <div className="flex items-center justify_between"><span className="text-purple-700">Clicks</span><span className="font-semibold">{pct('click')}</span></div>
                </>
              );
                          })()}
          </div>
                  </div>
      )}
      {customWidgets.includes('Deal Pipeline') && (
        <div className="bg-white dark:bg-gray-900/60 dark:border dark:border-white/10 rounded-2xl shadow-md dark:shadow-none p-6 relative">
          {headerWithMenu('Deal Pipeline','Deal Pipeline')}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 border dark:border-violet-900/50">
              <div className="text-gray-600 dark:text-gray-300">Pipeline</div>
              <div className="text-lg font-semibold">${Number(dealPipeline?.pipelineValue||0).toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{Number(dealPipeline?.pipelineDeals||0)} deals</div>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border dark:border-purple-900/50">
              <div className="text-gray-600 dark:text-gray-300">Best Case</div>
              <div className="text-lg font-semibold">${Number(dealPipeline?.bestCaseValue||0).toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{Number(dealPipeline?.bestCaseDeals||0)} deals</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border dark:border-amber-900/40">
              <div className="text-gray-600 dark:text-gray-300">Commit</div>
              <div className="text-lg font-semibold">${Number(dealPipeline?.commitValue||0).toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{Number(dealPipeline?.commitDeals||0)} deals</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border dark:border-emerald-900/40">
              <div className="text-gray-600 dark:text-gray-300">Close Won</div>
              <div className="text-lg font-semibold">${Number(dealPipeline?.closedWonValue||0).toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{Number(dealPipeline?.closedWonDeals||0)} deals</div>
            </div>
          </div>
        </div>
      )}
      {customWidgets.includes('Revenue Forecast') && (
        <div className="bg-white dark:bg-gray-900/60 dark:border dark:border-white/10 rounded-2xl shadow-md dark:shadow-none p-6 relative">
          {headerWithMenu('Revenue Forecast','Revenue Forecast')}
          <div className="h-56"><canvas id="dash-revenue"></canvas></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <select className="border rounded-md p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"><option>All Clients</option></select>
            <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300"><label className="flex items-center gap-2 text-sm"><input type="radio" defaultChecked /> Quarter</label><label className="flex items-center gap-2 text-sm"><input type="radio" /> Year</label></div>
              </div>
                  </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f17]" onClick={()=> setMenuOpenFor(null)}>
      {/* Main Content */}
      <main className="bg-gray-50 dark:bg-transparent py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <button onClick={() => navigate('/analytics')} className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">Customize Dashboard</button>
            </div>
        </div>
        {isFree && (
          <div className="max-w-7xl mx-auto px-6 mb-4">
            <div className="px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
              You are on the Free plan. Upgrade anytime from Billing to unlock premium features and higher limits.
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-6">
          <div id="widgets-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderCustom()}
          </div>
        </div>
      </main>
    </div>
  );
}
