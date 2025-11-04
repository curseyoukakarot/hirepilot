import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('deals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Widget Details');
  const [modalType, setModalType] = useState('deals'); // 'deals' | 'jobs' | 'outreach'
  const [showExportMenu, setShowExportMenu] = useState(false);
  const chartRef = useRef(null);

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
    // Map current tab to modal variant from provided source code
    const type = activeTab === 'deals' ? 'deals' : activeTab === 'jobs' ? 'jobs' : activeTab === 'outreach' ? 'outreach' : 'deals';
    setModalType(type);
    setIsModalOpen(true);
    setShowExportMenu(false);
  };

  // Initialize/destroy chart when outreach modal opens/closes (exact dataset from source)
  useEffect(() => {
    if (isModalOpen && modalType === 'outreach') {
      const ctx = document.getElementById('replyChart');
      if (ctx) {
        if (chartRef.current) chartRef.current.destroy();
        chartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [
              {
                label: 'Reply Rate %',
                data: [40, 60, 50, 70],
                borderColor: '#6B46C1',
                backgroundColor: 'rgba(107, 70, 193, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6B46C1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                grid: { color: '#f3f4f6' },
              },
              x: { grid: { color: '#f3f4f6' } },
            },
            interaction: { intersect: false, mode: 'index' },
          },
        });
      }
    }
    return () => {
      if (!isModalOpen && chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [isModalOpen, modalType]);

  const renderDealsVariant = () => (
    <div id="deals-modal" className="modal-variant">
      <div id="deals-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Deal Pipeline</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div id="deals-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-32">
            <option>All Owners</option>
            <option>Sarah Johnson</option>
            <option>Mike Chen</option>
            <option>Lisa Rodriguez</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Sort by:</label>
            <label className="flex items-center gap-1">
              <input type="radio" name="sort" value="value" defaultChecked className="text-purple-600" />
              <span className="text-sm">Value</span>
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="sort" value="date" className="text-purple-600" />
              <span className="text-sm">Date</span>
            </label>
          </div>
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="deals-body" className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Pipeline</h3>
                <div className="text-3xl font-bold text-blue-900 mt-2">$45K</div>
                <div className="text-blue-700 text-sm">12 deals</div>
              </div>
              <i className="fas fa-funnel text-blue-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-blue-800">Top deal: Enterprise Exec $20K</div>
          </div>

          <div className="bg-purple-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-purple-800">Best Case</h3>
                <div className="text-3xl font-bold text-purple-900 mt-2">$32K</div>
                <div className="text-purple-700 text-sm">8 deals</div>
              </div>
              <i className="fas fa-star text-purple-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-purple-800">Avg deal size: $4K</div>
          </div>

          <div className="bg-yellow-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Commit</h3>
                <div className="text-3xl font-bold text-yellow-900 mt-2">$20K</div>
                <div className="text-yellow-700 text-sm">5 deals</div>
              </div>
              <i className="fas fa-handshake text-yellow-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-yellow-800">Close rate: 85%</div>
          </div>

          <div className="bg-green-100 rounded-lg p-6 hover:scale-105 transition-transform cursor-pointer group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-green-800">Closed Won</h3>
                <div className="text-3xl font-bold text-green-900 mt-2">$15K</div>
                <div className="text-green-700 text-sm">3 deals</div>
              </div>
              <i className="fas fa-trophy text-green-600 text-xl"></i>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-xs text-green-800">This month's revenue</div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-neutral-bg rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Deals: 47</span>
            <span className="text-purple-900 font-semibold">Total Value: $2.3M</span>
          </div>
        </div>
      </div>

      <div id="deals-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 bottom-full mb-2 bg-white shadow-lg rounded-md p-2 min-w-48">
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-csv text-green-600"></i>Export as CSV</a>
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-pdf text-red-600"></i>Export as PDF</a>
              <a href="#" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"><i className="fas fa-file-image text-blue-600"></i>Export as PNG</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderJobsVariant = () => (
    <div id="jobs-modal" className="modal-variant">
      <div id="jobs-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Hiring Pipeline</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div id="jobs-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-48">
            <option>All Job Reqs</option>
            <option>BDD-Milwaukee</option>
            <option>Frontend-Remote</option>
            <option>Backend-NYC</option>
          </select>
          <input type="text" placeholder="Last 30 Days" className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2" />
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="jobs-body" className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500 to-purple-300 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Applied</span>
            <span className="font-bold">342</span>
            <div className="opacity-0 group-hover:opacity-100 absolute bg-white text-gray-800 p-2 rounded shadow-md text-xs -mt-8">Conversion: 75% to next stage</div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-400 to-purple-200 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Screened</span>
            <span className="font-bold">256</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-300 to-purple-100 rounded-full text-purple-800 group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Interview</span>
            <span className="font-bold">154</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-300 to-green-100 rounded-full text-green-800 group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Offer</span>
            <span className="font-bold">86</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-green-300 rounded-full text-white group hover:scale-105 transition-transform cursor-pointer">
            <span className="font-semibold">Hired</span>
            <span className="font-bold">52</span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-neutral-bg rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Active Candidates: 890</span>
            <span className="text-purple-900 font-semibold">Hire Rate: 15.2%</span>
          </div>
        </div>
      </div>

      <div id="jobs-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
        </div>
      </div>
    </div>
  );

  const renderOutreachVariant = () => (
    <div id="outreach-modal" className="modal-variant">
      <div id="outreach-header" className="flex justify-between items-start p-6 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-purple-900">Reply Rate Chart</h2>
          <p className="text-gray-600 mt-1">Explore Your Data—Filter, Export, Add to Dashboard</p>
        </div>
        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-purple-600 transition-all duration-300 hover:rotate-90">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      <div id="outreach-filters" className="p-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-4">
          <select className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2 min-w-48">
            <option>By Template</option>
            <option>Template A</option>
            <option>Template B</option>
            <option>Custom Template</option>
          </select>
          <input type="text" placeholder="Last 30 Days" className="border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 rounded-md p-2" />
          <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Apply</button>
        </div>
      </div>

      <div id="outreach-body" className="p-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Reply Rate Trend</h3>
            <div className="flex items-center text-green-600">
              <i className="fas fa-arrow-up mr-1"></i>
              <span className="font-semibold">+2.3%</span>
            </div>
          </div>
          <canvas id="replyChart" width="400" height="200"></canvas>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-900">54.5%</div>
            <div className="text-sm text-purple-700">Average Reply Rate</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-900">78.2%</div>
            <div className="text-sm text-blue-700">Open Rate</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-900">1,247</div>
            <div className="text-sm text-green-700">Total Sent</div>
          </div>
        </div>
      </div>

      <div id="outreach-footer" className="p-6 border-t border-gray-200 flex justify-end gap-4">
        <button className="border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-md px-4 py-2 transition-colors">Go to Source</button>
        <button className="bg-purple-600 text-white hover:bg-purple-700 rounded-md px-4 py-2 transition-colors">Add to Dashboard</button>
        <div className="relative">
          <button onClick={() => setShowExportMenu((s) => !s)} className="bg-gray-600 text-white hover:bg-gray-700 rounded-md px-4 py-2 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
        </div>
      </div>
    </div>
  );

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
        <div id="modal-overlay" className="fixed inset-0 bg-black/50 modal z-40" onClick={(e) => { if (e.target === e.currentTarget) { setIsModalOpen(false); setShowExportMenu(false); } }}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div id="modal-content" className={`bg-white rounded-xl shadow-2xl w-full md:w-3/4 lg:w-2/3 max-w-6xl max-h-[90vh] overflow-auto transform transition-transform duration-300 ${isModalOpen ? 'scale-100' : 'scale-95'}`}>
              {modalType === 'deals' && renderDealsVariant()}
              {modalType === 'jobs' && renderJobsVariant()}
              {modalType === 'outreach' && renderOutreachVariant()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}