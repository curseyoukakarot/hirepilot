import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Linkedin,
  FileText,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { getUserCredits } from '../../services/creditService';

const defaultSources = [
  { key: 'apollo', label: 'Apollo.io', icon: <Database className="text-blue-600 w-6 h-6" />, leads: 12 },
  { key: 'linkedin', label: 'Sales Navigator', icon: <Linkedin className="text-blue-600 w-6 h-6" /> },
  { key: 'csv', label: 'CSV Upload', icon: <FileSpreadsheet className="text-blue-600 w-6 h-6" /> },
];

const mockLeads = [
  {
    name: 'John Smith',
    title: 'Senior Developer',
    email: 'john@example.com',
    source: 'Apollo',
    status: 'Ready',
  },
];

const fetchWithAuth = async (supabaseClient, url, options = {}) => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  const doFetch = async (jwt) => fetch(url, { ...options, headers: { ...(options.headers||{}), ...(jwt?{Authorization:`Bearer ${jwt}`}:{}) }, credentials:'include'});
  let res = await doFetch(token);
  if (res.status === 401) {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (!error && data.session) res = await doFetch(data.session.access_token);
  }
  return res;
};

export default function Step4ImportLeads({ leads, setLeads, onBack, onNext }) {
  const [selectedSource, setSelectedSource] = useState('apollo');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkedinAccountType, setLinkedinAccountType] = useState('session');
  const [userCredits, setUserCredits] = useState({
    totalCredits: 0,
    usedCredits: 0,
    remainingCredits: 0
  });
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [userHasLinkedin, setUserHasLinkedin] = useState(true);
  const [sources, setSources] = useState(defaultSources);

  // Select/deselect all leads
  const allSelected = selectedLeads.length === mockLeads.length;
  const toggleAll = () => {
    setSelectedLeads(allSelected ? [] : mockLeads.map((_, i) => i));
  };

  const toggleLead = idx => {
    setSelectedLeads(selectedLeads.includes(idx)
      ? selectedLeads.filter(i => i !== idx)
      : [...selectedLeads, idx]);
  };

  const handleSaveLeadSource = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const body = {
        user_id: user.id,
        source: selectedSource,
        leads: selectedLeads.map(idx => mockLeads[idx]),
      };
      // If LinkedIn, include the search URL (replace with your variable if needed)
      if (selectedSource === 'linkedin') {
        body.linkedin_search_url = keywords; // Replace 'keywords' with your LinkedIn search URL variable if needed
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/saveLeadSource`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Failed to save lead source: ${txt}`);
      }

      // Advance to Step 5 after successful save
      onNext();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Only allow Next if not LinkedIn, or if LinkedIn and save is complete
  const canProceed = selectedLeads.length > 0 && (selectedSource !== 'linkedin' || isLoading === false);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        setCreditsLoading(true);
        const credits = await getUserCredits();
        setUserCredits(credits);
      } catch (error) {
        console.error('Error fetching credits:', error);
      } finally {
        setCreditsLoading(false);
      }
    };

    async function checkLinkedinCookie() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserHasLinkedin(false);
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/linkedin/check-cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await response.json();
      setUserHasLinkedin(response.ok && data.exists);
    }
    
    fetchCredits();
    checkLinkedinCookie();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const isRecruitPro = user?.user_metadata?.account_type === 'RecruitPro' || user?.user_metadata?.role === 'RecruitPro';
      if (isRecruitPro) {
        setSources(prev => prev.map(src => src.key === 'apollo' ? { ...src, label: 'Candidate Keyword Search' } : src));
      }
    })();
  }, []);

  return (
    <div className="min-h-[800px] bg-gray-50">
      {/* Fixed Header with progress tracker */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold">HirePilot</div>
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">{n}</div>
                    <div className="w-16 h-1 bg-green-500"></div>
                  </div>
                ))}
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">4</div>
                  <div className="w-16 h-1 bg-gray-200"></div>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">5</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Import Leads</h1>
            <p className="text-gray-600 mt-2">Choose a source to import candidate leads for this campaign.</p>
          </div>
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Source Selection */}
            <div className="col-span-12 md:col-span-4 space-y-4">
              {sources.map(src => (
                <button
                  key={src.key}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-gray-50 transition-all ${selectedSource === src.key ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                  onClick={() => setSelectedSource(src.key)}
                >
                  <div className="flex items-center">
                    {src.icon}
                    <span className="ml-3">{src.label}</span>
                  </div>
                  {src.leads && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{src.leads} leads</span>
                  )}
                </button>
              ))}
            </div>
            {/* Right Column - Source Configuration & Preview */}
            <div className="col-span-12 md:col-span-8">
              <div className="bg-white rounded-lg border p-6">
                {/* Apollo.io Configuration (show for apollo only) */}
                {selectedSource === 'apollo' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                      <input type="password" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" value={apiKey} onChange={e => setApiKey(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" value={location} onChange={e => setLocation(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                      <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" value={keywords} onChange={e => setKeywords(e.target.value)} />
                    </div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Fetch Leads</button>
                  </div>
                )}
                {/* Sales Navigator Configuration (show for linkedin only) */}
                {selectedSource === 'linkedin' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-2">Account to use</label>
                      <select
                        className="w-full rounded-lg border-2 border-blue-500 px-4 py-2 text-base font-semibold focus:border-blue-700 focus:ring-blue-500"
                        value={linkedinAccountType}
                        onChange={e => setLinkedinAccountType(e.target.value)}
                      >
                        <option value="session">Use your LinkedIn session cookie</option>
                        {/* <option value="phantombuster">Use your PhantomBuster account (coming soon)</option> */}
                      </select>
                    </div>
                    <div className="mt-2 text-blue-600 font-medium">
                      This will use 50 credits per campaign. You have {creditsLoading ? '...' : userCredits.remainingCredits.toLocaleString()} credits available.
                    </div>
                  </div>
                )}
              </div>
              {/* Preview Table */}
              <div className="mt-6 bg-white rounded-lg border">
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Leads Preview</h3>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full text-base font-semibold"
                      onClick={handleSaveLeadSource}
                      disabled={!userHasLinkedin && selectedSource === 'linkedin'}
                    >
                      Save Lead Source
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <input type="checkbox" className="rounded border-gray-300" checked={allSelected} onChange={toggleAll} />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {mockLeads.map((lead, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input type="checkbox" className="rounded border-gray-300" checked={selectedLeads.includes(idx)} onChange={() => toggleLead(idx)} />
                          </td>
                          <td className="px-6 py-4">{lead.name}</td>
                          <td className="px-6 py-4">{lead.title}</td>
                          <td className="px-6 py-4">{lead.email}</td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{lead.source}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{lead.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {!userHasLinkedin && (
                <div className="mt-2 text-red-600 font-medium">Please connect your LinkedIn session cookie on the Integrations page before saving lead source.</div>
              )}
            </div>
          </div>
        </div>
      </main>
      {/* Fixed Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <button 
              className="flex items-center text-gray-600 hover:text-gray-900" 
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              Back to Message
            </button>
            <button 
              className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 ${
                !canProceed ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={selectedSource === 'linkedin' ? handleSaveLeadSource : onNext}
              disabled={!canProceed || isLoading}
            >
              {isLoading ? 'Saving...' : 'Next: Review & Launch'}
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
} 