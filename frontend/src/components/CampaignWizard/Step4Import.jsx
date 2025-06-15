import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import WizardStepHeader from './WizardStepHeader';
import { useWizard } from '../../context/WizardContext';
import ApolloStep from './ApolloStep';
import CsvStep from './CsvStep';

const ApolloLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#1C1D3C" />
    <path d="M12 6.5L17 17H7L12 6.5Z" fill="#fff" />
  </svg>
);
const LinkedInLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <path d="M7.5 9H10V17H7.5V9ZM8.75 7.75C8.05964 7.75 7.5 8.30964 7.5 9C7.5 9.69036 8.05964 10.25 8.75 10.25C9.44036 10.25 10 9.69036 10 9C10 8.30964 9.44036 7.75 8.75 7.75ZM11.5 9H14V10.25H14.03C14.32 9.75 14.97 9.25 15.97 9.25C18.03 9.25 18.5 10.5 18.5 12.25V17H16V12.75C16 11.75 15.5 11.5 15.03 11.5C14.56 11.5 14 11.75 14 12.75V17H11.5V9Z" fill="white" />
  </svg>
);

const SOURCES = [
  { key: 'apollo', label: 'Apollo.io', icon: <ApolloLogo /> },
  { key: 'linkedin', label: 'Sales Navigator', icon: <LinkedInLogo /> },
];

// Mock user state for credits and integrations
const USER_CREDITS = 50; // TODO: Replace with real user credits from backend
const USER_HAS_LINKEDIN = false; // TODO: Replace with real check from settings
const USER_HAS_APOLLO = false; // TODO: Replace with real check from settings

const LEAD_AMOUNTS = [10, 25, 50, 100];

