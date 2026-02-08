import React from 'react';

const activeCampaigns = [
  {
    title: 'Product Manager - SF Bay Area',
    started: 'Started 12 minutes ago',
    jobsExtracted: 47,
    jobsTotal: 100,
    signalsAnalyzed: 28,
    signalsTotal: 47,
    managersFound: 142,
    progress: 47,
    eta: 'Est. 18 min remaining',
    highlight: true,
  },
  {
    title: 'Software Engineer - Remote',
    started: 'Started 38 minutes ago',
    jobsExtracted: 89,
    jobsTotal: 200,
    signalsAnalyzed: 81,
    signalsTotal: 89,
    managersFound: 387,
    progress: 44,
    eta: 'Est. 52 min remaining',
    highlight: false,
  },
];

const completedCampaigns = [
  { title: 'Data Analyst - NYC', summary: '54 jobs • 271 managers found', time: '2 hours ago' },
  { title: 'UX Designer - Austin', summary: '73 jobs • 365 managers found', time: '5 hours ago' },
  { title: 'Marketing Manager - Seattle', summary: '91 jobs • 456 managers found', time: '1 day ago' },
];

const activityStats = [
  { label: 'Total Campaigns', value: '7', icon: 'fa-rocket', tone: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30', iconColor: 'text-blue-400' },
  { label: 'Jobs Analyzed', value: '623', icon: 'fa-briefcase', tone: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', iconColor: 'text-green-400' },
  { label: 'Managers Found', value: '3,117', icon: 'fa-users', tone: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', iconColor: 'text-purple-400' },
  { label: 'Avg. Success Rate', value: '87%', icon: 'fa-chart-line', tone: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30', iconColor: 'text-amber-400' },
];

const recentUpdates = [
  { title: 'High-priority match found', detail: 'VP of Product at TechCorp - 98% match', time: '2 min ago' },
  { title: 'Campaign completed', detail: 'Data Analyst - NYC finished successfully', time: '2 hours ago' },
  { title: 'New managers identified', detail: '47 hiring managers added to results', time: '3 hours ago' },
];

export default function JobSeekerLiveActivityDemo() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <section id="active-campaigns" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Active Campaigns</h3>
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 text-green-300 text-sm font-semibold rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>2 Running</span>
            </div>
          </div>

          <div className="space-y-4">
            {activeCampaigns.map((campaign) => (
              <div
                key={campaign.title}
                className={`p-6 border-2 rounded-xl cursor-pointer hover:shadow-xl transition-shadow ${
                  campaign.highlight
                    ? 'border-indigo-500 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 hover:shadow-indigo-500/20'
                    : 'border-slate-700 bg-slate-800/50 hover:shadow-slate-500/20'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-white mb-1">{campaign.title}</h4>
                    <p className="text-sm text-slate-400">{campaign.started}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center space-x-2 shadow-lg shadow-blue-500/50">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Running</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Jobs Extracted</p>
                    <p className="text-2xl font-bold text-white">
                      {campaign.jobsExtracted}
                      <span className="text-sm font-normal text-slate-500">/{campaign.jobsTotal}</span>
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Signals Analyzed</p>
                    <p className="text-2xl font-bold text-white">
                      {campaign.signalsAnalyzed}
                      <span className="text-sm font-normal text-slate-500">/{campaign.signalsTotal}</span>
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Managers Found</p>
                    <p className="text-2xl font-bold text-white">{campaign.managersFound}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Overall Progress</span>
                    <span className="font-semibold text-white">{campaign.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full shadow-lg shadow-indigo-500/50"
                      style={{ width: `${campaign.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <i className="fa-solid fa-clock text-blue-400"></i>
                    <span>{campaign.eta}</span>
                  </div>
                  <button className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 hover:text-white transition-colors">
                    <i className="fa-solid fa-eye mr-2"></i>View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="completed-campaigns" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-8 mt-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Completed Campaigns</h3>
            <button className="text-sm text-indigo-400 font-medium hover:text-indigo-300">View All</button>
          </div>

          <div className="space-y-3">
            {completedCampaigns.map((campaign) => (
              <div key={campaign.title} className="p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold text-white">{campaign.title}</span>
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs font-semibold rounded-full border border-green-500/30">Complete</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{campaign.summary}</span>
                  <span>{campaign.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="lg:col-span-1">
        <section id="activity-stats" className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Activity Stats</h3>
          <div className="space-y-4">
            {activityStats.map((stat) => (
              <div key={stat.label} className={`p-4 bg-gradient-to-br ${stat.tone} rounded-lg border ${stat.border}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
                  <i className={`fa-solid ${stat.icon} ${stat.iconColor}`}></i>
                </div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="notifications-panel" className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-2xl shadow-purple-500/30 p-6 text-white">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-bell text-xl"></i>
            </div>
            <h3 className="text-lg font-bold">Recent Updates</h3>
          </div>
          <div className="space-y-3 text-sm">
            {recentUpdates.map((update) => (
              <div key={update.title} className="p-3 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
                <p className="font-semibold mb-1">{update.title}</p>
                <p className="text-xs text-indigo-200">{update.detail}</p>
                <p className="text-xs text-indigo-300 mt-1">{update.time}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
