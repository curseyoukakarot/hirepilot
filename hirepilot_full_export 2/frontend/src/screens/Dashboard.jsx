import React, { useEffect, useState } from 'react';
import { FaRocket, FaFolderOpen, FaAddressBook, FaCreditCard } from 'react-icons/fa6';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    fetch('/api/getCampaigns')
      .then((res) => res.json())
      .then((data) => setCampaigns(data.campaigns || []))
      .catch((err) => console.error('❌ Failed to load campaigns:', err));
  }, []);

  const handleDelete = async (campaignId) => {
    const confirmed = window.confirm('Are you sure you want to delete this campaign?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/deleteCampaign', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Deleted:', data);
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      } else {
        console.error('❌ Delete error:', data.error);
      }
    } catch (err) {
      console.error('❌ Delete request failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FaRocket className="text-blue-600 text-2xl" />
            <span className="text-xl font-semibold">HirePilot</span>
          </div>
          <nav className="flex items-center space-x-6">
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Dashboard</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Campaigns</span>
            <span className="text-gray-600 hover:text-gray-900 cursor-pointer">Leads</span>
            <img
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
              alt="User"
              className="w-8 h-8 rounded-full"
            />
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-12">
        {campaigns.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Campaigns */}
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
              <div className="mb-6">
                <FaFolderOpen className="text-6xl text-gray-300 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold mb-3">No Campaigns Yet</h3>
              <p className="text-gray-600 mb-6">
                You haven't created any campaigns yet. Start one now to begin your recruitment journey.
              </p>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                + Create Campaign
              </button>
            </div>

            {/* Leads */}
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
              <div className="mb-6">
                <FaAddressBook className="text-6xl text-gray-300 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold mb-3">No Leads Found</h3>
              <p className="text-gray-600 mb-6">Connect with Clay or upload a CSV file to start building your lead database.</p>
              <div className="flex justify-center space-x-4">
                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                  Connect Clay
                </button>
                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                  Upload CSV
                </button>
              </div>
            </div>

            {/* Credits */}
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200 hover:border-blue-200 transition-all">
              <div className="mb-6">
                <FaCreditCard className="text-6xl text-gray-300 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Low on Credits</h3>
              <p className="text-gray-600 mb-6">You're running low on credits. Top up now to continue sourcing candidates.</p>
              <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                + Top Up Credits
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Req</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{campaign.job_req || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(campaign.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-4">
                      <button
                        onClick={() => handleDelete(campaign.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                      <button className="text-blue-600 hover:text-blue-900">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center text-sm text-gray-600">
          <span>© 2025 HirePilot. All rights reserved.</span>
          <div className="flex space-x-6">
            <span className="hover:text-gray-900 cursor-pointer">Terms</span>
            <span className="hover:text-gray-900 cursor-pointer">Privacy</span>
            <span className="hover:text-gray-900 cursor-pointer">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
