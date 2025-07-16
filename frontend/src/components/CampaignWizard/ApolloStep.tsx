import React, { useState, useEffect } from 'react';
import { useWizard } from '../../context/WizardContext';
import { supabase } from '../../lib/supabase';
import Papa from 'papaparse';

// Location suggestion type (keeping as comment for reference)
// interface LocationSuggestion {
//   id: string;
//   text: string;
//   country?: string;
// }

// Lead type (keeping as comment for reference)  
// interface Lead {
//   id: string;
//   firstName: string;
//   lastName: string;
//   email?: string | null;
//   emailStatus: string;
//   title?: string;
//   company?: string;
//   linkedinUrl?: string;
//   location?: string;
//   isGdprLocked: boolean;
// }

// Props type (keeping as comment for reference)
// interface ApolloStepProps {
//   onLeadsSelected: (leads: Lead[]) => void;
//   defaultJobTitle?: string;
//   defaultKeywords?: string;
//   defaultLocation?: string;
// }

const LOCATION_SUGGESTIONS = [
  { id: 'us', text: 'United States', country: 'US' },
  { id: 'uk', text: 'United Kingdom', country: 'GB' },
  { id: 'ca', text: 'Canada', country: 'CA' },
  { id: 'au', text: 'Australia', country: 'AU' },
  { id: 'de', text: 'Germany', country: 'DE' },
  { id: 'fr', text: 'France', country: 'FR' },
  { id: 'in', text: 'India', country: 'IN' },
  { id: 'sg', text: 'Singapore', country: 'SG' },
  { id: 'hk', text: 'Hong Kong', country: 'HK' },
  { id: 'jp', text: 'Japan', country: 'JP' },
  { id: 'nl', text: 'Netherlands', country: 'NL' },
  { id: 'se', text: 'Sweden', country: 'SE' },
  { id: 'ch', text: 'Switzerland', country: 'CH' },
  { id: 'it', text: 'Italy', country: 'IT' },
  { id: 'es', text: 'Spain', country: 'ES' },
  { id: 'br', text: 'Brazil', country: 'BR' },
  { id: 'mx', text: 'Mexico', country: 'MX' },
  { id: 'ar', text: 'Argentina', country: 'AR' },
  { id: 'cl', text: 'Chile', country: 'CL' },
  { id: 'co', text: 'Colombia', country: 'CO' },
  { id: 'pe', text: 'Peru', country: 'PE' },
  { id: 'za', text: 'South Africa', country: 'ZA' },
  { id: 'ng', text: 'Nigeria', country: 'NG' },
  { id: 'ke', text: 'Kenya', country: 'KE' },
  { id: 'eg', text: 'Egypt', country: 'EG' },
  { id: 'ae', text: 'United Arab Emirates', country: 'AE' },
  { id: 'sa', text: 'Saudi Arabia', country: 'SA' },
  { id: 'il', text: 'Israel', country: 'IL' },
  { id: 'tr', text: 'Turkey', country: 'TR' },
  { id: 'ru', text: 'Russia', country: 'RU' },
  { id: 'ua', text: 'Ukraine', country: 'UA' },
  { id: 'pl', text: 'Poland', country: 'PL' },
  { id: 'cz', text: 'Czech Republic', country: 'CZ' },
  { id: 'hu', text: 'Hungary', country: 'HU' },
  { id: 'ro', text: 'Romania', country: 'RO' },
  { id: 'bg', text: 'Bulgaria', country: 'BG' },
  { id: 'hr', text: 'Croatia', country: 'HR' },
  { id: 'si', text: 'Slovenia', country: 'SI' },
  { id: 'sk', text: 'Slovakia', country: 'SK' },
  { id: 'lt', text: 'Lithuania', country: 'LT' },
  { id: 'lv', text: 'Latvia', country: 'LV' },
  { id: 'ee', text: 'Estonia', country: 'EE' },
  { id: 'fi', text: 'Finland', country: 'FI' },
  { id: 'no', text: 'Norway', country: 'NO' },
  { id: 'dk', text: 'Denmark', country: 'DK' },
  { id: 'is', text: 'Iceland', country: 'IS' },
  { id: 'ie', text: 'Ireland', country: 'IE' },
  { id: 'pt', text: 'Portugal', country: 'PT' },
  { id: 'gr', text: 'Greece', country: 'GR' },
  { id: 'cy', text: 'Cyprus', country: 'CY' },
  { id: 'mt', text: 'Malta', country: 'MT' },
  { id: 'lu', text: 'Luxembourg', country: 'LU' },
  { id: 'be', text: 'Belgium', country: 'BE' },
  { id: 'at', text: 'Austria', country: 'AT' },
  { id: 'li', text: 'Liechtenstein', country: 'LI' },
  { id: 'mc', text: 'Monaco', country: 'MC' },
  { id: 'sm', text: 'San Marino', country: 'SM' },
  { id: 'va', text: 'Vatican City', country: 'VA' },
  { id: 'ad', text: 'Andorra', country: 'AD' },
  { id: 'cn', text: 'China', country: 'CN' },
  { id: 'kr', text: 'South Korea', country: 'KR' },
  { id: 'tw', text: 'Taiwan', country: 'TW' },
  { id: 'th', text: 'Thailand', country: 'TH' },
  { id: 'vn', text: 'Vietnam', country: 'VN' },
  { id: 'my', text: 'Malaysia', country: 'MY' },
  { id: 'id', text: 'Indonesia', country: 'ID' },
  { id: 'ph', text: 'Philippines', country: 'PH' },
  { id: 'bd', text: 'Bangladesh', country: 'BD' },
  { id: 'pk', text: 'Pakistan', country: 'PK' },
  { id: 'lk', text: 'Sri Lanka', country: 'LK' },
  { id: 'np', text: 'Nepal', country: 'NP' },
  { id: 'bt', text: 'Bhutan', country: 'BT' },
  { id: 'mv', text: 'Maldives', country: 'MV' },
  { id: 'af', text: 'Afghanistan', country: 'AF' },
  { id: 'ir', text: 'Iran', country: 'IR' },
  { id: 'iq', text: 'Iraq', country: 'IQ' },
  { id: 'sy', text: 'Syria', country: 'SY' },
  { id: 'lb', text: 'Lebanon', country: 'LB' },
  { id: 'jo', text: 'Jordan', country: 'JO' },
  { id: 'kw', text: 'Kuwait', country: 'KW' },
  { id: 'qa', text: 'Qatar', country: 'QA' },
  { id: 'bh', text: 'Bahrain', country: 'BH' },
  { id: 'om', text: 'Oman', country: 'OM' },
  { id: 'ye', text: 'Yemen', country: 'YE' },
  { id: 'kz', text: 'Kazakhstan', country: 'KZ' },
  { id: 'kg', text: 'Kyrgyzstan', country: 'KG' },
  { id: 'tj', text: 'Tajikistan', country: 'TJ' },
  { id: 'tm', text: 'Turkmenistan', country: 'TM' },
  { id: 'uz', text: 'Uzbekistan', country: 'UZ' },
  { id: 'mn', text: 'Mongolia', country: 'MN' },
  { id: 'by', text: 'Belarus', country: 'BY' },
  { id: 'md', text: 'Moldova', country: 'MD' },
  { id: 'am', text: 'Armenia', country: 'AM' },
  { id: 'az', text: 'Azerbaijan', country: 'AZ' },
  { id: 'ge', text: 'Georgia', country: 'GE' },
];

