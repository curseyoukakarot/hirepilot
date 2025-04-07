// CampaignBuilder.jsx (with state + interactivity)
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
    headers: {
      'Content-Type': 'application/json'
    },
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 fixed w-full z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FaArrowLeft className="text-gray-600 cursor-pointer" />
            <h1 className="text-xl font-semibold">Campaign Builder</h1>
          </div>
          <button
            onClick={handleLaunch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
          >
            <FaRocket className="mr-2" /> Launch Campaign
          </button>
        </div>
      </header>

      <main className="pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">1</div>
                <div className="ml-3">Setup</div>
              </div>
              <div className="flex-1 mx-4 h-1 bg-gray-200">
                <div className="w-1/3 h-full bg-blue-600"></div>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">2</div>
                <div className="ml-3">Content</div>
              </div>
              <div className="flex-1 mx-4 h-1 bg-gray-200"></div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">3</div>
                <div className="ml-3">Review</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter campaign name"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Connect to Job Req</h3>
                  <FaLink className="text-blue-600" />
                </div>
                <select
                  value={jobReq}
                  onChange={(e) => setJobReq(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option>Select Job Requisition</option>
                  <option>Senior Dev</option>
                  <option>Product Manager</option>
                </select>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Lead Source</h3>
                  <FaDatabase className="text-blue-600" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['CSV', 'Clay', 'Phantom'].map((source) => (
                    <button
                      key={source}
                      onClick={() => setLeadSource(source)}
                      className={`px-4 py-2 border border-gray-200 rounded-lg flex items-center justify-center ${leadSource === source ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      {source === 'CSV' && <FaTable className="mr-2" />} {source}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-medium mb-6">Campaign Timeline</h2>
            <div className="space-y-4">
              <div className="flex items-start border border-gray-200 rounded-lg p-4">
                <div className="w-24 pt-2">
                  <span className="text-sm font-medium">Day 1</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-4">
                    <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg flex items-center">
                      <FaEnvelope className="mr-2" /> Email
                    </button>
                    <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center">
                      <FaLinkedin className="mr-2" /> LinkedIn
                    </button>
                    <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center">
                      <FaSlack className="mr-2" /> Slack
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FaWandMagicSparkles className="text-purple-600" />
                          <span className="text-sm font-medium">GPT Message Editor</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {['Professional', 'Casual', 'Friendly'].map((t) => (
                            <button
                              key={t}
                              onClick={() => setTone(t)}
                              className={`text-sm ${tone === t ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-gray-800'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Write or generate your message..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <button className="text-gray-400 hover:text-gray-600">
                    <FaTrash />
                  </button>
                </div>
              </div>
              <button className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center">
                <FaPlus className="mr-2" /> Add Timeline Step
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium">Campaign Preview</h2>
              <button className="text-blue-600 hover:text-blue-700 flex items-center">
                <FaEye className="mr-2" /> Preview All Messages
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="font-medium">John Cooper</div>
                    <div className="text-sm text-gray-500">Senior Developer at Tech Corp</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">Day 1 - Email</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-600 whitespace-pre-wrap">{message}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
