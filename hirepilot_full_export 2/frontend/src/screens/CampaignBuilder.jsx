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

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    fetchUser();
  }, []);

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
    } else {
      console.error('❌ Failed to save campaign:', data.error);
    }
  };

  const handleSaveMessage = async () => {
    const response = await fetch('/api/saveMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user?.id,
        campaign_id: null, // Replace when campaign context is connected
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

      {/* Main content (no changes from your version) */}
      {/* Keep the Timeline, Message Editor, and Preview content here as-is */}
    </div>
  );
}