const mockSearchResults = [
  {
    id: 'mock1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@tech.com',
    emailStatus: 'valid',
    title: 'Senior Software Engineer',
    company: 'Tech Corp',
    linkedinUrl: 'https://linkedin.com/in/johnsmith',
    location: 'San Francisco, CA',
    isGdprLocked: false,
  },
  // ... rest of mock data
];

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
      if (!error && data.session) {
        res = await doFetch(data.session.access_token);
      }
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

  // Handle save button click
  const handleSaveClick = async () => {
    try {
      if (selectedLeads.length === 0) {
        toast.error('Please select at least one lead before proceeding.');
        return;
      }

      // Get selected lead objects
      const selectedLeadObjects = leads.filter(lead => selectedLeads.includes(lead.id));
      
      // Update wizard state once
      await new Promise(resolve => {
        setWizard(prev => {
          const newState = {
            ...prev,
            selectedLeads,
            leads: selectedLeadObjects,
            numLeads: selectedLeadObjects.length,
            step: 5 // Explicitly set the step to move to step 5
          };
          resolve();
          return newState;
        });
      });

      // Call parent handler
      onLeadsSelected(selectedLeadObjects);
    } catch (err) {
      console.error('[ApolloStep] Error saving leads:', err);
      toast.error('Failed to save selected leads. Please try again.');
    }
  };

  const handleSearch = async () => {
    if (!jobTitleInput && !keywordsInput && !locationInput) {
      setError('Please enter at least one search criteria');
      return;
    }

    console.log('Starting search...');
    setIsSearching(true);
    setSearchCompleted(false);
    setLeads([]);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      console.log('Making search request...', {
        jobTitle: jobTitleInput,
        keywords: keywordsInput,
        location: locationInput,
        campaignId: wizard.campaign?.id
      });

      const response = await fetch(`${BACKEND}/api/leads/apollo/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          jobTitle: jobTitleInput,
          keywords: keywordsInput,
          location: locationInput,
          campaignId: wizard.campaign?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Search error response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to search leads');
      }

      const data = await response.json();
      console.log('Search results:', data);
      
      if (!data.leads || !Array.isArray(data.leads)) {
        throw new Error('Invalid response format');
      }

      setLeads(data.leads);
      setSearchCompleted(true);
      
      if (data.leads.length === 0) {
        toast('No leads found matching your criteria. Try adjusting your search terms.');
      } else {
        toast.success(`Found ${data.leads.length} leads! Select the ones you want to add to your campaign.`);
      }
      
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
        setIsKeyValid(null);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setIsKeyValid(null);
    }
  };

  useEffect(() => {
    console.log('Component mounted, checking for existing key');
    checkExistingKey();
  }, []);

  return (
    <div className="space-y-6">
      {/* Search Loading Modal */}
      <SearchLoadingModal 
        isOpen={isSearching} 
        onClose={() => {
          setIsSearching(false);
          toast.error('Search cancelled');
        }} 
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700">
            Job Title
          </label>
          <input
            type="text"
            id="jobTitle"
            disabled={isSearching}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              isSearching ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            placeholder="e.g. Software Engineer"
            value={jobTitleInput}
            onChange={(e) => setJobTitleInput(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
            Keywords
          </label>
          <input
            type="text"
            id="keywords"
            disabled={isSearching}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              isSearching ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
            placeholder="e.g. React, TypeScript"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <div className="relative">
            <input
              type="text"
              id="location"
              disabled={isSearching}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                isSearching ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              placeholder="e.g. San Francisco, CA"
              value={locationInput}
              onChange={handleLocationInputChange}
              onFocus={() => {
                if (locationInput.trim().length >= 2) {
                  handleLocationInputChange({ target: { value: locationInput } });
                }
              }}
            />
            {isLoadingSuggestions && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
            {showSuggestions && locationSuggestions.length > 0 && !isSearching && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {locationSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-blue-50"
                    onClick={() => handleLocationSelect(suggestion)}
                  >
                    <div className="flex items-center">
                      <span className="truncate">{suggestion.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
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
          <div className="rounded-md bg-red-50 p-4">
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
          <div className="rounded-md bg-green-50 p-4">
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
                      <thead>
                        <tr>
                          <th scope="col" className="relative py-3.5 pl-4 pr-3 sm:pl-6">
                            <input
                              type="checkbox"
                              className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={selectedLeads.length === leads.length && leads.length > 0}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                          </th>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Company</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Location</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">LinkedIn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {leads.map((lead) => (
                          <tr key={lead.id}>
                            <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                              <input
                                type="checkbox"
                                className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => handleSelectLead(lead.id)}
                              />
                            </td>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {lead.firstName} {lead.lastName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lead.title}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lead.company}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{lead.location}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {lead.emailStatus === 'gdpr_locked' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  GDPR Protected
                                </span>
                              ) : lead.email || '••••@••••.•••'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
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