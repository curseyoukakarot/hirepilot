import { useState, useEffect } from 'react';
import {
  FaArrowLeft,
  FaRocket,
  FaLink,
  FaDatabase,
  FaTable,
  FaEnvelope,
  FaLinkedin,
  FaSlack,
  FaWandMagicSparkles,
  FaEye,
  FaPlus,
  FaTrash
} from 'react-icons/fa6';
import { supabase } from '../../lib/supabaseClient'; // Adjust path as needed

export default function CampaignBuilder() {
  const [campaignName, setCampaignName] = useState('');
  const [jobReq, setJobReq] = useState('');
  const [leadSource, setLeadSource] = useState('CSV');
  const [tone, setTone] = useState('Professional');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const [campaignId, setCampaignId] = useState('example_campaign_id'); // 🔧 Replace later dynamically
  const [messages, setMessages] = useState([]);

  // Fetch logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    fetchUser();
  }, []);

  // 🔁 Fetch messages for selected campaign
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/getMessages?campaign_id=${campaignId}`);
        const data = await response.json();

        if (response.ok) {
          setMessages(data.messages);
        } else {
          console.error('❌ Failed to fetch messages:', data.error);
        }
      } catch (err) {
        console.error('❌ Error fetching messages:', err);
      }
    };

    if (campaignId) fetchMessages();
  }, [campaignId]);

  // 🔹 Save campaign
  const handleLaunch = async () => {
    const response = await fetch('/api/saveCampaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user?.id,
        campaignName,
        jobReq
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Campaign saved:', data.campaign);
      setCampaignId(data.campaign.id); // ⬅️ Optional: update campaignId after save
    } else {
      console.error('❌ Failed to save campaign:', data.error);
    }
  };

  // 🔹 Save message
  const handleSaveMessage = async () => {
    const response = await fetch('/api/saveMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user?.id,
        campaign_id: campaignId,
        message_type: 'email',
        message_text: message,
        day: 1
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Message saved:', data.message);
    } else {
      console.error('❌ Failed to save message:', data.error);
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
              onClick={handleSaveMessage}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg flex items-center"
            >
              Save Draft
            </button>
            <button
              onClick={handleLaunch}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
            >
              <FaRocket className="mr-2" /> Launch Campaign
            </button>
          </div>
        </div>
      </header>

      {/* 🚀 Show Previewed Messages (use your actual layout here) */}
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
