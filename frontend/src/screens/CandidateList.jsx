import React, { useState, useEffect } from 'react';
import {
  FaSearch,
  FaFilter,
  FaEllipsisV,
  FaUserPlus,
  FaFileExport,
  FaPlus,
  FaDownload,
  FaTimes,
  FaFileAlt,
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import LeadProfileDrawer from './LeadProfileDrawer';
import MetadataModal from '../components/MetadataModal';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { downloadCSV } from '../utils/csvExport';
import ResumeWizard from '../components/ResumeWizard';

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
  const [showResumeWizard, setShowResumeWizard] = useState(false);
  const resumeWizardEnabled = (import.meta.env.VITE_FEATURE_RESUME_WIZARD ?? 'true').toString().toLowerCase() === 'true';
  // Super Search state
  const [superOpen, setSuperOpen] = useState(false);
  const [ssQ, setSsQ] = useState('');
  const [ssSkills, setSsSkills] = useState('');
  const [ssTech, setSsTech] = useState('');
  const [ssTitles, setSsTitles] = useState('');
  const [ssCompanies, setSsCompanies] = useState('');
  const [ssLocation, setSsLocation] = useState('');
  const [ssFunding, setSsFunding] = useState('');
  const [ssRevMin, setSsRevMin] = useState('');
  const [ssRevMax, setSsRevMax] = useState('');
  const [ssResults, setSsResults] = useState([]);
  const [ssCount, setSsCount] = useState(0);
  const [ssLoading, setSsLoading] = useState(false);
  const [ssLimit, setSsLimit] = useState(25);
  const [ssOffset, setSsOffset] = useState(0);
  const [addingToPipeline, setAddingToPipeline] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [metadataContext, setMetadataContext] = useState(null);
  const [uploadingResumeForId, setUploadingResumeForId] = useState(null);
  // Add Candidate modal state
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', linkedin_url: '', status: 'sourced' });
  const [creatingCandidate, setCreatingCandidate] = useState(false);
  const navigate = useNavigate();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const CANDIDATES_PER_PAGE = 25;

  // Filter candidates
  const filteredCandidates = candidates.filter(candidate => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
    const email = candidate.email?.toLowerCase() || '';
    const matchesSearch = !searchQuery || 
      fullName.includes(searchLower) || 
      email.includes(searchLower);
    
    const matchesStatus = selectedStatus === 'all' || 
      candidate.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const startIndex = (currentPage - 1) * CANDIDATES_PER_PAGE;
  const endIndex = startIndex + CANDIDATES_PER_PAGE;
  const currentPageCandidates = filteredCandidates.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredCandidates.length / CANDIDATES_PER_PAGE);

  // Check if all candidates on current page are selected
  const currentPageCandidateIds = currentPageCandidates.map(candidate => candidate.id);
  const currentPageSelectedCount = Array.from(selectedIds).filter(id => currentPageCandidateIds.includes(id)).length;
  const isCurrentPageFullySelected = currentPageCandidates.length > 0 && currentPageSelectedCount === currentPageCandidates.length;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedJob, selectedCampaign]);

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

  const selectAllOnPage = () => {
    if (isCurrentPageFullySelected) {
      // Deselect all candidates on current page
      const currentPageCandidateIds = currentPageCandidates.map(candidate => candidate.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentPageCandidateIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all candidates on current page (and keep any previously selected candidates from other pages)
      const currentPageCandidateIds = currentPageCandidates.map(candidate => candidate.id);
      setSelectedIds(prev => new Set([...prev, ...currentPageCandidateIds]));
    }
  };

  // Select all candidates in the current filtered set (across all pages)
  const selectAllFiltered = () => {
    const allIds = filteredCandidates.map(c => c.id);
    setSelectedIds(new Set(allIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // bulkEnrich declared once; ensure no duplicate definitions

  const bulkEnrich = async () => {
    try {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const headers = await getAuthHeader();
      let enriched = 0; let failed = 0;
      for (const id of ids) {
        const resp = await fetch(`${BACKEND_URL}/api/leads/${id}/enrich`, { method: 'POST', headers, credentials: 'include' });
        if (resp.ok) enriched++; else failed++;
      }
      alert(`Enrichment complete. Success: ${enriched}${failed?`, Failed: ${failed}`:''}`);
      refreshCandidates();
      clearSelection();
    } catch (e) {
      alert(e.message || 'Bulk enrich failed');
    }
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
      if (!confirm(`Delete ${ids.length} selected candidate(s)? This will also remove them from any jobs.`)) return;
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
      const js = await resp.json().catch(()=>({ success:true }));
      setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
      setSelectedIds(new Set());
      refreshCandidates();
      alert(`Deleted ${js.deleted ?? ids.length} candidate(s)` + (js.notDeleted?.length ? `, skipped ${js.notDeleted.length}` : ''));
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
        <div className="flex gap-3 items-center">
          {selectedIds.size > 0 && (
            <button
              onClick={bulkEnrich}
              className="border border-purple-300 text-purple-700 hover:bg-purple-50 px-4 py-2 rounded-lg text-sm flex items-center shadow-sm transition-all duration-150"
              title={`Enrich ${selectedIds.size} selected`}
            >
              <HiSparkles className="mr-2" /> Enrich
            </button>
          )}
          <button
            onClick={handleExportCandidates}
            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center shadow border transition-all duration-150"
          >
            <FaDownload className="mr-2" /> Export CSV
          </button>
          <button
            onClick={() => setShowAddCandidateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm flex items-center shadow transition-all duration-150"
          >
            <FaPlus className="mr-2" /> Add Candidate
          </button>
          {resumeWizardEnabled && (
            <button
              onClick={() => setShowResumeWizard(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm flex items-center shadow transition-all duration-150"
            >
              <FaFileAlt className="mr-2" /> Resume Wizard
            </button>
          )}
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

      {/* --- Super Search --- */}
      <div className="max-w-7xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold flex items-center"><FaSearch className="mr-2 text-gray-500"/>Candidate Super Search</div>
            <button className="text-sm text-blue-600" onClick={()=>setSuperOpen(o=>!o)}>{superOpen ? 'Hide Advanced Filters' : 'Show Advanced Filters'}</button>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Search keywords" value={ssQ} onChange={e=>setSsQ(e.target.value)} />
            <input className="border rounded px-3 py-2" placeholder="Location" value={ssLocation} onChange={e=>setSsLocation(e.target.value)} />
            <div className="flex items-center gap-2">
              <button className={`px-4 py-2 rounded ${ssLoading?'bg-gray-200 text-gray-500':'bg-blue-600 text-white'}`} onClick={async ()=>{
                setSsLoading(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  const filters = {
                    q: ssQ || undefined,
                    skills: ssSkills ? ssSkills.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
                    tech: ssTech ? ssTech.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
                    titles: ssTitles ? ssTitles.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
                    companies: ssCompanies ? ssCompanies.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
                    location: ssLocation || undefined,
                    fundingStage: ssFunding ? ssFunding.split(',').map(s=>s.trim()).filter(Boolean) : undefined,
                    revenueMin: ssRevMin ? Number(ssRevMin) : undefined,
                    revenueMax: ssRevMax ? Number(ssRevMax) : undefined,
                    limit: ssLimit,
                    offset: ssOffset
                  };
                  const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/search/candidates`, { method:'POST', headers: { 'Content-Type':'application/json', ...(token?{ Authorization: `Bearer ${token}` }:{}) }, body: JSON.stringify(filters) });
                  const js = await resp.json();
                  setSsResults(js?.rows || []);
                  setSsCount(js?.count || 0);
                } catch(e) {
                  console.error('super search', e);
                } finally {
                  setSsLoading(false);
                }
              }}>{ssLoading?'Searching…':'Search'}</button>
              <button className="px-3 py-2 rounded bg-gray-100" onClick={()=>{ setSsOffset(o=>Math.max(0, o-ssLimit)); }}>Prev</button>
              <button className="px-3 py-2 rounded bg-gray-100" onClick={()=>{ setSsOffset(o=>o+ssLimit); }}>Next</button>
            </div>
          </div>
          {superOpen && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded px-3 py-2" placeholder="Skills (comma)" value={ssSkills} onChange={e=>setSsSkills(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Tech (comma)" value={ssTech} onChange={e=>setSsTech(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Titles (comma)" value={ssTitles} onChange={e=>setSsTitles(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Companies (comma)" value={ssCompanies} onChange={e=>setSsCompanies(e.target.value)} />
              <input className="border rounded px-3 py-2" placeholder="Funding stage (comma)" value={ssFunding} onChange={e=>setSsFunding(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-3 py-2" placeholder="Revenue min" value={ssRevMin} onChange={e=>setSsRevMin(e.target.value)} />
                <input className="border rounded px-3 py-2" placeholder="Revenue max" value={ssRevMax} onChange={e=>setSsRevMax(e.target.value)} />
              </div>
            </div>
          )}
          <div className="mt-4">
            {!!ssResults.length && (
              <div>
                <div className="text-sm text-gray-500 mb-2">{ssCount} result(s)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ssResults.map(r => (
                    <div key={r.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="font-medium text-gray-900">{(r.first_name||'') + ' ' + (r.last_name||'')}</div>
                      <div className="text-sm text-gray-600">{r.title || '—'}</div>
                      <div className="text-sm text-gray-500">{r.email || '—'}</div>
                      <div className="mt-2 flex gap-2">
                        <button className="px-3 py-1.5 bg-white border rounded text-sm" onClick={()=>{
                          setSelectedCandidate(r);
                          setShowDrawer(true);
                        }}>Open</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!ssResults.length && ssLoading && (<div className="text-sm text-gray-500">Searching…</div>)}
          </div>
        </div>
      </div>

      {showResumeWizard && (
        <ResumeWizard open={showResumeWizard} onClose={() => setShowResumeWizard(false)} />
      )}

      {/* --- Table --- */}
      <div className="max-w-7xl mx-auto px-4">
        {selectedIds.size > 0 && (
          <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-gray-700 flex items-center gap-3">
              <span>{selectedIds.size} selected</span>
              {selectedIds.size < filteredCandidates.length && (
                <button
                  type="button"
                  className="text-indigo-600 hover:underline"
                  onClick={selectAllFiltered}
                >
                  Select all {filteredCandidates.length}
                </button>
              )}
              <button type="button" className="text-gray-500 hover:underline" onClick={clearSelection}>Clear</button>
            </div>
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
        <div className="bg-white shadow rounded-lg overflow-visible">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3">
                  <input 
                    type="checkbox" 
                    checked={isCurrentPageFullySelected}
                    onChange={selectAllOnPage} 
                  />
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
              {currentPageCandidates.map((candidate) => {
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
                      <td className="px-6 py-4">
                        <div className="flex items-center min-w-0">
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
                          <div className="ml-4 min-w-0">
                            <div className="text-sm font-medium text-gray-900 max-w-[220px] truncate" title={`${candidate.first_name || ''} ${candidate.last_name || ''}`.trim()}>
                              {candidate.first_name} {candidate.last_name}
                            </div>
                            <div className="text-sm text-gray-500 max-w-[240px] truncate" title={candidate.title || (typeof candidate.enrichment_data === 'string' ? parseEnrichmentTitle(candidate.enrichment_data) : candidate.enrichment_data?.current_title) || 'No title'}>
                              {candidate.title ||
                                (typeof candidate.enrichment_data === 'string'
                                  ? parseEnrichmentTitle(candidate.enrichment_data)
                                  : candidate.enrichment_data?.current_title) ||
                                'No title'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-[260px] truncate" title={candidate.email}>{candidate.email}</div>
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-[240px] truncate" title={candidate.candidate_jobs?.[0]?.job_requisitions?.title || 'No job assigned'}>
                          {candidate.candidate_jobs?.[0]?.job_requisitions?.title || 'No job assigned'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-[240px] truncate" title={location || 'Unknown'}>
                          {location || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative">
                          <button
                            onClick={() => { setShowDrawer(false); setShowActionsMenu(showActionsMenu === candidate.id ? null : candidate.id); }}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <FaEllipsisV />
                          </button>
                          
                          {showActionsMenu === candidate.id && (
                            <div className="absolute right-0 mt-2 min-w-[220px] rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[1000]">
                              <div className="py-1 space-y-0" role="menu">
                                <button
                                  onClick={() => handleMessageCandidate(candidate)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                                  role="menuitem"
                                >
                                  Message
                                </button>
                                <button
                                  onClick={() => { setShowActionsMenu(null); handleEditCandidate(candidate); }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
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
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                                  role="menuitem"
                                >
                                  Change Status
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Delete this candidate? This will also detach them from any jobs.')) return;
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
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 whitespace-nowrap"
                                  role="menuitem"
                                >
                                  Delete
                                </button>
                                <label className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center whitespace-nowrap" role="menuitem">
                                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setShowActionsMenu(null);
                                    try {
                                      setUploadingResumeForId(candidate.id);
                                      const toBase64 = (f) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
                                      const dataUrl = await toBase64(file);
                                      const headers = await getAuthHeader();
                                      const resp = await fetch(`${BACKEND_URL}/api/leads/candidates/${candidate.id}/resume`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...headers },
                                        body: JSON.stringify({ file: { name: file.name, data: String(dataUrl) } })
                                      });
                                      const js = await resp.json();
                                      if (!resp.ok) throw new Error(js?.error || 'Upload failed');
                                      setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, resume_url: js?.candidate?.resume_url } : c));
                                      alert('Resume uploaded');
                                    } catch (err) {
                                      alert(err.message || 'Upload failed');
                                    } finally {
                                      setUploadingResumeForId(null);
                                      e.target.value = '';
                                    }
                                  }} />
                                  <span className="whitespace-nowrap">Upload Resume</span>
                                </label>
                                <button
                                  onClick={() => { setShowActionsMenu(null); handleAddToPipelineClick(candidate); }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                                  role="menuitem"
                                >
                                  Add to Pipeline
                                </button>
                                <button
                                  onClick={() => {
                                    setMetadataContext({ candidateId: candidate.id, leadId: candidate.lead_id });
                                    setShowMetadata(true);
                                    setShowActionsMenu(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                                  role="menuitem"
                                >
                                  Metadata
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCandidates.length)} of {filteredCandidates.length} results
            </div>
            <div className="flex gap-2">
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

      {/* Drawer using LeadProfileDrawer */}
      {showDrawer && selectedCandidate && (
        <LeadProfileDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          entityType="candidate"
          lead={{
            id: selectedCandidate.id, // Use candidate ID for candidate entity type
            lead_id: selectedCandidate.lead_id, // Include lead_id for API calls
            first_name: selectedCandidate.first_name,
            last_name: selectedCandidate.last_name,
            name: `${selectedCandidate.first_name || ''} ${selectedCandidate.last_name || ''}`.trim(),
            email: selectedCandidate.email,
            phone: selectedCandidate.phone,
            enrichment_data: selectedCandidate.enrichment_data,
            title: selectedCandidate.title,
            company: selectedCandidate.company,
            linkedin_url: selectedCandidate.linkedin_url,
            resume_url: selectedCandidate.resume_url,
            notes: selectedCandidate.cover_note || selectedCandidate.notes || '',
          }}
          onLeadUpdated={(updatedCandidate) => {
            // Update the selectedCandidate state with the new data
            setSelectedCandidate(prev => ({
              ...prev,
              ...updatedCandidate,
              // Map the updated fields back to candidate structure
              first_name: updatedCandidate.first_name,
              last_name: updatedCandidate.last_name,
              email: updatedCandidate.email,
              phone: updatedCandidate.phone,
              notes: updatedCandidate.notes,
            }));
            
            // Also update the candidates list to reflect the changes
            setCandidates(prev => prev.map(candidate => 
              candidate.id === selectedCandidate.id 
                ? { ...candidate, ...updatedCandidate }
                : candidate
            ));
          }}
          extraHeaderActions={null}
        />
      )}

      {showMetadata && (
        <MetadataModal
          isOpen={showMetadata}
          onClose={() => setShowMetadata(false)}
          entity="candidate"
          candidateId={metadataContext?.candidateId}
          leadId={metadataContext?.leadId}
        />
      )}

      {showAddCandidateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Candidate</h2>
              <button
                onClick={() => setShowAddCandidateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>
            <form
              className="p-4 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setCreatingCandidate(true);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');
                  const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  };
                  // Prefer backend route to enforce ownership and defaults
                  const resp = await fetch(`${BACKEND_URL}/api/leads/candidates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(newCandidate)
                  });
                  if (!resp.ok) {
                    // Fallback: attempt direct insert through Supabase if backend lacks POST
                    try {
                      const { data: userRes } = await supabase.auth.getUser();
                      const { error } = await supabase.from('candidates').insert({
                        user_id: userRes?.user?.id,
                        first_name: newCandidate.first_name || null,
                        last_name: newCandidate.last_name || null,
                        email: newCandidate.email || null,
                        phone: newCandidate.phone || null,
                        title: newCandidate.title || null,
                        linkedin_url: newCandidate.linkedin_url || null,
                        status: newCandidate.status || 'sourced'
                      });
                      if (error) throw error;
                    } catch (fallbackErr) {
                      const txt = await resp.text().catch(() => 'Failed to create candidate');
                      throw new Error(txt || 'Failed to create candidate');
                    }
                  }
                  setShowAddCandidateModal(false);
                  setNewCandidate({ first_name: '', last_name: '', email: '', phone: '', title: '', linkedin_url: '', status: 'sourced' });
                  await refreshCandidates();
                  alert('Candidate added');
                } catch (err) {
                  alert(err.message || 'Failed to add candidate');
                } finally {
                  setCreatingCandidate(false);
                }
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.first_name}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, first_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.last_name}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, last_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.email}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.phone}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Job Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.title}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  placeholder="https://www.linkedin.com/in/..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newCandidate.linkedin_url}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, linkedin_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={newCandidate.status}
                  onChange={(e) => setNewCandidate(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="sourced">Sourced</option>
                  <option value="contacted">Contacted</option>
                  <option value="responded">Responded</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  disabled={creatingCandidate}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={creatingCandidate}
                >
                  {creatingCandidate ? 'Adding…' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
