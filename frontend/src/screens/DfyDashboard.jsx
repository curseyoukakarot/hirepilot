import React, { useEffect, useRef, useState } from 'react';

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

export default function DfyDashboard({ embedded = false }) {
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
                            <p class="text-3xl font-bold text-green-600 mt-2">87%</p>
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
                            <p class="text-3xl font-bold text-blue-600 mt-2">24</p>
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
                            <p class="text-sm font-medium text-gray-600">Interviews Booked</p>
                            <p class="text-3xl font-bold text-purple-600 mt-2">142</p>
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
                            <p class="text-3xl font-bold text-orange-600 mt-2">1,847</p>
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
                                <span class="text-sm font-semibold text-orange-600">1,847</span>
                            </div>
                            <div class="h-4 rounded-full bg-orange-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style="width:100%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Replies Received</span>
                                <span class="text-sm font-semibold text-purple-600">234</span>
                            </div>
                            <div class="h-4 rounded-full bg-purple-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style="width:13%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Interviews</span>
                                <span class="text-sm font-semibold text-blue-600">142</span>
                            </div>
                            <div class="h-4 rounded-full bg-blue-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style="width:8%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-600">Hires</span>
                                <span class="text-sm font-semibold text-emerald-600">24</span>
                            </div>
                            <div class="h-4 rounded-full bg-emerald-100">
                                <div class="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style="width:4%"></div>
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
                        <!-- Week 1 -->
                        <div class="flex items-end gap-2">
                            <div class="w-4 bg-orange-500 rounded-t" style="height:138px" title="Outreach 450"></div>
                            <div class="w-4 bg-purple-500 rounded-t" style="height:20px" title="Replies 65"></div>
                            <div class="w-4 bg-blue-500 rounded-t" style="height:13px" title="Interviews 42"></div>
                            <div class="w-4 bg-emerald-500 rounded-t" style="height:5px" title="Hires 8"></div>
                        </div>
                        <!-- Week 2 -->
                        <div class="flex items-end gap-2">
                            <div class="w-4 bg-orange-500 rounded-t" style="height:160px" title="Outreach 520"></div>
                            <div class="w-4 bg-purple-500 rounded-t" style="height:22px" title="Replies 72"></div>
                            <div class="w-4 bg-blue-500 rounded-t" style="height:12px" title="Interviews 38"></div>
                            <div class="w-4 bg-emerald-500 rounded-t" style="height:4px" title="Hires 7"></div>
                        </div>
                        <!-- Week 3 -->
                        <div class="flex items-end gap-2">
                            <div class="w-4 bg-orange-500 rounded-t" style="height:148px" title="Outreach 480"></div>
                            <div class="w-4 bg-purple-500 rounded-t" style="height:18px" title="Replies 58"></div>
                            <div class="w-4 bg-blue-500 rounded-t" style="height:11px" title="Interviews 35"></div>
                            <div class="w-4 bg-emerald-500 rounded-t" style="height:4px" title="Hires 6"></div>
                        </div>
                        <!-- Week 4 -->
                        <div class="flex items-end gap-2">
                            <div class="w-4 bg-orange-500 rounded-t" style="height:122px" title="Outreach 397"></div>
                            <div class="w-4 bg-purple-500 rounded-t" style="height:14px" title="Replies 39"></div>
                            <div class="w-4 bg-blue-500 rounded-t" style="height:9px" title="Interviews 27"></div>
                            <div class="w-4 bg-emerald-500 rounded-t" style="height:3px" title="Hires 3"></div>
                        </div>
                    </div>
                    <div class="mt-3 grid grid-cols-4 text-center text-xs text-gray-500">
                        <div>Week 1</div>
                        <div>Week 2</div>
                        <div>Week 3</div>
                        <div>Week 4</div>
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
            { name: 'Outreach Sent', y: 1847, color: '#f97316' },
            { name: 'Replies Received', y: 234, color: '#8b5cf6' },
            { name: 'Interviews', y: 142, color: '#3b82f6' },
            { name: 'Hires', y: 24, color: '#10b981' }
        ]
    }]
});

Highcharts.chart('activity-chart', {
    chart: { type: 'column' },
    credits: { enabled: false },
    title: { text: '' },
    xAxis: {
        categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4']
    },
    yAxis: { title: { text: 'Count' } },
    series: [{
        name: 'Outreach',
        data: [450, 520, 480, 397],
        color: '#f97316'
    }, {
        name: 'Replies',
        data: [65, 72, 58, 39],
        color: '#8b5cf6'
    }, {
        name: 'Interviews',
        data: [42, 38, 35, 27],
        color: '#3b82f6'
    }, {
        name: 'Hires',
        data: [8, 7, 6, 3],
        color: '#10b981'
    }]
});
</script>


</body></html>`;

  return (
    <div className="bg-white">
      <IFrameEmbed html={html} />
    </div>
  );
}


