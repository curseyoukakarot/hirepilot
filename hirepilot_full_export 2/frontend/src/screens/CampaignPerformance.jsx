import React from 'react';
import { FaCopy, FaPenToSquare, FaPause, FaArrowUp, FaArrowDown, FaFilter, FaDownload, FaEllipsis } from 'react-icons/fa6';

export default function CampaignPerformance() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-semibold text-gray-900">Campaign Performance</h1>
            <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">Active</span>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <FaCopy className="mr-2" /> Duplicate
            </button>
            <button className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <FaPenToSquare className="mr-2" /> Edit Cadence
            </button>
            <button className="px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50">
              <FaPause className="mr-2" /> Pause Campaign
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 mx-auto max-w-7xl">
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Leads Messaged', value: '2,847', change: '12.5%', up: true },
            { label: 'Open Rate', value: '68.4%', change: '5.2%', up: true },
            { label: 'Reply Rate', value: '42.1%', change: '2.1%', up: false },
            { label: 'Interested Rate', value: '15.8%', change: '3.4%', up: true },
            { label: 'Conversions', value: '124', change: '8.9%', up: true },
          ].map((stat, idx) => (
            <div key={idx} className="p-4 bg-white rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">{stat.label}</h3>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stat.value}</p>
              <span className={`text-sm ${stat.up ? 'text-green-600' : 'text-red-600'}`}>
                {stat.up ? <FaArrowUp className="inline mr-1" /> : <FaArrowDown className="inline mr-1" />}
                {stat.change}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Performance Overview</h2>
            <div className="flex items-center space-x-4">
              <select className="px-3 py-2 border border-gray-300 rounded-lg">
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>This year</option>
              </select>
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button className="px-3 py-1 text-gray-700 bg-white rounded">Chart</button>
                <button className="px-3 py-1 text-gray-500 rounded hover:bg-gray-50">Table</button>
              </div>
            </div>
          </div>
          <div className="h-[400px] p-4">
            {/* Placeholder for ApexChart */}
            <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed rounded-lg">
              [ Chart will render here ]
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Lead Status Breakdown</h2>
            <div className="flex items-center space-x-3">
              <button className="flex items-center px-3 py-2 text-gray-600 bg-gray-100 rounded-lg">
                <FaFilter className="mr-2" /> Filter
              </button>
              <button className="flex items-center px-3 py-2 text-gray-600 bg-gray-100 rounded-lg">
                <FaDownload className="mr-2" /> Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  {
                    name: 'Alex Thompson',
                    title: 'Senior Developer',
                    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
                    status: 'Interested',
                    last: '2 days ago',
                    response: 'Positive'
                  },
                  {
                    name: 'Sarah Chen',
                    title: 'Product Designer',
                    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg',
                    status: 'Pending',
                    last: '5 days ago',
                    response: 'No response'
                  }
                ].map((lead, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <img src={lead.avatar} className="w-8 h-8 mr-3 rounded-full" />
                        <div>
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          <div className="text-sm text-gray-500">{lead.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-sm font-medium rounded-full ${lead.status === 'Interested' ? 'text-green-700 bg-green-100' : 'text-yellow-700 bg-yellow-100'}`}>{lead.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{lead.last}</td>
                    <td className="px-6 py-4 text-gray-500">{lead.response}</td>
                    <td className="px-6 py-4">
                      <button className="text-gray-400 hover:text-gray-600">
                        <FaEllipsis />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">Showing 2 of 234 leads</div>
            <div className="flex items-center space-x-2">
              <button className="px-3 py-1 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Previous</button>
              <button className="px-3 py-1 text-white bg-blue-600 rounded-lg hover:bg-blue-700">Next</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
