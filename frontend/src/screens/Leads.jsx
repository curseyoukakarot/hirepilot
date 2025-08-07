console.log("!!! THIS IS THE ACTIVE LEADS.JSX FILE !!!");
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CsvImportButton from '../components/leads/CsvImportButton';
import { supabase } from '../lib/supabase';
import { Toaster, toast } from 'react-hot-toast';
import { FaPlus, FaSearch, FaFilter, FaDownload } from 'react-icons/fa';
import { downloadCSV } from '../utils/csvExport';
import { useCampaignOptions } from '../hooks/useCampaignOptions';

// LinkedIn Status Pill Component
function LinkedInStatusPill({ lead }) {
  // Find the most recent LinkedIn outreach request for this lead
  const linkedInRequests = lead.linkedin_outreach_queue || [];
  
  if (linkedInRequests.length === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        No Request
      </span>
    );
  }

  // Sort by created_at to get the most recent request
  const mostRecentRequest = linkedInRequests.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )[0];

  const status = mostRecentRequest.status;
  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return {
          text: 'Queued',
          className: 'bg-yellow-100 text-yellow-800',
          icon: '⏳'
        };
      case 'sent':
        return {
          text: 'Sent',
          className: 'bg-green-100 text-green-800',
          icon: '✅'
        };
      case 'failed':
        return {
          text: 'Failed',
          className: 'bg-red-100 text-red-800',
          icon: '❌'
        };
      default:
        return {
          text: 'Unknown',
          className: 'bg-gray-100 text-gray-800',
          icon: '❓'
        };
    }
  };

  const { text, className, icon } = getStatusDisplay();
  
  // Build tooltip with more details
  const tooltip = [
    `Status: ${text}`,
    mostRecentRequest.sent_at ? `Sent: ${new Date(mostRecentRequest.sent_at).toLocaleDateString()}` : null,
    mostRecentRequest.scheduled_at ? `Scheduled: ${new Date(mostRecentRequest.scheduled_at).toLocaleDateString()}` : null,
    linkedInRequests.length > 1 ? `Total requests: ${linkedInRequests.length}` : null
  ].filter(Boolean).join(' • ');
  
  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      title={tooltip}
    >
      <span className="mr-1">{icon}</span>
      {text}
    </span>
  );
}

