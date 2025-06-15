import { useState, useEffect } from 'react';
import {
  FaArrowLeft,
  FaRocket,
  FaCircleCheck,
  FaLinkedin
} from 'react-icons/fa6';
import { supabase } from '../lib/supabase';
import { apiPost } from '../lib/api';

function CampaignBuilder() {
  const [campaignName, setCampaignName] = useState('');
  const [jobReq, setJobReq] = useState('');
  const [user, setUser] = useState(null);
  const [campaignId, setCampaignId] = useState('example_campaign_id');
  const [messages, setMessages] = useState([]);
  const [linkedinFilters, setLinkedinFilters] = useState({
    keywords: [],
    locations: [],
    current_companies: [],
    past_companies: [],
    schools: [],
    years_of_experience: null,
    job_titles: []
  });

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/getMessages?campaign_id=${campaignId}`);
        const data = await response.json();

        if (response.ok) setMessages(data.messages);
        else console.error('❌ Failed to fetch messages:', data.error);
      } catch (err) {
        console.error('❌ Error fetching messages:', err);
      }
    };

    if (campaignId) fetchMessages();
  }, [campaignId]);

  const handleLaunch = async () => {
    try {
      const data = await apiPost('/api/saveCampaign', {
        campaignName,
        jobReq,
        linkedinFilters
      });

      console.log('✅ Campaign saved:', data.campaign);
      setCampaignId(data.campaign.id);

      // Send notifications
      await apiPost('/api/sendSlackNotification', {
        event_type: 'campaign_created',
        campaign_name: campaignName,
      });

      await apiPost('/api/sendSlackNotification', {
        event_type: 'campaign_sent',
        campaign_name: campaignName,
      });

    } catch (error) {
      console.error('❌ Failed to save campaign:', error);

      await apiPost('/api/sendSlackNotification', {
        event_type: 'campaign_failed',
        campaign_name: campaignName,
        error_message: error.message || 'Unknown error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 fixed w-full z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FaArrowLeft className="text-gray-600 cursor-pointer" />
            <h1 className="text-xl font-semibold">Campaign Builder</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLaunch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
            >
              <FaRocket className="mr-2" /> Launch Campaign
            </button>
          </div>
        </div>
      </header>

      <main className="pt-24 px-4 max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">📥 Loaded Messages</h2>
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages found.</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-4 bg-white rounded-lg shadow-sm border p-4">
              <div className="text-sm text-gray-500 mb-2">
                Day {msg.day} – {msg.message_type}
              </div>
              <div className="text-gray-700 whitespace-pre-wrap">{msg.message_text}</div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default CampaignBuilder;
