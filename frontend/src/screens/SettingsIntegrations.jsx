// SettingsIntegrations.jsx
import React, { useState, useEffect } from 'react';
import { FaCircle, FaGoogle, FaMicrosoft, FaRocket, FaGhost, FaEnvelope, FaCalendarDays, FaGear, FaLinkedin, FaPlug, FaFloppyDisk, FaPowerOff, FaShieldHalved } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { useLocation, useSearchParams } from 'react-router-dom';
import ApolloApiKeyModal from '../components/ApolloApiKeyModal';

export default function SettingsIntegrations() {
  const [integrations, setIntegrations] = useState([
    {
      id: 'google',
      name: 'Google',
      icon: <FaGoogle className="text-2xl text-red-600" />,
      status: 'Not Connected',
      description: 'Connect your Google account to sync emails and calendar',
      bgColor: 'bg-red-100',
      isConnected: false,
      apiKeyStatus: null // 'valid' | 'invalid' | null
    },
    {
      id: 'outlook',
      name: 'Outlook',
      icon: <FaMicrosoft className="text-2xl text-blue-600" />,
      status: 'Not Connected',
      description: 'Connect your Outlook account to sync emails and calendar',
      bgColor: 'bg-blue-100',
      isConnected: false
    },
    {
      id: 'apollo',
      name: 'Apollo',
      icon: <FaRocket className="text-2xl text-purple-600" />,
      status: 'Not Connected',
      description: 'Enhance your prospecting capabilities',
      bgColor: 'bg-purple-100',
      isConnected: false,
      apiKeyStatus: null // 'valid' | 'invalid' | null
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      icon: <FaEnvelope className="text-2xl text-green-600" />,
      status: 'Active',
      date: 'Mar 1, 2025',
      bgColor: 'bg-green-100',
      isConnected: true
    }
  ]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showSendGridModal, setShowSendGridModal] = useState(false);
  const [sendGridApiKey, setSendGridApiKey] = useState('');
  const [sendGridLoading, setSendGridLoading] = useState(false);
  const [allowedSenders, setAllowedSenders] = useState([]);
  const [selectedSender, setSelectedSender] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showPhantombusterModal, setShowPhantombusterModal] = useState(false);
  const [phantombusterApiKey, setPhantombusterApiKey] = useState('');
  const [phantombusterLoading, setPhantombusterLoading] = useState(false);
  const [phantombusterError, setPhantombusterError] = useState('');
  const [showChangeSenderModal, setShowChangeSenderModal] = useState(false);
  const [changeSenderLoading, setChangeSenderLoading] = useState(false);
  const [changeSenderError, setChangeSenderError] = useState('');
  const [changeSenderOptions, setChangeSenderOptions] = useState([]);
  const [changeSenderSelected, setChangeSenderSelected] = useState('');
  const [linkedinSessionCookie, setLinkedinSessionCookie] = useState('');
  const [linkedinCookieStatus, setLinkedinCookieStatus] = useState('none'); // 'valid' | 'invalid' | 'none'
  const [linkedinCookieMessage, setLinkedinCookieMessage] = useState('');
  const [linkedinCookieStored, setLinkedinCookieStored] = useState(false);
  const [sendGridStep, setSendGridStep] = useState('validate'); // 'validate' | 'chooseSender'
  const [showApolloModal, setShowApolloModal] = useState(false);
  const [apolloApiKey, setApolloApiKey] = useState('');
  const BACKEND = import.meta.env.VITE_BACKEND_URL;

  // Add new state for Apollo key status
  const [apolloKeyStatus, setApolloKeyStatus] = useState(null); // 'valid' | 'invalid' | null

  // Fetch integration status from Supabase on mount
  useEffect(() => {
    const fetchIntegrations = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      // Fetch Google integration from google_accounts
      const { data: googleData, error: googleError } = await supabase
        .from('google_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);  // Get most recent connection

      if (googleError) {
        console.error('Error fetching Google account:', googleError);
        toast.error('Failed to fetch Google integration status');
        return;
      }

      // Get the most recent Google account if any exists
      const mostRecentGoogleAccount = googleData?.[0];
      // Fetch other integrations as before
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id);
      setIntegrations(prev => prev.map(intg => {
        if (intg.id === 'google') {
          return {
            ...intg,
            isConnected: mostRecentGoogleAccount?.status === 'connected',
            status: mostRecentGoogleAccount?.status === 'connected' ? 'Active' : 'Not Connected',
            date: mostRecentGoogleAccount?.expires_at ? new Date(mostRecentGoogleAccount.expires_at).toLocaleDateString() : undefined
          };
        }
        const found = data?.find(row => row.provider === intg.id && row.status === 'connected');
        if (found) {
          return {
            ...intg,
            isConnected: true,
            status: 'Active',
            date: found.connected_at ? new Date(found.connected_at).toLocaleDateString() : undefined
          };
        } else {
          return {
            ...intg,
            isConnected: false,
            status: 'Not Connected',
            date: undefined
          };
        }
      }));
      setLoading(false);
    };
    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (
      location.pathname === '/settings/integrations' &&
      searchParams.get('apollo') === 'connected'
    ) {
      setIntegrations(prev =>
        prev.map(intg =>
          intg.id === 'apollo'
            ? { ...intg, isConnected: true, status: 'Active' }
            : intg
        )
      );
      toast.success('Apollo connected!');
    }
  }, [location, searchParams]);

  useEffect(() => {
    let channel;
    let isSubscribed = false;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || isSubscribed) return;

      try {
        channel = supabase
          .channel(`google-accounts-${user.id}-${Date.now()}`) // Make channel name unique
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'google_accounts',
            filter: `user_id=eq.${user.id}`
          }, payload => {
            console.log('Supabase realtime payload:', payload);
            // Get the most recent status
            const newStatus = payload.new?.status;
            setIntegrations(prev => prev.map(intg =>
              intg.id === 'google'
                ? { 
                    ...intg, 
                    isConnected: newStatus === 'connected',
                    status: newStatus === 'connected' ? 'Active' : 'Not Connected',
                    date: payload.new?.expires_at ? new Date(payload.new.expires_at).toLocaleDateString() : undefined
                  }
                : intg
            ));
          });

        await channel.subscribe();
        isSubscribed = true;
        console.log('Successfully subscribed to changes');
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        if (channel) {
          await supabase.removeChannel(channel);
        }
      }
    };

    setupRealtime();

    return () => {
      const cleanup = async () => {
        if (channel) {
          console.log('Cleaning up Supabase channel');
          await supabase.removeChannel(channel);
          isSubscribed = false;
        }
      };
      cleanup();
    };
  }, []); // Empty dependency array to run only once on mount

  // Helper to update integration status in DB and refresh UI
  const updateIntegrationStatus = async (provider, status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (status === 'connected') {
      await supabase.from('integrations').upsert({
        user_id: user.id,
        provider,
        status: 'connected',
        connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' });
    } else {
      await supabase.from('integrations').upsert({
        user_id: user.id,
        provider,
        status: 'not_connected',
        connected_at: null
      }, { onConflict: 'user_id,provider' });
    }
    // Refresh UI
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id);
    setIntegrations(prev => prev.map(intg => {
      const found = data.find(row => row.provider === intg.id && row.status === 'connected');
      if (found) {
        return {
          ...intg,
          isConnected: true,
          status: 'Active',
          date: found.connected_at ? new Date(found.connected_at).toLocaleDateString() : undefined
        };
      } else {
        return {
          ...intg,
          isConnected: false,
          status: 'Not Connected',
          date: undefined
        };
      }
    }));
  };

  const handleConnect = async (id) => {
    if (id === 'google') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }
      console.log('Starting Google OAuth flow for user:', user.id);
      try {
        const backendUrl = `${import.meta.env.VITE_BACKEND_URL}/api/auth/google/init?user_id=${user.id}`;
        console.log('Calling backend URL:', backendUrl);
        const response = await fetch(backendUrl);
        console.log('Backend response status:', response.status);
        const data = await response.json();
        console.log('Backend response data:', data);
        if (data.url) {
          console.log('Redirecting to:', data.url);
          window.location.href = data.url;
        } else {
          console.error('No URL in response:', data);
          toast.error('Failed to get Google auth URL');
        }
      } catch (error) {
        console.error('Google OAuth error:', error);
        toast.error('Failed to connect Google. Please try again.');
      }
    } else if (id === 'outlook') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const clientId = '1b3df991-884a-4d19-9cd4-9901baddcb97';
      const redirectUri = `${import.meta.env.VITE_BACKEND_URL}/api/auth/outlook/callback`;
      const scope = encodeURIComponent('openid profile email offline_access Mail.Send');
      const state = user.id;
      const outlookAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
      window.location.href = outlookAuthUrl;
    } else if (id === 'apollo') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/apollo/init?user_id=${user.id}`);
        const { url } = await response.json();
        window.location.href = url;
      } catch (error) {
        console.error('Apollo OAuth error:', error);
        toast({
          title: 'Connection Failed',
          description: 'Failed to connect Apollo. Please try again.',
          variant: 'destructive'
        });
      }
    } else if (id === 'sendgrid') {
      setShowSendGridModal(true);
    } else if (id === 'phantombuster') {
      setShowPhantombusterModal(true);
    }
  };

  // Step 1: Validate API key and fetch senders
  const handleValidateSendGridKey = async () => {
    setSendGridLoading(true);
    setValidationError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSendGridLoading(false);
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendgrid/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: sendGridApiKey })
      });
      const data = await response.json();
      if (response.ok) {
        setAllowedSenders(data.senders || []);
        if (data.senders && data.senders.length > 0) {
          setSelectedSender(data.senders[0].from_email || data.senders[0].email);
          setSendGridStep('chooseSender');
        } else {
          setValidationError('No verified senders found.');
        }
      } else {
        setValidationError(data.error || 'Failed to validate key.');
      }
    } catch (err) {
      setValidationError('Failed to validate key.');
    }
    setSendGridLoading(false);
  };

  // Step 2: Save the selected sender and API key
  const handleSaveSendGridSender = async () => {
    setSendGridLoading(true);
    setValidationError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSendGridLoading(false);
      return;
    }
    if (!selectedSender) {
      setValidationError('Please pick a sender');
      setSendGridLoading(false);
      return;
    }
    try {
          const saveResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendgrid/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              api_key: sendGridApiKey,
          default_sender: selectedSender
            })
          });
          if (saveResponse.ok) {
            await updateIntegrationStatus('sendgrid', 'connected');
            setShowSendGridModal(false);
            setSendGridApiKey('');
            setAllowedSenders([]);
            setSelectedSender('');
            setValidationError('');
        setSendGridStep('validate');
            toast.success('SendGrid connected successfully!');
          } else {
            const errorData = await saveResponse.json();
            setValidationError(errorData.error || 'Failed to save SendGrid configuration.');
      }
    } catch (err) {
      setValidationError('Failed to save SendGrid configuration.');
    }
    setSendGridLoading(false);
  };

  const handleSavePhantombusterKey = async () => {
    setPhantombusterLoading(true);
    setPhantombusterError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPhantombusterLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/phantombuster/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: phantombusterApiKey, user_id: user.id })
      });
      const data = await response.json();
      if (response.ok) {
        // Update integration status
        await updateIntegrationStatus('phantombuster', 'connected');
        
        // Close modal and show success
        setShowPhantombusterModal(false);
        setPhantombusterApiKey('');
        toast.success('Phantombuster connected successfully!');
      } else {
        setPhantombusterError(data.error || 'Failed to validate API key.');
      }
    } catch (err) {
      setPhantombusterError('Error validating API key.');
    }
    setPhantombusterLoading(false);
  };

  // Optionally, handle disconnect
  const handleDisconnect = async (id) => {
    if (id === 'google') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/google/disconnect`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        if (response.ok) {
          toast.success('Google disconnected!');
          await fetchIntegrations();
        } else {
          toast.error('Failed to disconnect Google.');
        }
      } catch (err) {
        toast.error('Failed to disconnect Google.');
      }
    } else {
      await updateIntegrationStatus(id, 'not_connected');
      await fetchIntegrations();
    }
  };

  // ❶ open modal – fetch senders
  const openChangeSenderModal = async () => {
    setChangeSenderError('');
    setChangeSenderLoading(true);
    setShowChangeSenderModal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendgrid/get-senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load senders');
      if (!data.senders || !Array.isArray(data.senders)) {
        throw new Error('Invalid response format');
      }
      setChangeSenderOptions(data.senders);
      setChangeSenderSelected(data.current_sender ?? '');
    } catch (error) {
      console.error('Error loading senders:', error);
      setChangeSenderError(error.message || 'Failed to load senders');
      setChangeSenderOptions([]); // Reset to empty array on error
    } finally {
      setChangeSenderLoading(false);
    }
  };

  // ❷ save – patch default sender
  const handleSaveChangeSender = async () => {
    setChangeSenderError('');
    setChangeSenderLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      await fetch(`${BACKEND}/api/sendgrid/update-sender`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          default_sender: changeSenderSelected
        })
      });
        setShowChangeSenderModal(false);
      await updateIntegrationStatus('sendgrid', 'connected');
    } catch {
      setChangeSenderError('Failed to save sender');
    } finally {
    setChangeSenderLoading(false);
    }
  };

  // On mount, check if a cookie is already stored
  useEffect(() => {
    const checkLinkedinCookie = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Call backend to check if cookie exists
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/linkedin/check-cookie`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        const data = await response.json();
        if (response.ok && data.exists) {
          setLinkedinCookieStatus('valid');
          setLinkedinCookieStored(true);
        } else {
          setLinkedinCookieStatus('invalid');
          setLinkedinCookieStored(false);
        }
      } catch {
        setLinkedinCookieStatus('invalid');
        setLinkedinCookieStored(false);
      }
    };
    checkLinkedinCookie();
  }, []);

  const handleSaveLinkedinSessionCookie = async () => {
    setLinkedinCookieMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLinkedinCookieMessage('You must be logged in.');
      setLinkedinCookieStatus('invalid');
      return;
    }
    if (!linkedinSessionCookie) {
      setLinkedinCookieMessage('Please paste your LinkedIn session cookie');
      setLinkedinCookieStatus('invalid');
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/linkedin/save-cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, session_cookie: linkedinSessionCookie })
      });
      const data = await response.json();
      if (response.ok) {
        setLinkedinCookieStatus('valid');
        setLinkedinCookieMessage('LinkedIn session cookie saved!');
        setLinkedinSessionCookie(''); // Clear input
        setLinkedinCookieStored(true);
      } else {
        setLinkedinCookieStatus('invalid');
        setLinkedinCookieMessage(data.error || 'Failed to save session cookie');
      }
    } catch (err) {
      setLinkedinCookieStatus('invalid');
      setLinkedinCookieMessage('Error saving session cookie');
    }
  };

  // Fetch Apollo API key on mount
  useEffect(() => {
    const fetchApolloKey = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('apollo_api_key')
        .eq('user_id', user.id)
        .single();

      if (!error && data?.apollo_api_key) {
        setApolloApiKey(data.apollo_api_key);
        // Update integrations state
        setIntegrations(prev => prev.map(intg =>
          intg.id === 'apollo'
            ? { ...intg, isConnected: true, status: 'Active', date: new Date().toLocaleDateString() }
            : intg
        ));
      }
    };

    fetchApolloKey();
  }, []);

  // Function to check Apollo API key validity
  const checkApolloApiKey = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First get the API key from user_settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('apollo_api_key')
        .eq('user_id', user.id)
        .single();

      if (!settings?.apollo_api_key) {
        setApolloKeyStatus(null);
        setIntegrations(prev => prev.map(intg =>
          intg.id === 'apollo'
            ? { ...intg, apiKeyStatus: null }
            : intg
        ));
        return;
      }

      // Validate the API key
      const response = await fetch(`${BACKEND}/api/leads/apollo/validate-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ api_key: settings.apollo_api_key })
      });

      const isValid = response.ok;
      setApolloKeyStatus(isValid ? 'valid' : 'invalid');
      setIntegrations(prev => prev.map(intg =>
        intg.id === 'apollo'
          ? { ...intg, apiKeyStatus: isValid ? 'valid' : 'invalid' }
          : intg
      ));
    } catch (error) {
      console.error('Error checking Apollo API key:', error);
      setApolloKeyStatus('invalid');
      setIntegrations(prev => prev.map(intg =>
        intg.id === 'apollo'
          ? { ...intg, apiKeyStatus: 'invalid' }
          : intg
      ));
    }
  };

  // Check Apollo API key on mount and after successful connection
  useEffect(() => {
    checkApolloApiKey();
  }, []);

  // Modify handleApolloSuccess to check key status after saving
  const handleApolloSuccess = async () => {
    await checkApolloApiKey();
    setShowApolloModal(false);
  };

  // Handle Apollo disconnect
  const handleApolloDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Remove API key from user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .update({ apollo_api_key: null })
        .eq('user_id', user.id);

      if (settingsError) throw settingsError;

      // Update integrations table
      const { error: integrationError } = await supabase
        .from('integrations')
        .upsert({
          user_id: user.id,
          provider: 'apollo',
          status: 'not_connected',
          connected_at: null
        }, {
          onConflict: 'user_id,provider'
        });

      if (integrationError) throw integrationError;

      // Update local state
      setApolloApiKey('');
      setIntegrations(prev => prev.map(intg =>
        intg.id === 'apollo'
          ? { ...intg, isConnected: false, status: 'Not Connected', date: undefined }
          : intg
      ));

      toast.success('Apollo disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting Apollo:', err);
      toast.error('Failed to disconnect Apollo');
    }
  };

  if (loading) return <div className="p-6">Loading integrations...</div>;

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Connected Applications</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <FaCircle className="text-green-500" />
            <span>{integrations.filter(i => i.isConnected).length} Active Connections</span>
          </div>
        </div>
        <div className="space-y-6">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 ${integration.bgColor} rounded-lg flex items-center justify-center`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">{integration.name}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        integration.isConnected
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {integration.isConnected ? 'Active' : 'Not Connected'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {integration.isConnected
                      ? `Connected on ${integration.date}`
                      : integration.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Status Pills */}
                <div className="flex items-center space-x-2">
                  {integration.id === 'apollo' && integration.apiKeyStatus && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      integration.apiKeyStatus === 'valid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      API Key {integration.apiKeyStatus === 'valid' ? 'Valid' : 'Invalid'}
                    </div>
                  )}
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    integration.isConnected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {integration.status}
                  </div>
                  {integration.date && (
                    <span className="text-sm text-gray-500">
                      {integration.date}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {integration.isConnected ? (
                    <>
                      {integration.id === 'sendgrid' && (
                        <button
                          onClick={() => setShowChangeSenderModal(true)}
                          className="p-2 text-gray-600 hover:text-gray-900"
                        >
                          <FaGear className="text-lg" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (integration.id === 'apollo') {
                            if (integration.isConnected) {
                              // Already connected -> manage API key
                              setShowApolloModal(true);
                            } else {
                              // Not connected -> start OAuth flow
                              handleConnect('apollo');
                            }
                          } else {
                            handleDisconnect(integration.id);
                          }
                        }} 
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button type="button"
                      onClick={() => {
                        if (integration.id === 'apollo') {
                          if (integration.isConnected) {
                            // Already connected -> manage API key
                            setShowApolloModal(true);
                          } else {
                            // Not connected -> start OAuth flow
                            handleConnect('apollo');
                          }
                        } else {
                          handleConnect(integration.id);
                        }
                      }} 
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* LinkedIn Sales Navigator Integration */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mt-10 w-full max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">LinkedIn Sales Navigator</h2>
            <p className="text-gray-600 mt-2">Connect LinkedIn to automatically source leads from Sales Navigator into your campaigns.</p>
          </div>
          <FaLinkedin className="text-3xl text-[#0A66C2]" />
        </div>
        {/* LinkedIn Option Cards - stacked vertically */}
        <div className="space-y-6">
          {/* Paste LinkedIn Session Cookie */}
          <div className="flex flex-col border rounded-lg p-6 hover:border-blue-500 transition-all w-full">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <input type="radio" name="connection-method" id="cookie" className="w-4 h-4 text-blue-600" />
                <label htmlFor="cookie" className="font-medium text-gray-900">Paste LinkedIn Session Cookie</label>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  linkedinCookieStatus === 'valid'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-600'
                }`}>{linkedinCookieStatus === 'valid' ? 'Valid' : 'Invalid'}</span>
              </div>
              <p className="text-gray-600 mb-4">Paste your active LinkedIn li_at session cookie to let us securely access Sales Navigator on your behalf.</p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Paste your li_at cookie here"
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={linkedinSessionCookie}
                  onChange={e => setLinkedinSessionCookie(e.target.value)}
                />
                <button
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center space-x-2"
                  onClick={handleSaveLinkedinSessionCookie}
                >
                  <FaFloppyDisk />
                  <span>Save Cookie</span>
                </button>
              </div>
            </div>
            {linkedinCookieMessage && (
              <div className={`mt-2 text-sm ${linkedinCookieStatus === 'valid' ? 'text-green-600' : 'text-red-600'}`}>{linkedinCookieMessage}</div>
            )}
            {linkedinCookieStored && (
              <div className="mt-4 text-green-700 text-sm font-medium">A LinkedIn session cookie is already stored for your account.</div>
            )}
          </div>
        </div>
        {/* Security Notice */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg flex items-start space-x-3">
          <FaShieldHalved className="text-gray-400 mt-1" />
          <p className="text-sm text-gray-600">
            Your security is our priority. HirePilot only uses your LinkedIn access to search for leads. We never post, message, or interact on your behalf.
            <span className="text-blue-600 hover:underline cursor-pointer"> Learn more about our security measures</span>
          </p>
        </div>
      </div>
      {/* SendGrid API Key Modal */}
      {showSendGridModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Connect SendGrid</h3>
            <p className="mb-2 text-gray-600 text-sm">
              Paste your SendGrid API key below. You can create one in your SendGrid dashboard under Settings &gt; API Keys.
            </p>
            {sendGridStep === 'validate' && (
              <>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="SendGrid API Key"
              value={sendGridApiKey}
              onChange={e => setSendGridApiKey(e.target.value)}
              autoFocus
            />
            {validationError && <p className="text-red-500 text-sm mb-4">{validationError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowSendGridModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={sendGridLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleValidateSendGridKey}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    disabled={sendGridLoading || !sendGridApiKey}
                  >
                    {sendGridLoading ? 'Validating...' : 'Validate Key'}
                  </button>
                </div>
              </>
            )}
            {sendGridStep === 'chooseSender' && (
              <>
            {allowedSenders.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Sender</label>
                <select
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSender}
                  onChange={e => setSelectedSender(e.target.value)}
                >
                  {allowedSenders.map(sender => (
                    <option key={sender.email} value={sender.email}>{sender.email}</option>
                  ))}
                </select>
              </div>
            )}
                {validationError && <p className="text-red-500 text-sm mb-4">{validationError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSendGridModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={sendGridLoading}
              >
                Cancel
              </button>
              <button
                    onClick={handleSaveSendGridSender}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    disabled={sendGridLoading || !selectedSender}
              >
                    {sendGridLoading ? 'Saving...' : 'Save Sender'}
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Phantombuster Modal */}
      {showPhantombusterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Connect PhantomBuster</h3>
            <p className="mb-2 text-gray-600 text-sm">Paste your PhantomBuster API key below. You can find this in your PhantomBuster dashboard under Settings &gt; API Keys.</p>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="PhantomBuster API Key"
              value={phantombusterApiKey}
              onChange={e => setPhantombusterApiKey(e.target.value)}
              autoFocus
            />
            {phantombusterError && <p className="text-red-500 text-sm mb-4">{phantombusterError}</p>}
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => setShowPhantombusterModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleSavePhantombusterKey}
                disabled={phantombusterLoading || !phantombusterApiKey}
              >
                {phantombusterLoading ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Change Sender Modal */}
      {showChangeSenderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Change SendGrid Sender</h3>
            {changeSenderLoading ? (
              <div className="text-gray-500">Loading senders...</div>
            ) : changeSenderError ? (
              <div className="text-red-500 mb-4">{changeSenderError}</div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Sender</label>
                <select
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  value={changeSenderSelected}
                  onChange={e => setChangeSenderSelected(e.target.value)}
                >
                  {changeSenderOptions.map(sender => (
                    <option key={sender.email} value={sender.email}>{sender.email}</option>
                  ))}
                </select>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowChangeSenderModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={changeSenderLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChangeSender}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                disabled={changeSenderLoading || !changeSenderSelected}
              >
                {changeSenderLoading ? 'Saving...' : 'Save Sender'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Apollo API Key Modal */}
      <ApolloApiKeyModal
        isOpen={showApolloModal}
        onClose={() => setShowApolloModal(false)}
        onSuccess={handleApolloSuccess}
        currentApiKey={apolloApiKey}
      />
    </div>
  );
}
