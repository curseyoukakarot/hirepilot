import React, { useState, useEffect, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import ApolloApiKeyModal from '../ApolloApiKeyModal';
import debounce from 'lodash/debounce';
import { Loader2, Search, CheckCircle } from 'lucide-react';

// Loading Modal Component
const SearchLoadingModal = ({ isOpen, onClose }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Connecting to Apollo...');

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setCurrentStep('Connecting to Apollo...');
      return;
    }

    const steps = [
      'Connecting to Apollo...',
      'Processing search criteria...',
      'Searching lead database...',
      'Enriching lead data...',
      'Finalizing results...'
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 15 + 5;
        if (newProgress >= 95) {
          clearInterval(interval);
          return 95;
        }
        
        // Update step based on progress
        const stepIndex = Math.floor((newProgress / 100) * steps.length);
        setCurrentStep(steps[Math.min(stepIndex, steps.length - 1)]);
        
        return newProgress;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Search className="h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Searching Apollo Database
          </h3>
          
          <div className="mb-4">
            <div className="flex items-center justify-center mb-2">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
              <span className="text-sm text-gray-600">{currentStep}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}% complete</div>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            This usually takes 5-15 seconds depending on search criteria.
          </p>
          
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel search
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ApolloStep({ onLeadsSelected, defaultJobTitle, defaultKeywords, defaultLocation }) {
  const { wizard, setWizard } = useWizard();
  const [jobTitleInput, setJobTitleInput] = useState(defaultJobTitle || '');
  const [keywordsInput, setKeywordsInput] = useState(defaultKeywords || '');
  const [locationInput, setLocationInput] = useState(defaultLocation || '');
  const [apiKey, setApiKey] = useState('');
  const [isKeyValid, setIsKeyValid] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(wizard.selectedLeads || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const numLeads = wizard?.numLeads || 100;
  const BACKEND = import.meta.env.VITE_BACKEND_URL;
  const [isSearching, setIsSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);

  // add fetch helper
  const fetchWithAuth = async (supabaseClient, url, options = {}) => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    const doFetch = async (jwt) => {
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        credentials: 'include'
      });
    };
    let res = await doFetch(token);
    if (res.status === 401) {
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (!error && data.session) res = await doFetch(data.session.access_token);
    }
    return res;
  };

  // Select/Deselect all leads
  const handleSelectAll = (checked) => {
    const newSelectedLeads = checked ? leads.map(lead => lead.id) : [];
    setSelectedLeads(newSelectedLeads);
  };

  // Select/Deselect individual lead
  const handleSelectLead = (leadId) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  // Save selected leads and proceed
  const handleSaveClick = async () => {
    const selectedLeadObjects = leads.filter(lead => selectedLeads.includes(lead.id));
    
    if (selectedLeadObjects.length === 0) {
      toast.error('Please select at least one lead before proceeding.');
      return;
    }

    try {
      // Update wizard state once
      await new Promise(resolve => {
        setWizard(prev => {
          const newState = {
            ...prev,
            leads: selectedLeadObjects,
            selectedLeads: selectedLeads,
            numLeads: selectedLeadObjects.length,
            step: 5 // Explicitly set the step to move to step 5
          };
          resolve();
          return newState;
        });
      });

      // Wait a bit for state to settle before navigation
      setTimeout(() => {
        onLeadsSelected(selectedLeadObjects);
      }, 100);
    } catch (err) {
      console.error('[ApolloStep] Error updating wizard state:', err);
      toast.error('Failed to save selected leads. Please try again.');
    }
  };

  // Search function
  const handleSearch = async () => {
    if (!keywordsInput.trim()) {
      setError('Please enter a job title');
      toast.error('Please enter a job title');
      return;
    }

    if (!isKeyValid) {
      setShowApiKeyModal(true);
      return;
    }

    setIsSearching(true);
    setError('');
    setSearchCompleted(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const searchPayload = {
        job_title: jobTitleInput.trim(),
        keywords: keywordsInput.trim(),
        location: locationInput.trim(),
        num_leads: numLeads
      };

      console.log('[ApolloStep] Searching with payload:', searchPayload);

      const response = await fetchWithAuth(supabase, `${BACKEND}/api/leads/apollo/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[ApolloStep] Search response:', data);

      if (!data.leads || !Array.isArray(data.leads)) {
        throw new Error('Invalid response format from search API');
      }

      setLeads(data.leads);
      setSelectedLeads(data.leads.map(lead => lead.id));
      setSearchCompleted(true);
      
      // Update wizard state
      setWizard(prev => ({
        ...prev,
        campaign: {
          id: prev.campaign?.id || '',
          ...prev.campaign,
          title: jobTitleInput,
          keywords: keywordsInput,
          location: locationInput
        }
      }));
    } catch (err) {
      console.error('Search error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to search leads';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApiKeySuccess = async () => {
    await checkExistingKey();
    if (isKeyValid) {
      handleSearch();
    }
  };

  const handleLocationInputChange = async (e) => {
    const value = e.target.value;
    setLocationInput(value);
    
    if (value.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${BACKEND}/api/leads/apollo/locations?q=${encodeURIComponent(value)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch location suggestions');
      }

      const data = await response.json();
      setLocationSuggestions(data.locations || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error fetching location suggestions:', err);
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleLocationSelect = (suggestion) => {
    setLocationInput(suggestion.name);
    setShowSuggestions(false);
  };

  // Check for existing API key and validate it on mount
  const checkExistingKey = async () => {
    console.log('Checking for existing API key...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      console.log('Fetching settings from backend...');
      const response = await fetch(`${BACKEND}/api/user/settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      console.log('Settings response:', data);

      // We have either an API key or OAuth connection
      if (data.apollo_api_key || data.apollo_connected) {
        console.log('Found Apollo credentials');
        if (data.apollo_api_key) {
          setApiKey(data.apollo_api_key);
        }
        setIsKeyValid(true);
      } else {
        console.log('No Apollo credentials found');
        setIsKeyValid(false);
      }
    } catch (err) {
      console.error('Error checking existing key:', err);
      setIsKeyValid(false);
    }
  };

  useEffect(() => {
    checkExistingKey();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Search Apollo Database
          </h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="job-title" className="block text-sm font-medium text-gray-700">
                Keywords
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="job-title"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="e.g. React, Node.js, Python"
                  value={jobTitleInput}
                  onChange={(e) => setJobTitleInput(e.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="location"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="e.g. San Francisco, CA"
                  value={locationInput}
                  onChange={handleLocationInputChange}
                  onFocus={() => {
                    if (locationInput.trim().length >= 2) {
                      handleLocationInputChange({ target: { value: locationInput } });
                    }
                  }}
                />
              </div>
              
              {/* Location Suggestions Dropdown */}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                  {locationSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-600 hover:text-white"
                      onClick={() => handleLocationSelect(suggestion)}
                    >
                      <span className="block truncate">{suggestion.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
              Job Title *
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="keywords"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="e.g. Director of Product Management"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-all ${
                isSearching 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isSearching ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="-ml-1 mr-2 h-4 w-4" />
                  Search Leads
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mt-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Success Message */}
          {searchCompleted && leads.length > 0 && (
            <div className="rounded-md bg-green-50 p-4 mt-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Search Completed!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Found {leads.length} leads matching your criteria. Select the ones you want to add to your campaign.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {leads.length > 0 && (
            <div className="mt-8">
              <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                  <h1 className="text-xl font-semibold text-gray-900">Found Leads</h1>
                  <p className="mt-2 text-sm text-gray-700">
                    Select the leads you want to add to your campaign.
                  </p>
                </div>
                <div className="sm:flex-none">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      <span className="ml-2 text-sm text-gray-700">Select All</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveClick}
                      disabled={selectedLeads.length === 0}
                      className={`
                        inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
                        ${selectedLeads.length === 0 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'
                        }
                      `}
                    >
                      Save Selected Leads ({selectedLeads.length})
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                              <input
                                type="checkbox"
                                className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 sm:left-6"
                                checked={selectedLeads.length === leads.length && leads.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                              />
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Title
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Company
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Location
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Email
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              LinkedIn
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {leads.map((lead) => (
                            <tr key={lead.id} className={selectedLeads.includes(lead.id) ? 'bg-gray-50' : ''}>
                              <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                                <input
                                  type="checkbox"
                                  className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 sm:left-6"
                                  checked={selectedLeads.includes(lead.id)}
                                  onChange={() => handleSelectLead(lead.id)}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {lead.firstName} {lead.lastName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {lead.title}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {lead.company}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {lead.location}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {lead.emailStatus === 'gdpr_locked' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    GDPR Protected
                                  </span>
                                ) : lead.email || '••••@••••.•••'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {lead.linkedinUrl && (
                                  <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                    View Profile
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search Loading Modal */}
      <SearchLoadingModal isOpen={isSearching} onClose={() => setIsSearching(false)} />

      {/* API Key Modal */}
      {showApiKeyModal && (
        <ApolloApiKeyModal
          isOpen={showApiKeyModal}
          onClose={() => setShowApiKeyModal(false)}
          onSuccess={handleApiKeySuccess}
          currentApiKey={apiKey}
        />
      )}
    </div>
  );
} 