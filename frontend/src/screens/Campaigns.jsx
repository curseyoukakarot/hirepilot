import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaCheck, FaTrash, FaRocket, FaPause, FaGear } from 'react-icons/fa6';
import { FaSearch, FaChartBar, FaUsers, FaRegFileAlt, FaTimes, FaBriefcase } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { apiDelete, apiPost } from '../lib/api';
import { toast } from '../components/ui/use-toast';
import { usePlan } from '../context/PlanContext';
import { attachPipelineToJob, ensureCampaignJob, fetchPipelines } from '../lib/campaigns/pipelineAttach';

function Campaigns() {
  const navigate = useNavigate();
  const { isFree, role } = usePlan();
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTemplates, setShowTemplates] = useState(null);
  const [showMeta, setShowMeta] = useState(null); // campaign id for meta modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [attachCampaign, setAttachCampaign] = useState(null);
  const [attachJobName, setAttachJobName] = useState('');
  const [attachPipelineId, setAttachPipelineId] = useState('');
  const [attachPipelines, setAttachPipelines] = useState([]);
  const [attachCurrentPipeline, setAttachCurrentPipeline] = useState(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachFetching, setAttachFetching] = useState(false);
  const [attachError, setAttachError] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [personaText, setPersonaText] = useState('');
  const [personaCampaign, setPersonaCampaign] = useState(null);
  const isJobSeekerHost = typeof window !== 'undefined' && window.location.hostname.startsWith('jobs.');

  // Paid role-gated visibility for Persona quick start
  const paidRoles = ['members','admin','recruitpro','team_admin','super_admin'];
  const roleLc = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const showPersonaCTA = !isFree && paidRoles.includes(roleLc);

  const loadCampaigns = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authedUser = session?.user;
      if (authedUser && session?.access_token) {
        setUser(authedUser);
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/getCampaigns`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );
        const result = await response.json();
        if (response.ok) {
          setCampaigns(result.campaigns);
        } else {
          console.error('Failed to fetch campaigns:', result.error);
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = () => {
    setCreateName('');
    setCreateError('');
    setShowCreateModal(true);
  };
  const handleSubmitCreateCampaign = async (e) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name || createLoading) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/saveCampaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          campaignName: name,
          jobReq: '',
          keywords: '',
          status: 'draft'
        }),
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server error: ' + text);
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }
      const created = {
        ...(data.campaign || {}),
        total_leads: 0,
        enriched_leads: 0
      };
      setCampaigns(prev => [created, ...prev]);
      setShowCreateModal(false);
      toast({
        title: 'Campaign created',
        description: 'Your campaign is ready. Add pipeline details when you are ready.'
      });
      loadCampaigns({ silent: true });
    } catch (err) {
      setCreateError(err.message || 'Failed to create campaign');
    } finally {
      setCreateLoading(false);
    }
  };
  const handleNewPersona = () => {
    navigate('/agent/advanced/personas');
  };
  const handleTryRex = () => {
    navigate('/rex-chat');
  };

  const openAttachModal = (campaign) => {
    const name = campaign?.name || campaign?.title || '';
    setAttachCampaign(campaign);
    setAttachJobName(name);
    setAttachPipelineId('');
    setAttachPipelines([]);
    setAttachCurrentPipeline(null);
    setAttachError('');
  };

  useEffect(() => {
    const loadPipelines = async () => {
      if (!attachCampaign) return;
      setAttachFetching(true);
      setAttachError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('User not authenticated');
        const pipelines = await fetchPipelines({ token: session.access_token });
        let current = null;
        if (attachCampaign?.job_id) {
          const currentList = await fetchPipelines({
            token: session.access_token,
            jobId: attachCampaign.job_id
          });
          current = currentList?.[0] || null;
        }
        const unique = new Map();
        (current ? [current, ...pipelines] : pipelines).forEach((p) => {
          if (p?.id && !unique.has(p.id)) unique.set(p.id, p);
        });
        const merged = Array.from(unique.values());
        setAttachPipelines(merged);
        setAttachCurrentPipeline(current);
        if (current?.id) setAttachPipelineId(current.id);
      } catch (err) {
        setAttachError(err.message || 'Failed to load pipelines');
      } finally {
        setAttachFetching(false);
      }
    };
    loadPipelines();
  }, [attachCampaign]);

  const handleAttachPipeline = async (e) => {
    e.preventDefault();
    if (!attachCampaign || attachLoading) return;
    setAttachLoading(true);
    setAttachError('');
    try {
      if (!attachPipelineId) throw new Error('Select a pipeline');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('User not authenticated');
      const jobTitle = attachJobName.trim() || attachCampaign?.name || attachCampaign?.title || 'Campaign Job';
      const jobResult = await ensureCampaignJob({
        token: session.access_token,
        campaign: attachCampaign,
        title: jobTitle
      });
      const jobId = jobResult?.jobId;
      if (!jobId) throw new Error('Failed to resolve job');
      await attachPipelineToJob({ token: session.access_token, jobId, pipelineId: attachPipelineId });
      if (!attachCampaign.job_id && jobId) {
        try {
          await supabase
            .from('campaigns')
            .update({ job_id: jobId, updated_at: new Date().toISOString() })
            .eq('id', attachCampaign.id);
        } catch {}
      }
      setCampaigns(prev => prev.map(c => (c.id === attachCampaign.id ? { ...c, job_id: jobId } : c)));
      setAttachCampaign(null);
      toast({
        title: 'Job + pipeline attached',
        description: 'Campaign updated successfully.'
      });
      loadCampaigns({ silent: true });
    } catch (err) {
      setAttachError(err.message || 'Failed to attach pipeline');
    } finally {
      setAttachLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await apiDelete('/api/deleteCampaign', {
        body: JSON.stringify({ campaign_id: campaignId }),
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        }
      });
      
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      toast({
        title: 'Success',
        description: 'Campaign deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete campaign: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const handleLaunchCampaign = async (campaignId) => {
    try {
      await apiPost('/api/launchCampaign', { campaign_id: campaignId });
      setCampaigns(campaigns.map(c =>
        c.id === campaignId ? { ...c, status: 'active' } : c
      ));
      toast({
        title: 'Campaign Activated',
        description: 'Status changed from draft to active.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate campaign: ' + (error?.message || 'unknown error'),
        variant: 'destructive'
      });
    }
  };

  const openPersonaModal = (campaign) => {
    setPersonaCampaign(campaign);
    setPersonaText('');
    setShowPersonaModal(true);
  };

  const submitPersona = (e) => {
    e?.preventDefault?.();
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const prefill = personaText?.trim() || '';
    const rexPath = host.startsWith('jobs.')
      ? '/prep/rex-chat'
      : '/rex-chat';
    setShowPersonaModal(false);
    if (prefill) {
      navigate(`${rexPath}?prefill=${encodeURIComponent(prefill)}`);
    } else {
      navigate(rexPath);
    }
    toast({
      title: 'Searching for similar leads',
      description: 'Opening REX to run a persona-based search and add leads to your Leads page.',
    });
  };

  const handleCampaignClick = (campaign) => {
    if (campaign.status === 'draft') {
      openAttachModal(campaign);
    } else if (campaign.status === 'active' || campaign.status === 'live') {
      navigate(`/leads?campaignId=${campaign.id}&campaignName=${encodeURIComponent(campaign.name || campaign.title || 'Campaign')}`);
    }
  };

  // Filtering and searching
  const filteredCampaigns = campaigns.filter(c => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.role || '').toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status badge color
  const statusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'live': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'converted': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Find the selected campaign for template modal
  const selectedCampaign = campaigns.find(c => c.id === showTemplates);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-900 pb-16">
      {/* Hero/Header */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your Campaigns</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4 md:mb-0">Manage, launch, and track your recruiting campaigns in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          {isJobSeekerHost && (
            <button
              onClick={() => navigate('/campaigns/job-seeker-agent')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow transition-all duration-150"
              title="Launch Job Seeker Agent"
            >
              <FaRocket className="mr-2" /> Job Seeker Agent
            </button>
          )}
          <button
            onClick={handleTryRex}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow transition-all duration-150"
            title="Open REX Chat"
          >
            <FaRocket className="mr-2" /> Try with REX
          </button>
          {showPersonaCTA && (
            <button
              onClick={handleNewPersona}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow transition-all duration-150"
              title="Create a Persona in Agent Mode"
            >
              <FaPlus className="mr-2" /> New Persona
            </button>
          )}
          <button
            onClick={handleCreateCampaign}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow transition-all duration-150"
          >
            <FaPlus className="mr-2" /> New Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-end gap-4 mb-8">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="live">Live</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="converted">Converted</option>
          </select>
        </div>
      </div>

      {/* Campaign Cards Grid or Empty State */}
      <div className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <FaRocket className="text-6xl text-blue-200 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">No campaigns found</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Start by creating a new campaign to reach more candidates.</p>
            <button
              onClick={handleCreateCampaign}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow"
            >
              <FaPlus className="mr-2" /> New Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white dark:bg-gray-900 rounded-xl shadow-md border dark:border-gray-800 p-6 flex flex-col justify-between transition-all duration-150 hover:shadow-lg hover:border-blue-200 dark:hover:border-gray-700 group cursor-pointer"
                onClick={() => handleCampaignClick(campaign)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(campaign.status)}`}>{campaign.status}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPersonaModal(campaign); }}
                      className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200"
                      title="Find similar leads"
                    >
                      Find Similar Leads
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setShowMeta(campaign.id); }}
                      className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                      title="Campaign Settings"
                    >
                      <FaGear />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openAttachModal(campaign); }}
                      className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                      title="Add Job + Pipeline"
                    >
                      <FaBriefcase />
                    </button>
                    {campaign.status === 'draft' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleLaunchCampaign(campaign.id); }}
                        className="p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        title="Activate (set status to active)"
                      >
                        <FaRocket />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                      className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                      title="Delete Campaign"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 truncate" title={campaign.name || campaign.title}>
                  {campaign.name || campaign.title || 'Untitled Campaign'}
                </h3>
                <>
                  <p className="text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 min-h-[40px]">{campaign.role || campaign.description || ''}</p>
                  <div className="flex gap-4 items-center text-sm text-gray-400 dark:text-gray-500 mt-auto pt-2">
                    <span className="flex items-center gap-1">
                      <FaUsers /> {campaign.total_leads || 0} leads
                    </span>
                    {(campaign.status === 'active' || campaign.status === 'live') && (
                      <span className="flex items-center gap-1">
                        <FaChartBar /> {campaign.enriched_leads || 0} outreach
                      </span>
                    )}
                  </div>
                </>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setShowCreateModal(false)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">New Campaign</h2>
            <form onSubmit={handleSubmitCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Campaign Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g., Senior Frontend Engineer – NYC"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  You can add personas, pipeline, and outreach later.
                </p>
              </div>
              {createError && (
                <div className="text-sm text-red-600">{createError}</div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                  disabled={createLoading || !createName.trim()}
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Job + Pipeline Modal */}
      {attachCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setAttachCampaign(null)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-2 dark:text-gray-100">Attach Job + Pipeline</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Campaign: {attachCampaign?.name || attachCampaign?.title || 'Untitled'}
            </p>
            <form onSubmit={handleAttachPipeline} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Job Name</label>
                <input
                  type="text"
                  placeholder="e.g., Customer Success Manager"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  value={attachJobName}
                  onChange={(e) => setAttachJobName(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Used only if the campaign does not already have a job.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pipeline</label>
                {attachFetching ? (
                  <div className="text-sm text-gray-500">Loading pipelines...</div>
                ) : (
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    value={attachPipelineId}
                    onChange={(e) => setAttachPipelineId(e.target.value)}
                  >
                    <option value="">Select a pipeline</option>
                    {attachPipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Current pipeline: {attachCurrentPipeline?.name || 'None'}
                </div>
              </div>
              {attachError && (
                <div className="text-sm text-red-600">{attachError}</div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700"
                  onClick={() => setAttachCampaign(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                  disabled={attachLoading || attachFetching}
                >
                  {attachLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-w-lg w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setShowTemplates(null)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-gray-100">
              <FaRegFileAlt className="text-blue-600" /> Templates for "{selectedCampaign.name}"
            </h2>
            {selectedCampaign.templates.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No templates for this campaign.</p>
            ) : (
              <ul className="space-y-4">
                {selectedCampaign.templates.map(t => (
                  <li key={t.id} className="border rounded p-3 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                    <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">{t.name}</div>
                    <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap text-sm">{t.content}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Campaign Metadata Modal */}
      {showMeta && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setShowMeta(null)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-gray-100">
              <FaGear className="text-gray-700" /> Campaign Settings
            </h2>
            {(() => {
              const cm = campaigns.find(c => c.id === showMeta) || {};
              return (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Campaign ID</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm break-all">{cm.id}</code>
                      <button
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                        onClick={() => navigator.clipboard.writeText(cm.id || '')}
                      >Copy</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                      <div className="text-sm text-gray-800 dark:text-gray-200">{cm.status || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Leads</div>
                      <div className="text-sm text-gray-800 dark:text-gray-200">{cm.total_leads ?? 0}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showPersonaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={() => setShowPersonaModal(false)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Find Similar Leads</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Describe the persona you want REX to find. We’ll open REX Chat and add the results to your Leads.
            </p>
            <form onSubmit={submitPersona} className="space-y-4">
              <textarea
                className="w-full border rounded-lg p-3 text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                rows={4}
                placeholder="e.g., VPs of Product at mid-market healthcare SaaS companies in the US"
                value={personaText}
                onChange={(e) => setPersonaText(e.target.value)}
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium"
              >
                Send to REX
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Campaigns; 