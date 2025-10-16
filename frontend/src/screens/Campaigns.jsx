import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaCheck, FaTrash, FaRocket, FaPause, FaGear } from 'react-icons/fa6';
import { FaSearch, FaChartBar, FaUsers, FaRegFileAlt, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { apiDelete, apiPost } from '../lib/api';
import { toast } from '../components/ui/use-toast';

function Campaigns() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showTemplates, setShowTemplates] = useState(null);
  const [showMeta, setShowMeta] = useState(null); // campaign id for meta modal

  useEffect(() => {
    const fetchUserAndCampaigns = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          const response = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/getCampaigns?user_id=${user.id}`,
            {
              method: 'GET',
              credentials: 'include',
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
        setLoading(false);
      }
    };
    fetchUserAndCampaigns();
  }, []);

  const handleCreateCampaign = () => {
    navigate('/campaigns/new/job-description');
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

  const handleCampaignClick = (campaign) => {
    if (campaign.status === 'draft') {
      // Resume draft campaigns at Step 2 (Pipeline) instead of Step 1
      navigate(`/campaigns/new/pipeline?campaign_id=${campaign.id}`);
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-16">
      {/* Hero/Header */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Campaigns</h1>
          <p className="text-gray-500 mb-4 md:mb-0">Manage, launch, and track your recruiting campaigns in one place.</p>
        </div>
        <button
          onClick={handleCreateCampaign}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg flex items-center shadow transition-all duration-150"
        >
          <FaPlus className="mr-2" /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-end gap-4 mb-8">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No campaigns found</h2>
            <p className="text-gray-500 mb-4">Start by creating a new campaign to reach more candidates.</p>
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
                className="bg-white rounded-xl shadow-md border p-6 flex flex-col justify-between transition-all duration-150 hover:shadow-lg hover:border-blue-200 group cursor-pointer"
                onClick={() => handleCampaignClick(campaign)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(campaign.status)}`}>{campaign.status}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setShowMeta(campaign.id); }}
                      className="p-2 rounded hover:bg-gray-50 text-gray-600"
                      title="Campaign Settings"
                    >
                      <FaGear />
                    </button>
                    {campaign.status === 'draft' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleLaunchCampaign(campaign.id); }}
                        className="p-2 rounded hover:bg-blue-50 text-blue-600"
                        title="Activate (set status to active)"
                      >
                        <FaRocket />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                      className="p-2 rounded hover:bg-red-50 text-red-600"
                      title="Delete Campaign"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={campaign.name || campaign.title}>
                  {campaign.name || campaign.title || 'Untitled Campaign'}
                </h3>
                <>
                  <p className="text-gray-500 mb-3 line-clamp-2 min-h-[40px]">{campaign.role || campaign.description || ''}</p>
                  <div className="flex gap-4 items-center text-sm text-gray-400 mt-auto pt-2">
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

      {/* Templates Modal */}
      {showTemplates && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowTemplates(null)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaRegFileAlt className="text-blue-600" /> Templates for "{selectedCampaign.name}"
            </h2>
            {selectedCampaign.templates.length === 0 ? (
              <p className="text-gray-500">No templates for this campaign.</p>
            ) : (
              <ul className="space-y-4">
                {selectedCampaign.templates.map(t => (
                  <li key={t.id} className="border rounded p-3 bg-gray-50">
                    <div className="font-semibold text-blue-700 mb-1">{t.name}</div>
                    <div className="text-gray-700 whitespace-pre-wrap text-sm">{t.content}</div>
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
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowMeta(null)}
              title="Close"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaGear className="text-gray-700" /> Campaign Settings
            </h2>
            {(() => {
              const cm = campaigns.find(c => c.id === showMeta) || {};
              return (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Campaign ID</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm break-all">{cm.id}</code>
                      <button
                        className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
                        onClick={() => navigator.clipboard.writeText(cm.id || '')}
                      >Copy</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-sm text-gray-800">{cm.status || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Leads</div>
                      <div className="text-sm text-gray-800">{cm.total_leads ?? 0}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default Campaigns; 