// frontend/src/screens/CampaignPerformance.jsx

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaChartBar } from 'react-icons/fa';

export default function CampaignPerformance() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    const fetchUserAndCampaigns = async () => {
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession()
      ]);
      const authedUser = userData?.user;
      const accessToken = sessionData?.session?.access_token;
      if (authedUser && accessToken) {
        setUser(authedUser);
        const response = await fetch(`/api/getCampaigns`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include'
        });
        const result = await response.json();
        if (response.ok) {
          setCampaigns(result.campaigns);
        } else {
          console.error('Failed to load campaigns', result.error);
        }
      }
    };

    fetchUserAndCampaigns();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <FaChartBar className="text-blue-600" /> Campaign Performance
      </h1>

      {campaigns.length === 0 ? (
        <p className="text-gray-500">No campaigns found yet.</p>
      ) : (
        <div className="grid gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-xl font-semibold text-gray-800">{campaign.title}</h2>
              <p className="text-gray-500">{campaign.description || 'No description provided.'}</p>
              <p className="text-sm text-gray-400 mt-2">Status: {campaign.status || 'N/A'}</p>
              <p className="text-sm text-gray-400">Created: {new Date(campaign.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
