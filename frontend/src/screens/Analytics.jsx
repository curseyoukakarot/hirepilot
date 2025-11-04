import React, { useEffect, useMemo, useState } from 'react';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('deals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Widget Details');

  const widgetData = useMemo(() => ({
    deals: [
      { name: 'Revenue Forecast', icon: 'fa-chart-line', color: 'purple' },
      { name: 'Deal Pipeline', icon: 'fa-funnel-dollar', color: 'blue' },
      { name: 'Win Rate KPI', icon: 'fa-trophy', color: 'green' },
      { name: 'Engagement Breakdown', icon: 'fa-chart-pie', color: 'orange' }
    ],
    jobs: [
      { name: 'Hiring Funnel', icon: 'fa-filter', color: 'blue' },
      { name: 'Candidate Flow Viz', icon: 'fa-users', color: 'green' },
      { name: 'Pipeline Velocity', icon: 'fa-tachometer-alt', color: 'purple' },
      { name: 'Team Performance', icon: 'fa-chart-bar', color: 'orange' }
    ],
    outreach: [
      { name: 'Reply Rate Chart', icon: 'fa-reply', color: 'green' },
      { name: 'Open Rate Widget', icon: 'fa-envelope-open', color: 'blue' },
      { name: 'Conversion Trends', icon: 'fa-chart-area', color: 'indigo' },
      { name: 'Activity Overview', icon: 'fa-chart-bar', color: 'teal' }
    ],
    rex: [
      { name: 'Hires by Source', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Q4 Revenue Projection', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Candidate Quality Score', icon: 'fa-robot', color: 'purple', ai: true },
      { name: 'Outreach Optimization', icon: 'fa-robot', color: 'purple', ai: true }
    ]
  }), []);

  const widgets = useMemo(() => widgetData[activeTab] || widgetData.deals, [activeTab, widgetData]);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const openModal = (title) => {
    setModalTitle(title);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        <header id="header" className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Widgets</h1>
              <p className="text-gray-600 mt-1">Browse and add insights to your dashboard</p>
              <p className="text-purple-600 text-sm mt-2 font-medium">Unlock insights with widgets—customize or let REX build for you!</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input type="text" placeholder="Search widgets..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                <i className="fa-solid fa-search absolute left-3 top-3 text-gray-400"></i>
              </div>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                <i className="fa-solid fa-plus mr-2"></i>Create Custom
              </button>
            </div>
          </div>
        </header>

        <div id="content-area" className="flex-1 overflow-y-auto p-6">
          <div id="tabs-container" className="mb-8">
            <nav className="flex space-x-8 border-b border-gray-200">
              <button
                className={`tab-btn pb-4 px-1 font-medium text-sm ${activeTab === 'deals' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('deals')}
                data-tab="deals"
              >
                <i className="fa-solid fa-dollar-sign mr-2"></i>Deals
              </button>
              <button
                className={`tab-btn pb-4 px-1 font-medium text-sm ${activeTab === 'jobs' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('jobs')}
                data-tab="jobs"
              >
                <i className="fa-solid fa-briefcase mr-2"></i>Jobs
              </button>
              <button
                className={`tab-btn pb-4 px-1 font-medium text-sm ${activeTab === 'outreach' ? 'tab-active' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('outreach')}
                data-tab="outreach"
              >
                <i className="fa-solid fa-paper-plane mr-2"></i>Outreach
              </button>
              <button
                className={`tab-btn pb-4 px-1 font-medium text-sm ${activeTab === 'rex' ? 'tab-active text-purple-600' : 'text-purple-600 hover:text-purple-700'}`}
                onClick={() => setActiveTab('rex')}
                data-tab="rex"
              >
                <i className="fa-solid fa-robot mr-2"></i>REX Templates
              </button>
            </nav>
          </div>

          <div id="widgets-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map((widget) => (
              <div key={widget.name} className="widget-card bg-white rounded-lg shadow-md p-6 cursor-pointer" data-widget={widget.name}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-900">{widget.name}</h3>
                  <button className="text-gray-400 hover:text-gray-600 hover:rotate-90 transition-transform">
                    <i className="fa-solid fa-cog"></i>
                  </button>
                </div>
                <div className={`h-32 bg-gradient-to-r from-${widget.color}-100 to-${widget.color}-200 rounded-lg mb-4 flex items-center justify-center`}>
                  <i className={`fa-solid ${widget.icon} text-4xl text-${widget.color}-600`}></i>
                </div>
                <div className="flex space-x-2">
                  <button className="flex-1 bg-purple-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-purple-700 transition-colors">
                    <i className="fa-solid fa-plus mr-1"></i>Add to Dashboard
                  </button>
                  <button
                    className="px-3 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm hover:bg-purple-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); openModal(widget.name); }}
                  >
                    <i className="fa-solid fa-expand mr-1"></i>View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <button id="help-button" className="fixed bottom-6 right-6 bg-purple-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center z-50">
        <i className="fa-solid fa-question text-xl"></i>
      </button>

      {isModalOpen && (
        <div id="modal-overlay" className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur modal z-40" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div id="widget-modal" className={`bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ${isModalOpen ? 'scale-100' : 'scale-0'}` }>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 id="modal-title" className="text-2xl font-bold text-purple-900">{modalTitle}</h2>
                  <button id="close-modal" className="text-gray-400 hover:text-gray-600" onClick={() => setIsModalOpen(false)}>
                    <i className="fa-solid fa-times text-xl"></i>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex space-x-4 mb-4">
                    <select className="border border-purple-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      <option>All Clients</option>
                      <option>Client A</option>
                      <option>Client B</option>
                    </select>
                    <select className="border border-purple-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                      <option>Last 30 Days</option>
                      <option>Last Quarter</option>
                      <option>Last Year</option>
                    </select>
                  </div>
                </div>
                <div className="h-64 bg-gradient-to-r from-purple-100 to-purple-200 rounded-lg mb-6 flex items-center justify-center">
                  <div className="text-center">
                    <i className="fa-solid fa-chart-line text-6xl text-purple-600 mb-4"></i>
                    <p className="text-gray-600">Interactive chart would appear here</p>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
                    <i className="fa-solid fa-plus mr-2"></i>Add to Dashboard
                  </button>
                  <button className="border border-purple-300 text-purple-600 px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors">
                    <i className="fa-solid fa-external-link-alt mr-2"></i>Open in Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}