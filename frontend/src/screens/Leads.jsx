console.log("!!! THIS IS THE ACTIVE LEADS.JSX FILE !!!");
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CsvImportButton from '../components/leads/CsvImportButton';
import { supabase } from '../lib/supabaseClient';
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
  const [showLinkedInScheduleModal, setShowLinkedInScheduleModal] = useState(false);
  const [linkedinScheduleInfo, setLinkedinScheduleInfo] = useState({ total: 0, limit: 20, remaining: 20 });
  const [linkedinPendingUrls, setLinkedinPendingUrls] = useState([]);
  const [isQueuingLinkedIn, setIsQueuingLinkedIn] = useState(false);

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
  // Sorting state
  const [sortBy, setSortBy] = useState('lastUpdated'); // lead | contact | status | tags | location | source | lastUpdated
  const [sortDir, setSortDir] = useState('desc'); // asc | desc

  const getLocationString = (lead) => {
    // Prefer normalized columns first
    const parts = [lead.city, lead.state, lead.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    if (lead.campaign_location) return lead.campaign_location;
    // Fallbacks: string location column and enrichment-derived location
    try {
      let enrichment = lead.enrichment_data;
      if (typeof enrichment === 'string') {
        enrichment = JSON.parse(enrichment);
      }
      const enrichedLocation = enrichment?.location || enrichment?.apollo?.location || '';
      return lead.location || enrichedLocation || '';
    } catch {
      return lead.location || '';
    }
  };

  const getLeadName = (lead) => {
    // Try enrichment names if base fields are missing
    let enrichment = lead.enrichment_data;
    if (typeof enrichment === 'string') {
      try { enrichment = JSON.parse(enrichment); } catch { enrichment = {}; }
    }
    const first = lead.first_name || enrichment?.first_name || '';
    const last = lead.last_name || enrichment?.last_name || '';
    const full = `${first} ${last}`.trim();
    if (full) return full;
    // Fall back to legacy/name-only fields
    return (lead.name || enrichment?.name || lead.linkedin_url || '').trim();
  };

  const valueForSort = (lead, field) => {
    switch (field) {
      case 'lead':
        return (getLeadName(lead) || '').toLowerCase();
      case 'contact':
        return (lead.email || '').toLowerCase();
      case 'status':
        return (lead.status || '').toLowerCase();
      case 'tags':
        return Array.isArray(lead.tags) ? lead.tags.join(', ').toLowerCase() : '';
      case 'location':
        return getLocationString(lead).toLowerCase();
      case 'source': {
        // Prefer original source; fall back to enrichment_source only if original missing
        const normalizeSource = (val) => {
          if (!val) return '';
          const v = String(val).trim().toLowerCase();
          if (v === 'apollo') return 'apollo';
          if (v === 'sales navigator' || v === 'sales_navigator' || v === 'phantombuster' || v === 'phantom' || v === 'sales navigator (phantombuster)' || v === 'salesnav') return 'sales navigator';
          if (v === 'chrome extension') return 'chrome extension';
          return v;
        };
        // Parse enrichment if needed to inspect possible source nested there
        let enrichment = lead.enrichment_data;
        if (typeof enrichment === 'string') {
          try { enrichment = JSON.parse(enrichment); } catch { enrichment = {}; }
        }
        const computed = normalizeSource(lead.source)
          || normalizeSource(lead.enrichment_source)
          || normalizeSource(enrichment && enrichment.source);
        return computed || '';
      }
      case 'lastUpdated':
        return new Date(lead.updated_at || lead.created_at || 0).getTime();
      default:
        return '';
    }
  };

  const handleSort = (field) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      // Default direction: text asc, dates desc
      setSortDir(field === 'lastUpdated' ? 'desc' : 'asc');
      return field;
    });
  };

  const sortIndicator = (field) => {
    if (sortBy !== field) return (
      <span className="ml-1 text-gray-300">↕</span>
    );
    return (
      <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
    );
  };


  // LinkedIn guidance state - remember user preference
  const [showLinkedInGuidance, setShowLinkedInGuidance] = useState(() => {
    const dismissed = localStorage.getItem('linkedinGuidanceDismissed');
    return dismissed !== 'true';
  });

  const fetchLeads = async (campaignId = selectedCampaignId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user?.id;
      if (!userId) return;

      const base = import.meta.env.VITE_BACKEND_URL || '';
      const params = new URLSearchParams();
      if (campaignId && campaignId !== 'all') params.set('campaignId', campaignId);
      const url = `${base}/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include'
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const leadsData = await res.json();

      const BATCH_SIZE = 1000; // Supabase default max per request
      const MAX_TOTAL = 10000; // Safety ceiling
      const fetchAll = async (makeQueryFn) => {
        const all = [];
        for (let from = 0; from < MAX_TOTAL; from += BATCH_SIZE) {
          const to = Math.min(from + BATCH_SIZE - 1, MAX_TOTAL - 1);
          const { data, error } = await makeQueryFn().range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < BATCH_SIZE) break;
        }
        return all;
      };

      // Fetch LinkedIn outreach statuses for this user (batched as well)
      const makeLinkedInQuery = () => supabase
        .from('linkedin_outreach_queue')
        .select('linkedin_url, status, scheduled_at, sent_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const linkedinData = await fetchAll(makeLinkedInQuery);

      // Group LinkedIn requests by url for O(1) lookup
      const byUrl = new Map();
      for (const row of linkedinData) {
        const key = row.linkedin_url || '';
        if (!byUrl.has(key)) byUrl.set(key, []);
        byUrl.get(key).push(row);
      }

      // Merge LinkedIn status into leads data
      const leadsWithLinkedInStatus = leadsData.map(lead => ({
        ...lead,
        linkedin_outreach_queue: byUrl.get(lead.linkedin_url || '') || []
      }));

      console.log(`Fetched ${leadsWithLinkedInStatus.length} leads (batched)`);
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

  // Sort then paginate
  const sortedLeads = (() => {
    const arr = [...leads];
    arr.sort((a, b) => {
      const va = valueForSort(a, sortBy);
      const vb = valueForSort(b, sortBy);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  })();

  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const endIndex = startIndex + LEADS_PER_PAGE;
  const currentPageLeads = sortedLeads.slice(startIndex, endIndex);
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

  const fetchLinkedinDailyCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');
    const base = import.meta.env.VITE_BACKEND_URL || '';
    const url = `${base}/api/linkedin/daily-count`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      credentials: 'include'
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const queueLinkedinRequests = async (urls, scheduledAt) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');
    const base = import.meta.env.VITE_BACKEND_URL || '';
    const url = `${base}/api/rex/tools/linkedin_connect`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      credentials: 'include',
      body: JSON.stringify({
        linkedin_urls: urls,
        scheduled_at: scheduledAt || undefined
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || body?.details || `HTTP ${res.status}`);
    }
    if (body?.success === false) {
      throw new Error(body?.error || 'Failed to queue LinkedIn requests');
    }
    return body;
  };

  const scheduleLinkedinRequests = async ({ urls, limit, remaining }) => {
    const batches = [];
    const now = new Date();
    const todayCapacity = Math.max(0, Number(remaining || 0));
    const dailyCap = Math.max(1, Number(limit || 1));

    let idx = 0;
    if (todayCapacity > 0) {
      const take = Math.min(todayCapacity, urls.length);
      if (take > 0) {
        batches.push({ urls: urls.slice(0, take), scheduledAt: now.toISOString() });
        idx = take;
      }
    }

    let dayOffset = todayCapacity > 0 ? 1 : 1;
    while (idx < urls.length) {
      const take = Math.min(dailyCap, urls.length - idx);
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() + dayOffset);
      batches.push({ urls: urls.slice(idx, idx + take), scheduledAt: d.toISOString() });
      idx += take;
      dayOffset += 1;
    }

    for (const batch of batches) {
      await queueLinkedinRequests(batch.urls, batch.scheduledAt);
    }
    return { batches: batches.length };
  };

  const handleBulkLinkedInRequest = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    const selectedData = leads.filter(lead => selectedLeads.includes(lead.id));
    const urls = selectedData
      .map(lead => lead.linkedin_url)
      .filter(u => typeof u === 'string' && u.includes('linkedin.com/'));

    const skipped = selectedData.length - urls.length;
    if (urls.length === 0) {
      toast.error('No valid LinkedIn URLs found in selection');
      return;
    }

    try {
      setIsQueuingLinkedIn(true);
      const counts = await fetchLinkedinDailyCount();
      const limit = Number(counts?.limit || 20);
      const remaining = Number(counts?.remaining || 0);

      if (urls.length > remaining) {
        setLinkedinPendingUrls(urls);
        setLinkedinScheduleInfo({ total: urls.length, limit, remaining });
        setShowLinkedInScheduleModal(true);
        return;
      }

      await queueLinkedinRequests(urls);
      toast.success(`Queued ${urls.length} LinkedIn request(s)${skipped ? ` (${skipped} skipped)` : ''}`);
    } catch (e) {
      toast.error(e?.message || 'Failed to queue LinkedIn requests');
    } finally {
      setIsQueuingLinkedIn(false);
    }
  };

  const handleScheduleLinkedIn = async () => {
    if (!linkedinPendingUrls.length) return;
    const { limit, remaining } = linkedinScheduleInfo || {};
    try {
      setIsQueuingLinkedIn(true);
      await scheduleLinkedinRequests({
        urls: linkedinPendingUrls,
        limit,
        remaining
      });
      const dailyLimit = Math.max(1, Number(limit || 1));
      const remainingToday = Math.max(0, Number(remaining || 0));
      const todayBatch = remainingToday > 0 ? Math.min(remainingToday, linkedinPendingUrls.length) : 0;
      const leftover = Math.max(0, linkedinPendingUrls.length - todayBatch);
      const days = (todayBatch > 0 ? 1 : 0) + Math.ceil(leftover / dailyLimit);
      toast.success(`Scheduled ${linkedinPendingUrls.length} requests over ~${days} day(s).`);
      setShowLinkedInScheduleModal(false);
      setLinkedinPendingUrls([]);
    } catch (e) {
      toast.error(e?.message || 'Failed to schedule LinkedIn requests');
    } finally {
      setIsQueuingLinkedIn(false);
    }
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
                className={`px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm hover:bg-blue-200 ${isQueuingLinkedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleBulkLinkedInRequest}
                disabled={isQueuingLinkedIn}
              >
                {isQueuingLinkedIn ? 'Queuing…' : 'LinkedIn Request'}
              </button>
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
                  <th onClick={() => handleSort('lead')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Lead {sortIndicator('lead')}</th>
                  <th onClick={() => handleSort('contact')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Contact {sortIndicator('contact')}</th>
                  <th onClick={() => handleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Status {sortIndicator('status')}</th>
                  <th onClick={() => handleSort('tags')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Tags {sortIndicator('tags')}</th>
                  <th onClick={() => handleSort('location')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Location {sortIndicator('location')}</th>
                  <th onClick={() => handleSort('source')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Source {sortIndicator('source')}</th>
                  <th onClick={() => handleSort('lastUpdated')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">Last Updated {sortIndicator('lastUpdated')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentPageLeads.map((lead) => {
                  // Parse enrichment_data if it's a string
                  let enrichment = lead.enrichment_data;
                  if (typeof enrichment === 'string') {
                    try { enrichment = JSON.parse(enrichment); } catch { enrichment = {}; }
                  }
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
                        <div className="text-sm font-medium text-gray-900">{getLeadName(lead)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.status || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{Array.isArray(lead.tags) ? lead.tags.join(', ') : ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getLocationString(lead) || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{
                          (() => {
                            const normalizeSource = (val) => {
                              if (!val) return null;
                              const v = String(val).trim().toLowerCase();
                              if (v === 'apollo') return 'Apollo';
                              if (v === 'sales navigator' || v === 'sales_navigator' || v === 'phantombuster' || v === 'phantom' || v === 'sales navigator (phantombuster)' || v === 'salesnav') return 'Sales Navigator';
                              if (v === 'chrome extension') return 'Chrome Extension';
                              return val;
                            };
                            let enrichment = lead.enrichment_data;
                            if (typeof enrichment === 'string') {
                              try { enrichment = JSON.parse(enrichment); } catch { enrichment = {}; }
                            }
                            return normalizeSource(lead.source)
                              || normalizeSource(lead.enrichment_source)
                              || normalizeSource(enrichment && enrichment.source)
                              || 'Unknown';
                          })()
                        }</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(lead.updated_at || lead.created_at).toLocaleString()}</div>
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

      {/* LinkedIn Schedule Modal */}
      {showLinkedInScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Over daily LinkedIn limit</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowLinkedInScheduleModal(false)}
              >
                ×
              </button>
            </div>
            <p className="text-gray-600 mb-4">
              You selected {linkedinScheduleInfo.total} leads, but your daily limit is {linkedinScheduleInfo.limit}.
              We can schedule these to run daily so your LinkedIn stays safe.
            </p>
            <div className="mb-4 text-sm text-gray-500">
              {(() => {
                const dailyLimit = Math.max(1, Number(linkedinScheduleInfo.limit || 1));
                const remainingToday = Math.max(0, Number(linkedinScheduleInfo.remaining || 0));
                const todayBatch = remainingToday > 0 ? Math.min(remainingToday, linkedinScheduleInfo.total) : 0;
                const leftover = Math.max(0, linkedinScheduleInfo.total - todayBatch);
                const days = (todayBatch > 0 ? 1 : 0) + Math.ceil(leftover / dailyLimit);
                return `Remaining today: ${remainingToday}. Estimated days: ${days}.`;
              })()}
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setShowLinkedInScheduleModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleScheduleLinkedIn}
                disabled={isQueuingLinkedIn}
              >
                {isQueuingLinkedIn ? 'Scheduling…' : 'Schedule Daily'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 