import React, { useState, useEffect } from 'react';
import {
  FaSearch,
  FaFilter,
  FaEllipsisV,
  FaUserPlus,
  FaFileExport,
  FaPlus,
  FaDownload,
} from 'react-icons/fa';
import LeadProfileDrawer from './LeadProfileDrawer';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { downloadCSV } from '../utils/csvExport';

// Helper function to safely parse enrichment title - fixes temporal dead zone issues
const parseEnrichmentTitle = (enrichmentData) => {
  try {
    return JSON.parse(enrichmentData).current_title;
  } catch {
    return undefined;
  }
};

export default function CandidateList() {
  /** ------------------------------------------------------------------
   * State
   * -----------------------------------------------------------------*/
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedJob, setSelectedJob] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedCandidate, setEditedCandidate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddToPipelineModal, setShowAddToPipelineModal] = useState(false);
  const [pipelineList, setPipelineList] = useState([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [candidateToAdd, setCandidateToAdd] = useState(null);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const navigate = useNavigate();

  /** ------------------------------------------------------------------
   * Config
   * -----------------------------------------------------------------*/
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  /** ------------------------------------------------------------------
   * Helpers
   * -----------------------------------------------------------------*/
  const getAuthHeader = async () => {
    // Supabase v2 — returns { data: { session }, error }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data.session?.access_token;

    if (!token) throw new Error('No active session – please sign in again.');
    return { Authorization: `Bearer ${token}` };
  };

  const openDrawerFor = (candidate) => {
    setSelectedCandidate(candidate);
    setShowDrawer(true);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = (ids) => {
    setSelectedIds(new Set(ids));
  };

  const bulkChangeStatus = async (status) => {
    try {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const headers = await getAuthHeader();
      const url = `${BACKEND_URL}/api/leads/candidates/bulk-status`;
      console.log('[BULK STATUS] →', url, { ids, status });
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids, status })
      });
      console.log('[BULK STATUS] status', resp.status);
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || 'Bulk update failed');
      }
      setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, status } : c));
      setSelectedIds(new Set());
      refreshCandidates();
      alert('Status updated');
    } catch (e) {
      alert(e.message || 'Bulk update failed');
    }
  };

  const bulkDelete = async () => {
    try {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const headers = await getAuthHeader();
      const url = `${BACKEND_URL}/api/leads/candidates/bulk-delete`;
      console.log('[BULK DELETE] →', url, { ids });
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids })
      });
      console.log('[BULK DELETE] status', resp.status);
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error || 'Bulk delete failed');
      }
      setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedIds(new Set());
      refreshCandidates();
      alert('Deleted');
    } catch (e) {
      alert(e.message || 'Bulk delete failed');
    }
  };

  /** ------------------------------------------------------------------
   * Fetch candidates on mount
   * -----------------------------------------------------------------*/
  useEffect(() => {
    async function fetchCandidates() {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const res = await fetch(`${BACKEND_URL}/api/leads/candidates`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }

        // Accept both array and object response
        let fetchedCandidates = await res.json();
        if (Array.isArray(fetchedCandidates)) {
          // ok
        } else if (fetchedCandidates && Array.isArray(fetchedCandidates.candidates)) {
          fetchedCandidates = fetchedCandidates.candidates;
        } else {
          throw new Error('Invalid response format');
        }

        // Robustly parse enrichment_data
        const parseEnrichmentData = (data) => {
          if (!data) return {};
          if (typeof data === 'object' && !Array.isArray(data)) return data;
          if (typeof data === 'string') {
            try {
              return JSON.parse(data);
            } catch {
              return {};
            }
          }
          return {};
        };
        const parsedCandidates = fetchedCandidates.map(c => ({
          ...c,
          enrichment_data: parseEnrichmentData(c.enrichment_data)
        }));
        console.log('Candidates:', parsedCandidates);
        setCandidates(parsedCandidates);
      } catch (err) {
        console.error('Error fetching candidates:', err);
        setError(err.message || 'Failed to load candidates');
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCandidates();
    // expose a refresh helper
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshCandidates = fetchCandidates;
  }, [BACKEND_URL]);

  // Refresh helper (assigned on mount)
  let refreshCandidates = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch(`${BACKEND_URL}/api/leads/candidates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || `HTTP ${res.status}`);
      let fetched = await res.json();
      if (!Array.isArray(fetched) && fetched?.candidates) fetched = fetched.candidates;
      const normalize = (data) => {
        if (!data) return {};
        if (typeof data === 'object' && !Array.isArray(data)) return data;
        if (typeof data === 'string') { try { return JSON.parse(data); } catch { return {}; } }
        return {};
      };
      setCandidates((fetched||[]).map(c => ({ ...c, enrichment_data: normalize(c.enrichment_data) })));
    } catch (e) {
      setError(e.message || 'Failed to refresh');
    } finally { setLoading(false); }
  };

  /** ------------------------------------------------------------------
   * Fetch pipeline list when modal opens
   * -----------------------------------------------------------------*/
  useEffect(() => {
    if (!showAddToPipelineModal) return;

    (async () => {
      const { data, error } = await supabase
        .from('job_requisitions')
        .select('id, title');
      if (error) console.error(error);
      setPipelineList(data || []);
    })();
  }, [showAddToPipelineModal]);

  /** ------------------------------------------------------------------
   * Candidate actions
   * -----------------------------------------------------------------*/
  const handleMessageCandidate = (candidate) => {
    localStorage.setItem(
      'selectedLead',
      JSON.stringify({
        id: candidate.id,
        name:
          candidate.first_name && candidate.last_name
            ? `${candidate.first_name} ${candidate.last_name}`
            : candidate.name || '',
        email: candidate.email,
        company: candidate.company,
        title: candidate.title,
      })
    );
    navigate('/messages');
  };

  const handleEditCandidate = (candidate) => {
    setEditedCandidate({ ...candidate });
    setShowEditModal(true);
    setShowActionsMenu(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${BACKEND_URL}/api/candidates/${editedCandidate.id}` ,{
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(editedCandidate),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update candidate');
      }

      const updated = await response.json();
      setCandidates((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setShowEditModal(false);
      setEditedCandidate(null);
      // Ensure persistence by refetching
      refreshCandidates();
    } catch (err) {
      alert(err.message || 'Failed to update candidate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToPipelineClick = (candidate) => {
    setCandidateToAdd(candidate);
    setShowActionsMenu(null);
    setShowAddToPipelineModal(true);
    setSelectedPipelineId('');
    setPipelineSearch('');
  };

  const handleConfirmAddToPipeline = async () => {
    if (!selectedPipelineId || !candidateToAdd) return;
    setAddingToPipeline(true);
    try {
      const { error } = await supabase.from('candidate_jobs').insert({
        job_id: selectedPipelineId,
        candidate_id: candidateToAdd.id,
      });
      if (error) throw error;
      setShowAddToPipelineModal(false);
      setCandidateToAdd(null);
      setSelectedPipelineId('');
      setPipelineSearch('');
      alert('Candidate added to pipeline!');
    } catch (err) {
      alert(`Failed to add candidate to pipeline: ${err.message}`);
    } finally {
      setAddingToPipeline(false);
    }
  };

  const handleExportCandidates = () => {
    const exportData = candidates.map((candidate) => ({
      'First Name': candidate.first_name || '',
      'Last Name': candidate.last_name || '',
      Email: candidate.email || '',
      Phone: candidate.phone || '',
      Status: candidate.status || '',
      'Job Title': candidate.candidate_jobs?.[0]?.job_requisitions?.title || '',
      Department:
        candidate.candidate_jobs?.[0]?.job_requisitions?.department || '',
      Campaign: candidate.leads?.[0]?.campaigns?.name || '',
      Notes: candidate.notes || '',
      'Created At': new Date(candidate.created_at).toLocaleDateString(),
      'Last Updated': new Date(candidate.updated_at).toLocaleDateString(),
    }));

    downloadCSV(
      exportData,
      `candidates-export-${new Date().toISOString().split('T')[0]}`
    );
  };

  /** ------------------------------------------------------------------
   * UI
   * -----------------------------------------------------------------*/
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Loading candidates…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-16">
      {/* --- Header --- */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Candidates</h1>
          <p className="text-gray-500 mb-4 md:mb-0">
            Manage and track your candidates in one place.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCandidates}
            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center shadow border transition-all duration-150"
          >
            <FaDownload className="mr-2" /> Export CSV
          </button>
          <button
            onClick={() => setShowAddToPipelineModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm flex items-center shadow transition-all duration-150"
          >
            <FaPlus className="mr-2" /> Add Candidate
          </button>
        </div>
      </div>

      {/* --- Filters --- */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="sourced">Sourced</option>
              <option value="contacted">Contacted</option>
              <option value="responded">Responded</option>
              <option value="interviewing">Interviewing</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Table --- */}
      <div className="max-w-7xl mx-auto px-4">
        {selectedIds.size > 0 && (
          <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-gray-700">{selectedIds.size} selected</div>
            <div className="flex gap-2">
              <select className="px-3 py-2 border rounded-lg" onChange={(e) => { if (e.target.value) bulkChangeStatus(e.target.value); e.target.value=''; }}>
                <option value="">Change Status…</option>
                <option value="sourced">Sourced</option>
                <option value="contacted">Contacted</option>
                <option value="responded">Responded</option>
                <option value="interviewing">Interviewing</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="border border-gray-300 hover:bg-gray-50 rounded-lg px-4 py-2" onClick={bulkDelete}>Delete</button>
            </div>
          </div>
        )}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3">
                  <input type="checkbox" onChange={(e) => selectAllOnPage(candidates.map(c => c.id))} />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates
                .filter(candidate => {
                  const searchLower = searchQuery.toLowerCase();
                  const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
                  const email = candidate.email?.toLowerCase() || '';
                  const matchesSearch = !searchQuery || 
                    fullName.includes(searchLower) || 
                    email.includes(searchLower);
                  
                  const matchesStatus = selectedStatus === 'all' || 
                    candidate.status === selectedStatus;
                  
                  return matchesSearch && matchesStatus;
                })
                .map((candidate) => {
                  // Parse enrichment_data if it's a string
                  let location = '';
                  try {
                    if (typeof candidate.enrichment_data === 'string') {
                      const enrichmentData = JSON.parse(candidate.enrichment_data);
                      location = enrichmentData.location || '';
                    } else if (candidate.enrichment_data?.location) {
                      location = candidate.enrichment_data.location;
                    }
                  } catch (e) {
                    console.error('Error parsing enrichment_data:', e);
                  }

                  return (
                    <tr key={candidate.id} className="cursor-pointer hover:bg-gray-50" onClick={(e) => {
                      const tag = (e.target.tagName || '').toLowerCase();
                      if (['button','svg','path','input','select'].includes(tag)) return;
                      openDrawerFor(candidate);
                    }}>
                      <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.has(candidate.id)} onChange={() => toggleSelect(candidate.id)} onClick={(e)=>e.stopPropagation()} /></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            {candidate.avatar_url ? (
                              <img
                                className="h-10 w-10 rounded-full"
                                src={candidate.avatar_url}
                                alt=""
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-500 font-medium">
                                  {candidate.first_name?.[0]}
                                  {candidate.last_name?.[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {candidate.first_name} {candidate.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {candidate.title ||
                                (typeof candidate.enrichment_data === 'string'
                                  ? parseEnrichmentTitle(candidate.enrichment_data)
                                  : candidate.enrichment_data?.current_title) ||
                                'No title'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{candidate.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${candidate.status === 'sourced' ? 'bg-yellow-100 text-yellow-800' :
                            candidate.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                            candidate.status === 'responded' ? 'bg-green-100 text-green-800' :
                            candidate.status === 'interviewing' ? 'bg-purple-100 text-purple-800' :
                            candidate.status === 'hired' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {candidate.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {candidate.candidate_jobs?.[0]?.job_requisitions?.title || 'No job assigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {location || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative">
                          <button
                            onClick={() => setShowActionsMenu(showActionsMenu === candidate.id ? null : candidate.id)}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <FaEllipsisV />
                          </button>
                          
                          {showActionsMenu === candidate.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={() => handleMessageCandidate(candidate)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  Message
                                </button>
                                <button
                                  onClick={() => handleEditCandidate(candidate)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    const newStatus = prompt('New status: sourced/contacted/responded/interviewing/hired/rejected', candidate.status || 'sourced');
                                    if (!newStatus) return;
                                    try {
                                      const headers = await getAuthHeader();
                                      const url = `${BACKEND_URL}/api/leads/candidates/${candidate.id}`;
                                      console.log('[UPDATE Candidate Status] →', url, { status: newStatus });
                                      const resp = await fetch(url, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', ...headers },
                                        body: JSON.stringify({ status: newStatus })
                                      });
                                      console.log('[UPDATE Candidate Status] status', resp.status);
                                      if (resp.ok) {
                                        setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, status: newStatus } : c));
                                        refreshCandidates();
                                      } else {
                                        const err = await resp.json().catch(()=>({ error: `HTTP ${resp.status}` }));
                                        console.error('[UPDATE Candidate Status] error', err);
                                        alert(err.error || 'Failed to update status');
                                      }
                                    } catch (e) {
                                      alert(e.message || 'Failed to update status');
                                    }
                                    setShowActionsMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  Change Status
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Delete candidate?')) return;
                                    try {
                                      const headers = await getAuthHeader();
                                      const url = `${BACKEND_URL}/api/leads/candidates/${candidate.id}`;
                                      console.log('[DELETE Candidate] →', url);
                                      const resp = await fetch(url, {
                                        method: 'DELETE',
                                        headers: { ...headers }
                                      });
                                      console.log('[DELETE Candidate] status', resp.status);
                                      if (resp.ok) {
                                        setCandidates(prev => prev.filter(c => c.id !== candidate.id));
                                        refreshCandidates();
                                      } else {
                                        const err = await resp.json().catch(()=>({ error: `HTTP ${resp.status}` }));
                                        console.error('[DELETE Candidate] error', err);
                                        alert(err.error || 'Failed to delete');
                                      }
                                    } catch (e) {
                                      alert(e.message || 'Failed to delete');
                                    }
                                    setShowActionsMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => handleAddToPipelineClick(candidate)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  role="menuitem"
                                >
                                  Add to Pipeline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer using LeadProfileDrawer */}
      {showDrawer && selectedCandidate && (
        <LeadProfileDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          lead={{
            id: selectedCandidate.lead_id || selectedCandidate.id,
            first_name: selectedCandidate.first_name,
            last_name: selectedCandidate.last_name,
            name: `${selectedCandidate.first_name || ''} ${selectedCandidate.last_name || ''}`.trim(),
            email: selectedCandidate.email,
            phone: selectedCandidate.phone,
            enrichment_data: selectedCandidate.enrichment_data,
            title: selectedCandidate.title,
            company: selectedCandidate.company,
            linkedin_url: selectedCandidate.linkedin_url,
          }}
        />
      )}
    </div>
  );
}
