import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    (async () => {
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
                  const hiredIds = stages.filter(s => /hire/i.test(String(s.title || ''))).map(s => String(s.id));
                  hiresCount = hiredIds.reduce((a,id) => a + ((grouped[id] || []).length), 0);
                  const interviewIds = stages.filter(s => /interview/i.test(String(s.title || ''))).map(s => String(s.id));
                  interviewsCount = interviewIds.reduce((a,id)=> a + ((grouped[id] || []).length), 0);
                }
              }
            }
          } catch {}
        }

        let matchingCampaignId = null;
        try {
          const { data: camp } = await supabase.from('campaigns').select('id').eq('job_id', jobId).maybeSingle();
          matchingCampaignId = camp?.id || null;
        } catch {}

        if (matchingCampaignId && user?.id) {
          try {
            const perfResp = await fetch(`${base}/api/campaigns/${matchingCampaignId}/performance?user_id=${user.id}`);
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

        setMetrics({ totalCandidates, hiresCount, interviewsCount, outreachSent, repliesCount, replyRate, weeks, outreachByWeek, repliesByWeek, interviewsByWeek, hiresByWeek, loading: false });
      } catch {
        setMetrics(m => ({ ...m, loading: false }));
      }
    })();
  }, [jobId]);

  const successRate = metrics.totalCandidates > 0 ? Math.round((metrics.hiresCount / metrics.totalCandidates) * 100) : 0;
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

  const html = `<!DOCTYPE html>
<html><head>
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
  </style></head>
<body class="bg-gray-50${embedded ? ' embedded' : ''}">

<div class="flex">
    <aside id="sidebar" class="w-64 bg-white shadow-lg h-screen fixed left-0 top-0 z-10">
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
        <header id="header" class="bg-white shadow-sm border-b px-8 py-6">
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
                <div class="bg-white rounded-xl shadow-sm p-6 border">
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

                <div class="bg-white rounded-xl shadow-sm p-6 border">
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

                <div class="bg-white rounded-xl shadow-sm p-6 border">
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

                <div class="bg-white rounded-xl shadow-sm p-6 border">
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
                <div class="bg-white rounded-xl shadow-sm p-6 border">
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

                <div class="bg-white rounded-xl shadow-sm p-6 border">
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
                <div id="recent-successes" class="bg-white rounded-xl shadow-sm border">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-semibold text-gray-900">Recent Successes</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Candidate" class="w-10 h-10 rounded-full">
                                    <div>
                                        <p class="font-medium text-gray-900">Alex Johnson</p>
                                        <p class="text-sm text-gray-600">Senior Engineer</p>
                                    </div>
                                </div>
                                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Hired</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="Candidate" class="w-10 h-10 rounded-full">
                                    <div>
                                        <p class="font-medium text-gray-900">Sarah Chen</p>
                                        <p class="text-sm text-gray-600">Product Manager</p>
                                    </div>
                                </div>
                                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Interview</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center space-x-3">
                                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg" alt="Candidate" class="w-10 h-10 rounded-full">
                                    <div>
                                        <p class="font-medium text-gray-900">Mike Rodriguez</p>
                                        <p class="text-sm text-gray-600">DevOps Engineer</p>
                                    </div>
                                </div>
                                <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Hired</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="open-campaigns" class="bg-white rounded-xl shadow-sm border">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-semibold text-gray-900">Active Campaigns</h3>
                    </div>
                    <div class="p-6">
                        <div class="space-y-4">
                            <div class="border-l-4 border-blue-500 pl-4">
                                <h4 class="font-medium text-gray-900">Full-Stack Engineers</h4>
                                <div class="flex justify-between text-sm text-gray-600 mt-1">
                                    <span>Outreach: 324</span>
                                    <span>Replies: 47</span>
                                    <span>Hires: 8</span>
                                </div>
                            </div>
                            <div class="border-l-4 border-green-500 pl-4">
                                <h4 class="font-medium text-gray-900">Product Managers</h4>
                                <div class="flex justify-between text-sm text-gray-600 mt-1">
                                    <span>Outreach: 156</span>
                                    <span>Replies: 23</span>
                                    <span>Hires: 4</span>
                                </div>
                            </div>
                            <div class="border-l-4 border-purple-500 pl-4">
                                <h4 class="font-medium text-gray-900">Sales Representatives</h4>
                                <div class="flex justify-between text-sm text-gray-600 mt-1">
                                    <span>Outreach: 289</span>
                                    <span>Replies: 38</span>
                                    <span>Hires: 6</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</div>

<script>
Highcharts.chart('funnel-chart', {
    chart: { type: 'pie' },
    credits: { enabled: false },
    title: { text: '' },
    plotOptions: {
        pie: {
            innerSize: '60%',
            dataLabels: {
                enabled: true,
                format: '{point.name}: {point.percentage:.1f}%'
            }
        }
    },
    series: [{
        name: 'Pipeline',
        data: [
            { name: 'Outreach Sent', y: ${metrics.outreachSent}, color: '#f97316' },
            { name: 'Replies Received', y: ${metrics.repliesCount}, color: '#8b5cf6' },
            { name: 'Interviews', y: ${metrics.interviewsCount}, color: '#3b82f6' },
            { name: 'Hires', y: ${metrics.hiresCount}, color: '#10b981' }
        ]
    }]
});

// Optional: activity-chart was replaced by simple bars above. Keep Highcharts disabled or wire similarly if desired.
</script>


</body></html>`;

  return (
    <div className="bg-white">
      <IFrameEmbed html={html} />
    </div>
  );
}


