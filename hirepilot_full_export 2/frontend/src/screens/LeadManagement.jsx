// LeadManagement.jsx (wired up with mock data)
import React, { useState } from 'react';
import {
  FaPlus,
  FaFileExport,
  FaEnvelope,
  FaTags,
  FaArrowRight,
} from 'react-icons/fa6';

const mockLeads = [
  {
    id: 1,
    name: 'John Cooper',
    title: 'Senior Developer at Google',
    location: 'San Francisco, CA',
    email: 'john.cooper@gmail.com',
    phone: '+1 (555) 123-4567',
    status: 'Interested',
    tags: ['Tech', 'Senior'],
    source: 'LinkedIn',
    lastContact: 'Jan 15, 2025',
    campaign: 'Tech Campaign Q1',
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
  },
  {
    id: 2,
    name: 'Sarah Wilson',
    title: 'Sales Manager at Adobe',
    location: 'New York, NY',
    email: 'sarah.w@adobe.com',
    phone: '+1 (555) 987-6543',
    status: 'Interviewing',
    tags: ['Sales', 'Remote'],
    source: 'Apollo',
    lastContact: 'Jan 18, 2025',
    campaign: 'Sales Team Q1',
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg',
  },
];

export default function LeadManagement() {
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [campaignFilter, setCampaignFilter] = useState('All Campaigns');
  const [tagFilter, setTagFilter] = useState('All Tags');
  const [selectedLeads, setSelectedLeads] = useState([]);

  const filteredLeads = mockLeads.filter((lead) => {
    return (
      (statusFilter === 'All Status' || lead.status === statusFilter) &&
      (campaignFilter === 'All Campaigns' || lead.campaign === campaignFilter) &&
      (tagFilter === 'All Tags' || lead.tags.includes(tagFilter))
    );
  });

  const toggleSelect = (id) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Lead Management</h1>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center">
              <FaPlus className="mr-2" /> Add Lead
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center text-gray-600">
              <FaFileExport className="mr-2" /> Export
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {['All Status', 'New', 'Messaged', 'Replied', 'Interested', 'Interviewing', 'Hired'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
            <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {['All Campaigns', 'Tech Campaign Q1', 'Sales Team Q1'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              {['All Tags', 'Tech', 'Sales', 'Senior', 'Remote'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center space-x-4">
          <button className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg flex items-center">
            <FaEnvelope className="mr-2" /> Message
          </button>
          <button className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg flex items-center">
            <FaTags className="mr-2" /> Tag
          </button>
          <button className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg flex items-center">
            <FaArrowRight className="mr-2" /> Move
          </button>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input type="checkbox" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <img src={lead.avatar} className="h-10 w-10 rounded-full" alt="avatar" />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                        <div className="text-sm text-gray-500">{lead.title}</div>
                        <div className="text-sm text-gray-500">{lead.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">{lead.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{lead.email}</div>
                    <div className="text-sm text-gray-500">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {lead.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