export default function Step4Import({ onBack, onNext }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wizard, setWizard } = useWizard();
  
  const campaign = wizard.campaign;
  const campaignId = campaign?.id;

  const [leadAmount, setLeadAmount] = useState(10);
  const [selectedSource, setSelectedSource] = useState('apollo');
  const [searchUrl, setSearchUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionId, setExecutionId] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);

  // Apollo/Lever integration state
  const [apolloKey, setApolloKey] = useState('');
  const [apolloVerified, setApolloVerified] = useState(false);
  const [leverKey, setLeverKey] = useState('');
  const [leverVerified, setLeverVerified] = useState(false);
  const [verifying, setVerifying] = useState({ apollo: false, lever: false });

  // LinkedIn config state
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Lever config state
  const [leverApiKey, setLeverApiKey] = useState('');

  // Leads preview (mock)
  const leads = [
    {
      name: 'John Smith',
      title: 'Senior Developer',
      email: 'john@example.com',
      source: 'Apollo',
      status: 'Ready',
    },
  ];

  // Apollo job title, location, and keywords
  const [apolloApiKey, setApolloApiKey] = useState('');
  const [apolloJobTitle, setApolloJobTitle] = useState('');
  const [apolloLocation, setApolloLocation] = useState('');
  const [apolloKeywords, setApolloKeywords] = useState('');

  // LinkedIn account selection
  const [linkedinAccountType, setLinkedinAccountType] = useState(USER_HAS_LINKEDIN ? 'own' : 'hirepilot');

  // Credit logic
  const usingHirePilotLinkedIn = selectedSource === 'linkedin' && linkedinAccountType === 'hirepilot' && !USER_HAS_APOLLO;
  const creditsNeeded = usingHirePilotLinkedIn ? leadAmount : 0;
  const hasEnoughCredits = USER_CREDITS >= creditsNeeded;

  // New state for userHasLinkedin
  const [userHasLinkedin, setUserHasLinkedin] = useState(USER_HAS_LINKEDIN);

  // State for cookie status
  const [linkedinCookieStatus, setLinkedinCookieStatus] = useState('none'); // 'valid' | 'invalid' | 'none'
  const [linkedinCookieStored, setLinkedinCookieStored] = useState(false);

  const [apolloKeyStatus, setApolloKeyStatus] = useState(''); // '', 'connected', 'error'
  const [apolloKeyError, setApolloKeyError] = useState('');
  const apolloKeyFetched = useRef(false);

  // Debug: log wizard state only when campaign changes
  useEffect(() => {
    // Get campaign ID from URL or state
    const params = new URLSearchParams(window.location.search);
    const id = params.get('campaignId');
    
    if (id && (!wizard.campaign || !wizard.campaign.id)) {
      setWizard(prev => ({
        ...prev,
        campaign: {
          ...(prev.campaign || {}),
          id
        }
      }));
    }
    
    // Fix nested campaign object if needed
    if (wizard?.campaign?.campaign) {
      setWizard(prev => ({
        ...prev,
        campaign: {
          ...prev.campaign.campaign,
          id: prev.campaign.campaign.id || id
        }
      }));
    }
  }, []);  // Empty dependency array since this should only run once on mount

  useEffect(() => {
    async function checkLinkedinCookie() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLinkedinCookieStatus('invalid');
        setLinkedinCookieStored(false);
        console.log('No user found for LinkedIn cookie check');
        return;
      }
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/linkedin/check-cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await response.json();
      console.log('LinkedIn cookie check response:', data, 'user:', user.id);
      if (response.ok && data.exists) {
        setLinkedinCookieStatus('valid');
        setLinkedinCookieStored(true);
      } else {
        setLinkedinCookieStatus('invalid');
        setLinkedinCookieStored(false);
      }
    }
    checkLinkedinCookie();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('phantom_buster_api_key, apollo_api_key, lever_api_key')
        .single();

      if (settingsError) {
        throw new Error('Failed to fetch user settings');
      }

      return {
        phantomBuster: !!settings.phantom_buster_api_key,
        apollo: !!settings.apollo_api_key,
        lever: !!settings.lever_api_key
      };
    } catch (error) {
      console.error('Error checking connection status:', error);
      return {
        phantomBuster: false,
        apollo: false,
        lever: false
      };
    }
  };

  const handleVerify = async (type) => {
    setVerifying(v => ({ ...v, [type]: true }));
    try {
      // Simulate API key verification
      await new Promise(res => setTimeout(res, 1000));
      if (type === 'apollo') setApolloVerified(!!apolloKey);
      if (type === 'lever') setLeverVerified(!!leverKey);
    } finally {
      setVerifying(v => ({ ...v, [type]: false }));
    }
  };

  const handleStartCampaign = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate search URL
      if (!searchUrl.includes('linkedin.com/sales/search')) {
        throw new Error('Please enter a valid LinkedIn Sales Navigator search URL');
      }

      // Check connection status
      const connections = await checkConnectionStatus();
      if (!connections.phantomBuster) {
        throw new Error('Please connect your PhantomBuster account first');
      }

      // Start campaign
      const response = await fetch('/api/campaign/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId,
          searchUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start campaign');
      }

      const result = await response.json();
      setExecutionId(result.phantomExecutionId);
      setExecutionStatus('started');

      toast({
        title: 'Campaign Started',
        description: 'Your campaign has been started successfully. We will notify you when it\'s complete.',
      });

      // Poll for execution status
      pollExecutionStatus(result.phantomExecutionId);
    } catch (error) {
      console.error('Error starting campaign:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pollExecutionStatus = async (executionId) => {
    try {
      const response = await fetch(`/api/campaign/execution/${executionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch execution status');
      }

      const result = await response.json();
      setExecutionStatus(result.status);

      if (result.status === 'completed') {
        toast({
          title: 'Campaign Complete',
          description: 'Your campaign has been completed successfully.',
        });
        onNext();
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Campaign failed');
      } else {
        // Continue polling
        setTimeout(() => pollExecutionStatus(executionId), 5000);
      }
    } catch (error) {
      console.error('Error polling execution status:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    // TODO: Replace with real integration check
    if (selectedSource === 'apollo') {
      // Simulate fetching from settings
      setApolloApiKey(apolloApiKey || '');
    }
    if (selectedSource === 'lever') {
      setLeverApiKey(leverApiKey || '');
    }
    // eslint-disable-next-line
  }, [selectedSource]);

  const handleLeadsSelected = async (selectedLeads) => {
    try {
      if (!selectedLeads || selectedLeads.length === 0) {
        toast({
          title: 'Error',
          description: 'Please select at least one lead before proceeding.',
          variant: 'destructive',
        });
        return;
      }

      // Update wizard state
      await new Promise((resolve) => {
        setWizard(prev => {
          const newState = {
            ...prev,
            leads: selectedLeads,
            selectedLeads: selectedLeads.map(lead => lead.id),
            numLeads: selectedLeads.length,
            step: 5 // Explicitly set the step to move to step 5
          };
          resolve();
          return newState;
        });
      });

      // Wait a bit for state to settle before navigation
      setTimeout(() => {
        onNext();
      }, 100);
    } catch (err) {
      console.error('[Step4] Error updating wizard state:', err);
      toast({
        title: 'Error',
        description: 'Failed to save selected leads. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveLeadSource = async () => {
    if (!campaignId) {
      console.error('[Step4] campaign.id is missing!', { campaign, wizard });
      toast({
        title: 'Error',
        description: 'Campaign not initialized — go back to Step 1.',
        variant: 'destructive',
      });
      return;
    }
    console.log('[UI] clicked Save Lead Source');
    // 1 — grab URL from state
    console.log('[UI] current url state ➜', linkedinUrl);
    if (!linkedinUrl) {
      console.log('[UI] early-return ❌  url empty');
      toast({
        title: 'Error',
        description: 'Paste a LinkedIn search URL first.',
        variant: 'destructive',
      });
      return;
    }
    // 2 — basic validation
    const isValid = /^(https?:\/\/)?(www\.)?linkedin\.com\/sales/.test(linkedinUrl);
    if (!isValid) {
      console.log('[UI] early-return ❌  url failed regex');
      toast({
        title: 'Error',
        description: 'Not a valid Sales Navigator URL',
        variant: 'destructive',
      });
      return;
    }
    // 3 — build payload
    const payload = {
      campaign_id: campaignId,
      lead_source_type: 'linkedin',
      payload: { linkedin_search_url: linkedinUrl },
    };
    console.log('[UI] payload ➜', payload);
    // 4 — call API
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/campaigns/lead-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.campaign) {
        console.error('[UI] API error ❌', data);
        throw new Error(data.error || 'Failed to save lead source');
      }
      console.log('[UI] API success ✅', data);
      
      // Update wizard state with campaign and leads data
      await setWizard(prev => ({
        ...prev,
        campaign: data.campaign,
        leads: data.leads || [],
        selectedLeads: data.leads?.map(lead => lead.id) || []
      }));

      // Verify state was updated
      console.log('[Step4] LinkedIn source saved, wizard state:', {
        campaign: data.campaign,
        leads: data.leads,
        selectedLeadIds: data.leads?.map(lead => lead.id)
      });

      toast({
        title: 'Lead Source Saved',
        description: 'Your LinkedIn search URL has been saved to this campaign.',
      });

      // Navigate after state update
      onNext();
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Apollo API key from backend when Apollo is selected
  useEffect(() => {
    if (selectedSource === "apollo" && !apolloKeyFetched.current) {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            fetch("/api/user/settings", {
                headers: {
                    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                },
                credentials: 'include',
            })
            .then(async (res) => {
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    setApolloKeyStatus('error');
                    setApolloKeyError('Server unreachable. Please check your backend connection.');
                    return {};
                }
                return res.json();
            })
            .then((data) => {
                if (data?.apollo_connected) {
                    setApolloKeyStatus("connected");
                    setApolloApiKey(data?.apollo_api_key || "");
                } else {
                    setApolloKeyStatus("error");
                    setApolloApiKey("");
                }
            })
            .catch(() => {
                setApolloKeyStatus("error");
                setApolloKeyError('Server unreachable. Please check your backend connection.');
            });
            apolloKeyFetched.current = true;
        })();
    }
  }, [selectedSource]);

  // Save Apollo API key to backend
  const handleSaveApolloKey = async () => {
    setApolloKeyStatus("");
    setApolloKeyError("");
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        const res = await fetch("/api/user/settings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({
                apollo_api_key: apolloApiKey
            })
        });
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            setApolloKeyStatus('error');
            setApolloKeyError('Server unreachable. Please check your backend connection.');
            return;
        }
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || "Failed to save API key");
        setApolloKeyStatus("connected");
    } catch (err) {
        setApolloKeyStatus("error");
        setApolloKeyError(err.message);
    }
  };

  return (
    <div className="min-h-[800px] bg-gray-50">
      <WizardStepHeader currentStep={4} />

      {/* Main Content */}
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Import Leads</h1>
            <p className="text-gray-600 mt-2">Choose a source to import candidate leads for this campaign.</p>
          </div>

          {/* Lead Amount Dropdown (centered below sources) */}
          <div className="flex justify-center mb-6">
            <div className="flex flex-col items-center">
              <label className="text-base font-semibold text-gray-700 mb-2">How many leads do you want to import?</label>
              <select
                className="rounded-lg border-2 border-blue-500 px-6 py-2 text-lg font-semibold focus:border-blue-700 focus:ring-blue-500"
                value={leadAmount}
                onChange={e => setLeadAmount(Number(e.target.value))}
              >
                {LEAD_AMOUNTS.map(amount => (
                  <option key={amount} value={amount}>{amount} leads</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - Source Selection */}
            <div className="col-span-12 md:col-span-4 space-y-4">
              {SOURCES.map(src => (
                <button
                  key={src.key}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border bg-white hover:bg-gray-50 transition-all ${selectedSource === src.key ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                  onClick={() => setSelectedSource(src.key)}
                >
                  <div className="flex items-center">
                    {src.icon}
                    <span className="ml-3">{src.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Right Column - Source Configuration */}
            <div className="col-span-12 md:col-span-8">
              {selectedSource === 'apollo' ? (
                <ApolloStep
                  onLeadsSelected={handleLeadsSelected}
                  defaultJobTitle={wizard.campaign?.title}
                  defaultKeywords={wizard.campaign?.keywords}
                  defaultLocation={wizard.campaign?.location}
                />
              ) : selectedSource === 'linkedin' ? (
                <div className="bg-white rounded-lg border p-6">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2">LinkedIn Sales Navigator Search URL</label>
                    <input type="text" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="https://www.linkedin.com/sales/search/..." value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
                  </div>
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
                    {linkedinCookieStatus === 'valid' && (
                      <div className="mt-2 text-green-600 font-medium">Valid Cookie Stored</div>
                    )}
                    {linkedinCookieStatus === 'invalid' && (
                      <div className="mt-2 text-red-600 font-medium">Please connect your LinkedIn session cookie on the Integrations page before importing leads.</div>
                    )}
                  </div>
                  <div className="mt-2 text-blue-600 font-medium">This will use 1 credit per lead. You have {USER_CREDITS} credits.</div>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 w-full text-base font-semibold" onClick={handleSaveLeadSource} disabled={linkedinCookieStatus !== 'valid'}>Save Lead Source</button>
                </div>
              ) : (
                <CsvStep onLeadsSelected={handleLeadsSelected} />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <button className="flex items-center text-gray-600 hover:text-gray-900" onClick={onBack}>
              <i className="fa-solid fa-arrow-left mr-2"></i>
              Back
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
} 