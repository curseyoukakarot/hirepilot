import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const detectTheme = () => {
  if (typeof document !== 'undefined') {
    const doc = document.documentElement;
    if (doc?.classList?.contains('dark') || document.body?.classList?.contains('dark')) {
      return 'dark';
    }
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

function IFrameEmbed({ html }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState('100vh');

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleResize = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const newHeight = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          doc.body?.offsetHeight || 0,
          doc.documentElement?.offsetHeight || 0,
          window.innerHeight
        );
        setHeight(`${newHeight}px`);
      } catch {}
    };

    const onLoad = () => {
      handleResize();
      try {
        const win = iframe.contentWindow;
        if (!win) return;
        win.addEventListener('resize', handleResize);
      } catch {}
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      try {
        const win = iframe.contentWindow;
        if (win) win.removeEventListener('resize', handleResize);
      } catch {}
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="DFY Dashboard"
      srcDoc={html}
      style={{ width: '100%', height, border: '0' }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
}

export default function DfyDashboard({ embedded = false, jobId = null }) {
  const [theme, setTheme] = useState(() => detectTheme());
  const [metrics, setMetrics] = useState({
    totalCandidates: 0,
    hiresCount: 0,
    interviewsCount: 0,
    outreachSent: 0,
    repliesCount: 0,
    replyRate: 0,
    weeks: [],
    outreachByWeek: [],
    repliesByWeek: [],
    interviewsByWeek: [0,0,0,0],
    hiresByWeek: [0,0,0,0],
    loading: true,
  });
  const [recentCandidates, setRecentCandidates] = useState([]);
  const [jobCampaigns, setJobCampaigns] = useState([]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        let totalCandidates = 0, hiresCount = 0, interviewsCount = 0;
        let outreachSent = 0, repliesCount = 0, replyRate = 0;
        let weeks = [], outreachByWeek = [], repliesByWeek = [];
        let interviewsByWeek = [0,0,0,0], hiresByWeek = [0,0,0,0];

        if (jobId) {
          try {
            const pipResp = await fetch(`${base}/api/pipelines?jobId=${jobId}`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
            if (pipResp.ok) {
              const pipelines = await pipResp.json();
              const active = Array.isArray(pipelines) && pipelines.length ? pipelines[0] : null;
              if (active?.id) {
                const stResp = await fetch(`${base}/api/pipelines/${active.id}/stages?jobId=${jobId}`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
                if (stResp.ok) {
                  const js = await stResp.json();
                  const stages = js?.stages || [];
                  const grouped = js?.candidates || {};
                  totalCandidates = Object.values(grouped).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
                  const hiredIds = stages
                    .filter(s => /hire|offer\s*accepted/i.test(String(s.title || '')))
                    .map(s => String(s.id));
                  hiresCount = hiredIds.reduce((a,id) => a + ((grouped[id] || []).length), 0);
                  const interviewIds = stages.filter(s => /interview/i.test(String(s.title || ''))).map(s => String(s.id));
                  interviewsCount = interviewIds.reduce((a,id)=> a + ((grouped[id] || []).length), 0);

                  // Build recent candidates from pipeline grouped data
                  try {
                    const stageIdToTitle = Object.fromEntries((stages || []).map(s => [String(s.id), s.title || '']));
                    const flat = [];
                    Object.entries(grouped || {}).forEach(([sid, arr]) => {
                      (Array.isArray(arr) ? arr : []).forEach((c) => flat.push({ ...c, _stage: stageIdToTitle[String(sid)] || (c && c.status) || '' }));
                    });
                    const rec = flat
                      .sort((a,b) => new Date(b?.created_at || b?.updated_at || 0).getTime() - new Date(a?.created_at || a?.updated_at || 0).getTime())
                      .slice(0,3)
                      .map(c => ({
                        id: c.id,
                        first_name: c.first_name || c.name?.split(' ')?.[0] || '',
                        last_name: c.last_name || (c.name ? c.name.split(' ').slice(1).join(' ') : ''),
                        title: c.title || c.current_title || '',
                        avatar_url: c.avatar_url || '',
                        status: c._stage || c.status || 'sourced',
                        created_at: c.created_at || c.updated_at || null,
                      }));
                    if (rec.length) setRecentCandidates(rec);
                  } catch {}
                }
              }
            }
          } catch {}
        }

        let matchingCampaignId = null;
        try {
          const { data: camp } = await supabase.from('campaigns').select('id').eq('job_id', jobId).maybeSingle();
          matchingCampaignId = camp?.id || null;
        } catch (err) {}
        // Fallback: use most recent campaign for this user if none linked to job
        if (!matchingCampaignId && user?.id) {
          try {
            const resp = await fetch(`${base}/api/getCampaigns?user_id=${user.id}`);
            const body = await resp.json();
            const list = Array.isArray(body?.campaigns) ? body.campaigns : [];
            if (list.length > 0) matchingCampaignId = list[0].id;
          } catch {}
        }

        if ((matchingCampaignId || 'all') && user?.id) {
          try {
            const perfId = matchingCampaignId || 'all';
            const perfResp = await fetch(`${base}/api/campaigns/${perfId}/performance?user_id=${user.id}`);
            if (perfResp.ok) {
              const perf = await perfResp.json();
              outreachSent = Number(perf.sent || 0);
              repliesCount = Number(perf.replies || 0);
              replyRate = Number(perf.reply_rate || 0);
            }
          } catch {}
        }

        if (user?.id) {
          try {
            const cid = matchingCampaignId || 'all';
            const tsResp = await fetch(`${base}/api/analytics/time-series?user_id=${user.id}&campaign_id=${cid}&time_range=90d`);
            const ts = tsResp.ok ? await tsResp.json() : { data: [] };
            const weekly = (ts.data || []).slice(-4);
            weeks = weekly.map(w => w.period);
            outreachByWeek = weekly.map(w => Number(w.sent || 0));
            repliesByWeek = weekly.map(w => Number(w.replies || 0));
          } catch {}
        }

        // Fallback: compute totals/hires from candidate_jobs if pipeline API did not yield
        try {
          if (jobId && (totalCandidates === 0 || hiresCount === 0)) {
            const { data: allCj } = await supabase
              .from('candidate_jobs')
              .select('status, pipeline_stages ( title )')
              .eq('job_id', jobId);
            if (Array.isArray(allCj) && allCj.length > 0) {
              const altTotal = allCj.length;
              const altHires = allCj.filter(r => /hire|offer\s*accepted/i.test(String(r?.pipeline_stages?.title || r?.status || ''))).length;
              if (totalCandidates === 0) totalCandidates = altTotal;
              if (hiresCount === 0) hiresCount = altHires;
            }
          }
        } catch {}

        try {
          if (jobId) {
            const since = new Date(); since.setDate(since.getDate() - 90);
            const { data: acts } = await supabase
              .from('job_activity_log')
              .select('created_at, metadata')
              .eq('job_id', jobId)
              .gte('created_at', since.toISOString());
            const toBucket = (dstr) => {
              const d = new Date(dstr); const now = new Date();
              const weeksDiff = Math.floor((now.getTime() - d.getTime()) / (7*24*60*60*1000));
              const idx = 3 - weeksDiff; return (idx>=0 && idx<4) ? idx : null;
            };
            (acts || []).forEach(a => {
              const title = String(a?.metadata?.stage_title || '').toLowerCase();
              const b = toBucket(a.created_at);
              if (b == null) return;
              if (/hire/.test(title)) hiresByWeek[b] += 1;
              if (/interview/.test(title)) interviewsByWeek[b] += 1;
            });
          }
        } catch {}

        // Recent candidates (last 3 for this job) — linear flow without nested try/catch
        if (jobId && recentCandidates.length === 0) {
          let rc = [];
          // 1) Guest-friendly endpoint first
          try {
            const gf = await fetch(`${base}/api/pipelines/job/${jobId}/recent`, { credentials: 'include' });
            if (gf.ok) {
              const body = await gf.json();
              if (Array.isArray(body?.candidates)) rc = body.candidates;
            }
          } catch (e) {}

          // 2) Owner candidates table
          if (rc.length === 0 && user?.id) {
            try {
              const { data: rec } = await supabase
                .from('candidates')
                .select('id, first_name, last_name, title, avatar_url, status, created_at')
                .eq('user_id', user.id)
                .eq('job_id', jobId)
                .order('created_at', { ascending: false })
                .limit(3);
              if (Array.isArray(rec) && rec.length) rc = rec;
            } catch (e) {}
          }

          // 3) Fallback: derive from candidate_jobs join
          if (rc.length === 0) {
            try {
              const { data: cjs } = await supabase
                .from('candidate_jobs')
                .select('created_at, stage_id, status, candidates ( first_name, last_name, avatar_url, title ), pipeline_stages ( title )')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false })
                .limit(3);
              rc = (cjs || []).map(row => ({
                id: null,
                first_name: row?.candidates?.first_name || '',
                last_name: row?.candidates?.last_name || '',
                title: row?.candidates?.title || '',
                avatar_url: row?.candidates?.avatar_url || '',
                status: (row?.pipeline_stages?.title) || row?.status || 'sourced',
                created_at: row?.created_at || null,
              }));
            } catch (e) { rc = []; }
          }

          setRecentCandidates(rc);
        } else if (!jobId) {
          setRecentCandidates([]);
        }

        // Campaigns attached to the job (public first, then owner fallback)
        try {
          let summaries = [];
          if (jobId) {
            try {
              const pub = await fetch(`${base}/api/jobs/${jobId}/campaigns`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
              if (pub.ok) {
                const body = await pub.json();
                const list = Array.isArray(body?.campaigns) ? body.campaigns : [];
                summaries = list.slice(0, 3).map((c) => ({
                  id: c.id,
                  name: c.name || c.title || 'Campaign',
                  sent: Number(c.sent || c.outreach || 0),
                  replies: Number(c.replies || 0),
                  hires: Number(hH.reduce((a,b)=>a+b,0)) > 0 ? metrics.hiresByWeek.reduce((a,b)=>a+b,0) : hiresCount
                }));
              }
            } catch {}
          }
          // Owner fallback with richer performance
          if (summaries.length === 0 && user?.id) {
            try {
              const resp = await fetch(`${base}/api/getCampaigns?user_id=${user.id}`);
              const body = await resp.json();
              const list = Array.isArray(body?.campaigns) ? body.campaigns : [];
              const forJob = (list || []).filter(c => String(c.job_id || '') === String(jobId)).slice(0, 3);
              const det = [];
              for (const c of forJob) {
                try {
                  const pr = await fetch(`${base}/api/campaigns/${c.id}/performance?user_id=${user.id}`);
                  const pj = pr.ok ? await pr.json() : {};
                  det.push({ id: c.id, name: c.name || c.title || 'Campaign', sent: Number(pj.sent || 0), replies: Number(pj.replies || 0), hires: hiresCount });
                } catch { det.push({ id: c.id, name: c.name || c.title || 'Campaign', sent: 0, replies: 0, hires: 0 }); }
              }
              summaries = det;
            } catch {}
          }
          setJobCampaigns(summaries);
        } catch { setJobCampaigns([]); }

        setMetrics({ totalCandidates, hiresCount, interviewsCount, outreachSent, repliesCount, replyRate, weeks, outreachByWeek, repliesByWeek, interviewsByWeek, hiresByWeek, loading: false });
      } catch {
        setMetrics(m => ({ ...m, loading: false }));
      }
    };

    loadMetrics();

    // Realtime updates: refresh when candidates link/move stages for this job
    if (!jobId) return;
    const ch = supabase
      .channel(`dashboard-realtime-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_jobs', filter: `job_id=eq.${jobId}` }, () => {
        loadMetrics();
      })
      .subscribe();

    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [jobId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => setTheme(detectTheme());
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    let media;
    const mediaHandler = (event) => setTheme(event.matches ? 'dark' : 'light');
    if (window.matchMedia) {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      if (media.addEventListener) media.addEventListener('change', mediaHandler);
      else if (media.addListener) media.addListener(mediaHandler);
    }
    return () => {
      observer.disconnect();
      if (media) {
        if (media.removeEventListener) media.removeEventListener('change', mediaHandler);
        else if (media.removeListener) media.removeListener(mediaHandler);
      }
    };
  }, []);

  const successRate = metrics.totalCandidates > 0 ? Math.round((metrics.hiresCount / metrics.totalCandidates) * 1000) / 10 : 0;
  const fmt = (n) => (n || 0).toLocaleString();
  const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
  const repliesPctOfOutreach = metrics.outreachSent > 0 ? Math.max(3, Math.round((metrics.repliesCount / metrics.outreachSent) * 100)) : 0;
  const interviewsPctOfOutreach = metrics.outreachSent > 0 ? Math.max(3, Math.round((metrics.interviewsCount / metrics.outreachSent) * 100)) : 0;
  const hiresPctOfOutreach = metrics.outreachSent > 0 ? Math.max(3, Math.round((metrics.hiresCount / metrics.outreachSent) * 100)) : 0;
  const maxAct = Math.max(1, ...metrics.outreachByWeek, ...metrics.repliesByWeek, ...metrics.interviewsByWeek, ...metrics.hiresByWeek);
  const px = (v) => Math.round((v / maxAct) * 160);
  const oH = [0,1,2,3].map(i => px(metrics.outreachByWeek[i] || 0));
  const rH = [0,1,2,3].map(i => px(metrics.repliesByWeek[i] || 0));
  const iH = [0,1,2,3].map(i => px(metrics.interviewsByWeek[i] || 0));
  const hH = [0,1,2,3].map(i => px(metrics.hiresByWeek[i] || 0));
  const weekLabels = [0,1,2,3].map(i => metrics.weeks[i] || `Week ${i+1}`);

  const recentRows = (recentCandidates || []).map(c => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate';
    const title = c.title || '';
    const status = (c.status || '').toString();
    const badgeColor = /hire/i.test(status) ? 'emerald' : (/interview/i.test(status) ? 'blue' : 'gray');
    const avatar = c.avatar_url || 'https://ui-avatars.com/api/?background=random&name=' + encodeURIComponent(name || 'C');
    return `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <img src="${avatar}" alt="Candidate" class="w-10 h-10 rounded-full">
          <div>
            <p class="font-medium text-gray-900">${name}</p>
            <p class="text-sm text-gray-600">${title}</p>
          </div>
        </div>
        <span class="bg-${badgeColor}-100 text-${badgeColor}-800 text-xs px-2 py-1 rounded-full">${status || 'sourced'}</span>
      </div>`;
  }).join('') || `<div class="text-sm text-gray-500">No candidates yet.</div>`;

  const campaignsRows = (jobCampaigns || []).map((c, idx) => {
    const colors = ['blue','green','purple','orange'];
    const color = colors[idx % colors.length];
    return `
      <div class="border-l-4 border-${color}-500 pl-4">
        <h4 class="font-medium text-gray-900">${c.name}</h4>
        <div class="flex justify-between text-sm text-gray-600 mt-1">
          <span>Outreach: ${fmt(c.sent)}</span>
          <span>Replies: ${fmt(c.replies)}</span>
          <span>Hires: ${fmt(c.hires)}</span>
        </div>
      </div>`;
  }).join('') || `<div class="text-sm text-gray-500">No campaigns linked to this job.</div>`;

  const htmlThemeClass = theme === 'dark' ? ' class="dark"' : '';
  const bodyClass = embedded ? 'embedded' : '';
  const html = `<!DOCTYPE html>
<html${htmlThemeClass}><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/highcharts@11.2.0/highcharts.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highcharts@11.2.0/highcharts-more.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highcharts@11.2.0/modules/solid-gauge.js"></script>
    <script> window.FontAwesomeConfig = { autoReplaceSvg: 'nest'};</script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    
    <style>
        ::-webkit-scrollbar { display: none;}
        body { font-family: 'Inter', sans-serif; }
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    </style>
    <script>tailwind.config = {
  "theme": {
    "extend": {
      "fontFamily": {
        "sans": [
          "Inter",
          "sans-serif"
        ]
      }
    }
  }
};</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&amp;display=swap"><style>
  .highlighted-section {
    outline: 2px solid #3F20FB;
    background-color: rgba(63, 32, 251, 0.1);
  }

  .edit-button {
    position: absolute;
    z-index: 1000;
  }

  ::-webkit-scrollbar {
    display: none;
  }

  html, body {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  /* Embedded mode removes this page's chrome so the host app can provide it */
  .embedded #sidebar { display: none !important; }
  .embedded #header { display: none !important; }
  .embedded #main-content { margin-left: 0 !important; }

  body {
    background-color: #f8fafc;
    color: #0f172a;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  .dark body {
    background-color: #0b1120;
    color: #e2e8f0;
  }
  .dashboard-shell {
    min-height: 100vh;
    background: transparent;
  }
  .card-surface {
    background-color: #ffffff;
    border-color: #e2e8f0;
  }
  .dark .card-surface {
    background-color: rgba(15,23,42,0.92);
    border-color: #1e293b;
    color: #f8fafc;
  }
  .dark .text-gray-600 { color: #cbd5f5 !important; }
  .dark .text-gray-500 { color: #94a3b8 !important; }
  .dark .text-gray-400 { color: #94a3b8 !important; }
  .dark .text-gray-900 { color: #f8fafc !important; }
  .dark .bg-gray-50 { background-color: rgba(15,23,42,0.6) !important; }
  .dark .border-gray-200 { border-color: #1f2937 !important; }
  .dark .border { border-color: #1e293b !important; }
  </style></head>
<body class="${bodyClass}">

<div class="flex dashboard-shell">
    <aside id="sidebar" class="w-64 card-surface shadow-lg h-screen fixed left-0 top-0 z-10 border-r border-gray-200">
        <div class="p-6 border-b">
            <div class="flex items-center space-x-3">
                <img src="/logo.png" alt="HirePilot Logo" class="h-8 w-8" />
                <span class="text-xl font-bold text-gray-800">HirePilot</span>
            </div>
        </div>
        <nav class="mt-6">
            <span class="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100 cursor-pointer">
                <i class="fa-solid fa-chart-line mr-3"></i>
                Dashboard
            </span>
            <span class="flex items-center px-6 py-3 text-blue-600 bg-blue-50 cursor-pointer">
                <i class="fa-solid fa-trophy mr-3"></i>
                Your Results
            </span>
            <span class="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100 cursor-pointer">
                <i class="fa-solid fa-users mr-3"></i>
                Candidates
            </span>
            <span class="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100 cursor-pointer">
                <i class="fa-solid fa-briefcase mr-3"></i>
                Campaigns
            </span>
            <span class="flex items-center px-6 py-3 text-gray-600 hover:bg-gray-100 cursor-pointer">
                <i class="fa-solid fa-cog mr-3"></i>
                Settings
            </span>
        </nav>
    </aside>

    <main id="main-content" class="flex-1 ml-64">
        <header id="header" class="card-surface shadow-sm border-b px-8 py-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">Your Hiring Dashboard</h1>
                    <p class="text-gray-600 mt-1">Track results, success rates, and activity from your recruiting campaigns.</p>
                </div>
                <div class="flex items-center space-x-4">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Client Avatar" class="w-10 h-10 rounded-full">
                    <div class="text-right">
                        <p class="text-sm font-medium text-gray-900">TechCorp Inc.</p>
                        <p class="text-xs text-gray-500">Premium Client</p>
                    </div>
                </div>
            </div>
        </header>

        <section id="kpi-cards" class="px-8 py-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">Success Rate</p>
                            <p class="text-3xl font-bold text-green-600 mt-2">${successRate}%</p>
                            <div class="flex items-center mt-2">
                                <i class="fa-solid fa-arrow-up text-green-500 text-xs mr-1"></i>
                                <span class="text-xs text-green-600">+12% vs last month</span>
                            </div>
                        </div>
                        <div class="bg-green-100 p-3 rounded-full">
                            <i class="fa-solid fa-trophy text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">Total Hires Made</p>
                            <p class="text-3xl font-bold text-blue-600 mt-2">${fmt(metrics.hiresCount)}</p>
                            <div class="flex items-center mt-2">
                                <i class="fa-solid fa-star text-yellow-500 text-xs mr-1"></i>
                                <span class="text-xs text-gray-600">Great progress!</span>
                            </div>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fa-solid fa-briefcase text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">Reply Rate</p>
                            <p class="text-3xl font-bold text-purple-600 mt-2">${pct(metrics.replyRate)}</p>
                            <div class="flex items-center mt-2">
                                <i class="fa-solid fa-calendar text-purple-500 text-xs mr-1"></i>
                                <span class="text-xs text-gray-600">This quarter</span>
                            </div>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fa-solid fa-comments text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium text-gray-600">Outreach Sent</p>
                            <p class="text-3xl font-bold text-orange-600 mt-2">${fmt(metrics.outreachSent)}</p>
                            <div class="flex items-center mt-2">
                                <i class="fa-solid fa-paper-plane text-orange-500 text-xs mr-1"></i>
                                <span class="text-xs text-gray-600">Last 30 days</span>
                            </div>
                        </div>
                        <div class="bg-orange-100 p-3 rounded-full">
                            <i class="fa-solid fa-envelope text-orange-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section id="charts-section" class="px-8 py-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Pipeline Conversion Funnel</h3>
                    <div class="space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Outreach Sent</span>
                                <span class="text-sm font-semibold text-orange-600">${fmt(metrics.outreachSent)}</span>
                            </div>
                            <div class="h-4 rounded-full bg-orange-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style="width:100%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Replies Received</span>
                                <span class="text-sm font-semibold text-purple-600">${fmt(metrics.repliesCount)}</span>
                            </div>
                            <div class="h-4 rounded-full bg-purple-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style="width:${repliesPctOfOutreach}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Interviews</span>
                                <span class="text-sm font-semibold text-blue-600">${fmt(metrics.interviewsCount)}</span>
                            </div>
                            <div class="h-4 rounded-full bg-blue-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style="width:${interviewsPctOfOutreach}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Hires</span>
                                <span class="text-sm font-semibold text-emerald-600">${fmt(metrics.hiresCount)}</span>
                            </div>
                            <div class="h-4 rounded-full bg-emerald-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style="width:${hiresPctOfOutreach}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 text-xs text-gray-500">Funnel shows relative conversion at each stage.</div>
                </div>

                <div class="card-surface rounded-xl shadow-sm p-6 border">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
                    <div class="mb-3 flex items-center gap-4 text-xs">
                        <span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-orange-500"></span>Outreach</span>
                        <span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-purple-500"></span>Replies</span>
                        <span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-500"></span>Interviews</span>
                        <span class="inline-flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-emerald-500"></span>Hires</span>
                    </div>
                    <div class="h-64 flex items-end gap-8">
                        ${[0,1,2,3].map(i => `
                        <div class=\"flex items-end gap-2\" title=\"${weekLabels[i]}\"> 
                          <div class=\"w-4 bg-orange-500 rounded-t\" style=\"height:${oH[i]}px\" title=\"Outreach ${fmt(metrics.outreachByWeek[i]||0)}\"></div>
                          <div class=\"w-4 bg-purple-500 rounded-t\" style=\"height:${rH[i]}px\" title=\"Replies ${fmt(metrics.repliesByWeek[i]||0)}\"></div>
                          <div class=\"w-4 bg-blue-500 rounded-t\" style=\"height:${iH[i]}px\" title=\"Interviews ${fmt(metrics.interviewsByWeek[i]||0)}\"></div>
                          <div class=\"w-4 bg-emerald-500 rounded-t\" style=\"height:${hH[i]}px\" title=\"Hires ${fmt(metrics.hiresByWeek[i]||0)}\"></div>
                        </div>`).join('')}
                    </div>
                    <div class="mt-3 grid grid-cols-4 text-center text-xs text-gray-500">
                        ${weekLabels.map(l => `<div>${l}</div>`).join('')}
                    </div>
                </div>
            </div>
        </section>

        <section id="tables-section" class="px-8 py-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div id="recent-successes" class="card-surface rounded-xl shadow-sm border">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-semibold text-gray-900">Recent Candidates</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">${recentRows}</div>
                    </div>
                </div>

                <div id="open-campaigns" class="card-surface rounded-xl shadow-sm border">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-semibold text-gray-900">Active Campaigns</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">${campaignsRows}</div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</div>

<script>
// Guard: Highcharts may not be available in sandboxed iframes
try {
  if (window.Highcharts && document.getElementById('funnel-chart')) {
    window.Highcharts.chart('funnel-chart', {
      chart: { type: 'pie' }, credits: { enabled: false }, title: { text: '' },
      plotOptions: { pie: { innerSize: '60%', dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.1f}%'} } },
      series: [{ name: 'Pipeline', data: [
        { name: 'Outreach Sent', y: ${metrics.outreachSent}, color: '#f97316' },
        { name: 'Replies Received', y: ${metrics.repliesCount}, color: '#8b5cf6' },
        { name: 'Interviews', y: ${metrics.interviewsCount}, color: '#3b82f6' },
        { name: 'Hires', y: ${metrics.hiresCount}, color: '#10b981' }
      ] }]
    });
  }
} catch {}
</script>


</body></html>`;

  return (
    <div className="bg-white">
      <IFrameEmbed html={html} />
    </div>
  );
}