export default function Leads() {
  console.log('Leads component rendered');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Campaign filtering state
  const [selectedCampaignId, setSelectedCampaignId] = useState('all');
  const [selectedCampaignName, setSelectedCampaignName] = useState('');
  const { options: campaignOptions, loading: campaignsLoading, error: campaignsError } = useCampaignOptions();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 50;

  // Bulk tagging state
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [isBulkTagging, setIsBulkTagging] = useState(false);

  // LinkedIn guidance state - remember user preference
  const [showLinkedInGuidance, setShowLinkedInGuidance] = useState(() => {
    const dismissed = localStorage.getItem('linkedinGuidanceDismissed');
    return dismissed !== 'true';
  });

  const fetchLeads = async (campaignId = selectedCampaignId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Build query with optional campaign filter
      let query = supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id);
      
      // Add campaign filter if a specific campaign is selected
      if (campaignId && campaignId !== 'all') {
        query = query.eq('campaign_id', campaignId);
      }
      
      const { data: leadsData, error: leadsError } = await query
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch LinkedIn outreach statuses for this user
      const { data: linkedinData, error: linkedinError } = await supabase
        .from('linkedin_outreach_queue')
        .select('linkedin_url, status, scheduled_at, sent_at, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (linkedinError) throw linkedinError;

      // Merge LinkedIn status into leads data
      const leadsWithLinkedInStatus = leadsData.map(lead => {
        // Find LinkedIn outreach requests for this lead's LinkedIn URL
        const linkedinRequests = linkedinData.filter(req => 
          req.linkedin_url === lead.linkedin_url
        );
        
        return {
          ...lead,
          linkedin_outreach_queue: linkedinRequests
        };
      });

      console.log('Fetched leads with LinkedIn status:', leadsWithLinkedInStatus);
      setLeads(leadsWithLinkedInStatus || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize state from URL params on mount
  useEffect(() => {
    const campaignId = searchParams.get('campaignId');
    const campaignName = searchParams.get('campaignName');
    
    if (campaignId && campaignId !== 'all') {
      setSelectedCampaignId(campaignId);
      if (campaignName) {
        setSelectedCampaignName(decodeURIComponent(campaignName));
      }
    } else {
      setSelectedCampaignId('all');
      setSelectedCampaignName('');
    }
  }, [searchParams]);

  // Fetch leads when campaign selection changes
  useEffect(() => {
    fetchLeads(selectedCampaignId);
  }, [selectedCampaignId]);

  // Validate campaign ID after campaign options load
  useEffect(() => {
    if (!campaignsLoading && campaignOptions.length > 0 && selectedCampaignId !== 'all') {
      const isValidCampaign = campaignOptions.some(c => c.id === selectedCampaignId);
      if (!isValidCampaign) {
        // Campaign ID is invalid or inaccessible, fall back to "All Campaigns"
        console.warn('Invalid or inaccessible campaign ID, falling back to All Campaigns');
        handleCampaignChange('all');
      }
    }
  }, [campaignsLoading, campaignOptions, selectedCampaignId]);

  // Auto-refresh leads every 30 seconds to show LinkedIn status updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchLeads(selectedCampaignId);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [selectedCampaignId]);

  // Handle campaign filter change
  const handleCampaignChange = (campaignId) => {
    setSelectedCampaignId(campaignId);
    
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (campaignId === 'all') {
      // Remove campaign params for "All Campaigns"
      newSearchParams.delete('campaignId');
      newSearchParams.delete('campaignName');
      setSelectedCampaignName('');
    } else {
      // Set campaign params for specific campaign
      const campaign = campaignOptions.find(c => c.id === campaignId);
      newSearchParams.set('campaignId', campaignId);
      if (campaign?.name) {
        newSearchParams.set('campaignName', encodeURIComponent(campaign.name));
        setSelectedCampaignName(campaign.name);
      }
    }
    
    // Update URL (replace, not push, to avoid adding to history)
    setSearchParams(newSearchParams, { replace: true });
  };

  const handleMessageAgain = (lead) => {
    localStorage.setItem('selectedLead', JSON.stringify(lead));
    navigate('/messaging');
  };

  const handleSelectLead = (leadId) => {
    console.log('Selecting lead:', leadId);
    setSelectedLeads(prev => {
      const newSelection = prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId];
      console.log('New selection:', newSelection);
      return newSelection;
    });
  };

  // Calculate current page leads
  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const endIndex = startIndex + LEADS_PER_PAGE;
  const currentPageLeads = leads.slice(startIndex, endIndex);
  const totalPages = Math.ceil(leads.length / LEADS_PER_PAGE);

  // Check if all leads on current page are selected
  const currentPageLeadIds = currentPageLeads.map(lead => lead.id);
  const currentPageSelectedCount = selectedLeads.filter(id => currentPageLeadIds.includes(id)).length;
  const isCurrentPageFullySelected = currentPageLeads.length > 0 && currentPageSelectedCount === currentPageLeads.length;

  const handleSelectAll = () => {
    console.log('Select all clicked, current state:', isCurrentPageFullySelected);
    if (isCurrentPageFullySelected) {
      // Deselect all leads on current page
      const currentPageLeadIds = currentPageLeads.map(lead => lead.id);
      setSelectedLeads(prev => prev.filter(id => !currentPageLeadIds.includes(id)));
    } else {
      // Select all leads on current page (and keep any previously selected leads from other pages)
      const currentPageLeadIds = currentPageLeads.map(lead => lead.id);
      setSelectedLeads(prev => [...new Set([...prev, ...currentPageLeadIds])]);
    }
  };

  const handleExportLeads = () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead to export');
      return;
    }
    
    const selectedLeadsData = leads.filter(lead => selectedLeads.includes(lead.id));
    const csvData = selectedLeadsData.map(lead => ({
      'Name': `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
      'Email': lead.email || '',
      'Company': lead.company || '',
      'Title': lead.title || '',
      'Phone': lead.phone || '',
      'LinkedIn': lead.linkedin_url || '',
      'Status': lead.status || '',
      'Created': new Date(lead.created_at).toLocaleDateString(),
    }));
    
    downloadCSV(csvData, `leads-export-${new Date().toISOString().split('T')[0]}`);
    setShowExportModal(false);
  };

  // Bulk tag handler
  const handleBulkTag = async () => {
    const tagToAdd = bulkTagInput.trim();
    if (!tagToAdd) {
      toast.error('Please enter a tag');
      return;
    }

    setIsBulkTagging(true);
    try {
      const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;
      const promises = selectedLeads.map(async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        // Check if tag already exists
        if ((lead.tags || []).includes(tagToAdd)) {
          return { leadId, success: true, message: 'Tag already exists' };
        }

        const newTags = [...(lead.tags || []), tagToAdd];
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tags: newTags }),
          credentials: 'include',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to add tag' }));
          throw new Error(errorData.error || 'Failed to add tag');
        }
        
        return { leadId, success: true, newTags };
      });

      const results = await Promise.allSettled(promises);
      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        const leadId = selectedLeads[index];
        if (result.status === 'fulfilled' && result.value?.success) {
          successCount++;
          if (result.value.newTags) {
            // Update local state
            setLeads(prevLeads => 
              prevLeads.map(l => 
                l.id === leadId ? { ...l, tags: result.value.newTags } : l
              )
            );
          }
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        toast.success(`Tag "${tagToAdd}" added to ${successCount} lead(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to add tag to ${errorCount} lead(s)`);
      }

      setShowBulkTagModal(false);
      setBulkTagInput('');
    } catch (error) {
      console.error('Error bulk tagging leads:', error);
      toast.error(error.message || 'Failed to add tags');
    } finally {
      setIsBulkTagging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and organize your leads</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeads}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              disabled={loading}
              title="Refresh leads and LinkedIn status"
            >
              <i className={`fa-solid fa-refresh ${loading ? 'fa-spin' : ''}`}></i>
              Refresh
            </button>
            <CsvImportButton onImportComplete={fetchLeads} />
          </div>
        </div>

        {/* Campaign Filter */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FaFilter className="text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Filter by Campaign:</label>
            </div>
            <div className="flex-1 max-w-md">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                value={selectedCampaignId}
                onChange={(e) => handleCampaignChange(e.target.value)}
                disabled={campaignsLoading}
              >
                <option value="all">
                  {campaignsLoading ? 'Loading campaigns...' : 'All Campaigns'}
                </option>
                {!campaignsLoading && campaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                    {campaign.status && (
                      <span className="text-gray-500"> ({campaign.status})</span>
                    )}
                  </option>
                ))}
              </select>
              {campaignsError && (
                <p className="mt-1 text-sm text-red-600">
                  Error loading campaigns: {campaignsError}
                </p>
              )}
            </div>
            {selectedCampaignId !== 'all' && (
              <button
                onClick={() => handleCampaignChange('all')}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
              >
                <i className="fa-solid fa-times"></i>
                Clear Filter
              </button>
            )}
          </div>
          {selectedCampaignId !== 'all' && selectedCampaignName && (
            <div className="mt-2 text-sm text-gray-600">
              Showing leads for: <span className="font-medium">{selectedCampaignName}</span>
            </div>
          )}
        </div>

        {/* LinkedIn Guidance Banner */}
        {showLinkedInGuidance && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <i className="fa-brands fa-linkedin text-blue-600 text-xl"></i>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  LinkedIn Connection Request Guidelines
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p className="mb-2">
                    <strong>Daily Safe Limit:</strong> Maximum 10 connection requests per day to maintain account safety
                  </p>
                  <p className="mb-2">
                    <strong>Status Tracking:</strong> Monitor request status in the "LinkedIn" column - 
                    <span className="mx-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⏳ Queued</span>
                    requests are processed automatically every 5 minutes
                  </p>
                  <p className="mb-2">
                    <strong>Best Practice:</strong> Add personal messages to increase connection acceptance rates
                  </p>
                  {(() => {
                    // Calculate status counts across all leads
                    const statusCounts = leads.reduce((counts, lead) => {
                      const linkedInRequests = lead.linkedin_outreach_queue || [];
                      linkedInRequests.forEach(request => {
                        counts[request.status] = (counts[request.status] || 0) + 1;
                      });
                      return counts;
                    }, {});

                    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
                    
                    if (total > 0) {
                      return (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="font-medium">Current Status:</span>
                          {statusCounts.pending && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                              ⏳ {statusCounts.pending} Queued
                            </span>
                          )}
                          {statusCounts.sent && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
                              ✅ {statusCounts.sent} Sent
                            </span>
                          )}
                          {statusCounts.failed && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800">
                              ❌ {statusCounts.failed} Failed
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => {
                    setShowLinkedInGuidance(false);
                    localStorage.setItem('linkedinGuidanceDismissed', 'true');
                  }}
                  className="bg-blue-100 text-blue-600 hover:bg-blue-200 rounded p-1"
                  title="Dismiss guidance"
                >
                  <i className="fa-solid fa-times text-sm"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedLeads.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="text-sm text-gray-600">
                {selectedLeads.length} leads selected
              </div>
              <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Message</button>
              <button 
                className={`px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 ${selectedLeads.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={selectedLeads.length > 0 ? () => setShowBulkTagModal(true) : undefined}
                disabled={selectedLeads.length === 0}
              >
                Tag
              </button>
              <button className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm hover:bg-purple-200">Enrich</button>
              <button className="px-3 py-1 rounded bg-green-100 text-green-700 text-sm hover:bg-green-200">Convert to Candidate</button>
              <button
                onClick={() => setShowExportModal(true)}
                className={`px-3 py-1 rounded flex items-center gap-1 bg-white border text-gray-700 text-sm shadow hover:bg-gray-50 transition ${selectedLeads.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={selectedLeads.length < 2}
              >
                <FaDownload /> Export
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No leads</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by importing your first leads.</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isCurrentPageFullySelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentPageLeads.map((lead) => {
                  // Parse enrichment_data if it's a string
                  let enrichment = lead.enrichment_data;
                  if (typeof enrichment === 'string') {
                    try {
                      enrichment = JSON.parse(enrichment);
                    } catch {
                      enrichment = {};
                    }
                  }
                  // Debug log
                  console.log('Lead enrichment_data:', enrichment);
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => handleSelectLead(lead.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {((lead.first_name || enrichment?.first_name || '') + ' ' + (lead.last_name || enrichment?.last_name || '')).trim()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.company}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            // Combine city, state, country if present
                            const locationParts = [lead.city, lead.state, lead.country].filter(Boolean);
                            if (locationParts.length > 0) return locationParts.join(', ');
                            // Fallback to campaign_location if present
                            if (lead.campaign_location) return lead.campaign_location;
                            // Otherwise show Unknown
                            return 'Unknown';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {lead.enrichment_source || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <LinkedInStatusPill lead={lead} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleMessageAgain(lead)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Message
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {leads.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, leads.length)} of {leads.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Export Leads</h2>
            <p className="mb-6">You are about to export <span className="font-semibold">{selectedLeads.length}</span> leads. Continue?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleExportLeads}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {showBulkTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Tag to Leads</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowBulkTagModal(false);
                  setBulkTagInput('');
                }}
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              Add a tag to {selectedLeads.length} selected lead(s).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Name
              </label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter tag name"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBulkTag()}
                autoFocus
              />
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Existing tags on selected leads will be preserved. This tag will be added to all selected leads.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => {
                  setShowBulkTagModal(false);
                  setBulkTagInput('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                onClick={handleBulkTag}
                disabled={isBulkTagging || !bulkTagInput.trim()}
              >
                {isBulkTagging ? 'Adding Tag...' : 'Add Tag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 