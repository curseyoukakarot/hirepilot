import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import JobDetailsCard from '../components/job/JobDetailsCard';
import JobPipeline from './JobPipeline';

export default function JobRequisitionPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [traits, setTraits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [team, setTeam] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [candidates, setCandidates] = useState({ applied: [], screened: [], interview: [], offer: [] });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAddTeammateModal, setShowAddTeammateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Current user profile → org + permissions
      let profile = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: p } = await supabase
            .from('users')
            .select('id, email, full_name, role, organization_id, avatar_url')
            .eq('id', user.id)
            .single();
          profile = p || null;
          setCurrentUser(profile);
          const manageable = ['account_owner','team_admin'].includes((profile?.role || '').toLowerCase());
          setCanManage(manageable);
        }
      } catch {}

      const { data: jobData } = await supabase
        .from('job_requisitions')
        .select('*')
        .eq('id', id)
        .single();
      setJob(jobData);

      const { data: traitData } = await supabase
        .from('success_traits')
        .select('*')
        .eq('job_id', id);
      setTraits(traitData || []);

      const { data: notesData } = await supabase
        .from('job_notes')
        .select('id, content, created_at, author:users(full_name, avatar_url)')
        .eq('job_id', id)
        .order('created_at', { ascending: true });
      setNotes(notesData || []);

      // Collaborators with embedded users
      const { data: teamData } = await supabase
        .from('job_collaborators')
        .select('user_id, role, users(id, full_name, email, avatar_url, organization_id)')
        .eq('job_id', id);
      const filteredTeam = (teamData || []).filter(r => !profile?.organization_id || r.users?.organization_id === profile.organization_id);
      setTeam(filteredTeam);

      // Load org users for Add Teammate
      if (profile?.organization_id) {
        const { data: orgRows } = await supabase
          .from('users')
          .select('id, full_name, email, avatar_url, organization_id, role')
          .eq('organization_id', profile.organization_id);
        setOrgUsers(orgRows || []);
      } else {
        setOrgUsers([]);
      }

      const { data: candidatesData } = await supabase
        .from('candidate_jobs')
        .select('status, candidates(full_name, avatar_url, created_at)')
        .eq('job_id', id);
      const grouped = { applied: [], screened: [], interview: [], offer: [] };
      (candidatesData || []).forEach(row => {
        const status = row.status || 'applied';
        if (grouped[status]) grouped[status].push(row);
      });
      setCandidates(grouped);

      setLoading(false);
    };
    fetchData();
  }, [id]);

  const collaboratorUserIds = useMemo(() => new Set((team || []).map(t => t.user_id || t.users?.id)), [team]);
  const availableOrgUsers = useMemo(() => (orgUsers || []).filter(u => !collaboratorUserIds.has(u.id)), [orgUsers, collaboratorUserIds]);

  const handleEdit = (label) => console.log(`Edit ${label}`);
  const handleAddTrait = () => console.log('Add Trait');
  const handlePostNote = () => console.log('Post note');
  const handleAddTeammate = () => setShowAddTeammateModal(true);

  const handleUpdateCollaboratorRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('job_collaborators')
        .update({ role: newRole })
        .eq('job_id', id)
        .eq('user_id', userId);
      if (error) throw error;
      setTeam(prev => prev.map(t => (t.user_id === userId || t.users?.id === userId) ? { ...t, role: newRole } : t));
    } catch (e) {
      alert('Failed to change role: ' + (e.message || e));
    }
  };

  const handleRemoveCollaborator = async (userId) => {
    if (!confirm('Remove this collaborator?')) return;
    try {
      const { error } = await supabase
        .from('job_collaborators')
        .delete()
        .eq('job_id', id)
        .eq('user_id', userId);
      if (error) throw error;
      setTeam(prev => prev.filter(t => (t.user_id || t.users?.id) !== userId));
    } catch (e) {
      alert('Failed to remove collaborator: ' + (e.message || e));
    }
  };

  const saveNewTeammate = async () => {
    if (!selectedUserId) return;
    try {
      setIsSaving(true);
      const { error: insErr } = await supabase
        .from('job_collaborators')
        .insert({ job_id: id, user_id: selectedUserId, role: 'Editor' });
      if (insErr) throw insErr;
      const addedUser = (orgUsers || []).find(u => u.id === selectedUserId);
      setTeam(prev => [...prev, { user_id: selectedUserId, role: 'Editor', users: addedUser }]);
      if (currentUser?.id) {
        await supabase.from('job_activity_log').insert({
          type: 'collaborator_added',
          actor_id: currentUser.id,
          job_id: id,
          target_user_id: selectedUserId,
          role: 'Editor',
          created_at: new Date().toISOString()
        });
      }
      setShowAddTeammateModal(false);
      setSelectedUserId('');
    } catch (e) {
      alert('Failed to add teammate: ' + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">Job not found</div>
    );
  }

  return (
    <div className="bg-gray-50 font-sans min-h-screen">
      <div id="job-requisition-page" className="min-h-screen">
        {/* Header */}
        <header id="header" className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button className="text-gray-400 hover:text-gray-600" onClick={() => window.history.back()}>
                  <i className="fas fa-arrow-left text-lg"></i>
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{job.title}</h1>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {job.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {[job.department, job.location, job.experience_level].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex -space-x-2">
                  {team.slice(0,3).map((t,i) => (
                    <img key={i} src={t.users?.avatar_url || ''} className="w-8 h-8 rounded-full border-2 border-white" />
                  ))}
                </div>

                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" onClick={() => console.log('Share')}>
                  <i className="fas fa-share-alt mr-2"></i>
                  Share
                </button>

                <button className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700" onClick={() => console.log('REX')}>
                  <i className="fas fa-robot mr-2"></i>
                  REX
                </button>

                <div className="relative">
                  <button className="p-2 text-gray-400 hover:text-gray-600" onClick={() => console.log('More actions')}>
                    <i className="fas fa-ellipsis-h"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav id="tab-navigation" className="bg-white border-b border-gray-200 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex space-x-8">
              <button
                className={`tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'team' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('team')}
              >
                Team
              </button>
              <button
                className={`tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'candidates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('candidates')}
              >
                Candidates
              </button>
              <button
                className={`tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'activity' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('activity')}
              >
                Activity
              </button>
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        <main id="main-content" className="max-w-7xl mx-auto px-6 py-6">
          {/* Overview Tab */}
          <div id="overview-tab" className={activeTab === 'overview' ? 'tab-content' : 'tab-content hidden'}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Role Description */}
                <div id="role-description" className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Role Description</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-700" onClick={() => handleEdit('description')}>
                      <i className="fas fa-edit mr-1"></i>
                      Edit
                    </button>
                  </div>
                  <div className="prose max-w-none text-gray-600 whitespace-pre-line">
                    {job.description || "No description provided."}
                  </div>
                </div>

                {/* Success Profile */}
                <div id="success-profile" className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Success Profile</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-700" onClick={handleAddTrait}>
                      <i className="fas fa-plus mr-1"></i>
                      Add Trait
                    </button>
                  </div>
                  <div className="space-y-3">
                    {traits.length === 0 && <p className="text-sm text-gray-500">No traits yet</p>}
                    {traits.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">{t.name}</span>
                        <span className="text-xs text-gray-500">{t.importance || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Internal Comments */}
                <div id="internal-comments" className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h3>
                  <div className="space-y-4">
                    {notes.length === 0 && <p className="text-sm text-gray-500">No notes yet</p>}
                    {notes.map((n) => (
                      <div key={n.id} className="flex space-x-3">
                        <img src={n.author?.avatar_url || ''} className="w-8 h-8 rounded-full" />
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700">{n.content}</p>
                          </div>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span>{n.author?.full_name || 'Unknown'}</span>
                            <span className="mx-1">•</span>
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <textarea placeholder="Add a note..." className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none" rows="3"></textarea>
                    <div className="flex justify-end mt-2">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" onClick={handlePostNote}>Post</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <JobDetailsCard job={job} />

                {/* Assigned Team */}
                <div id="assigned-team" className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Team</h3>
                  <div className="space-y-3">
                    {team.length === 0 && <p className="text-sm text-gray-500">No collaborators</p>}
                    {team.map((t, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <img src={t.users?.avatar_url || ''} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.users?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{t.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Tab */}
          <div id="team-tab" className={activeTab === 'team' ? 'tab-content' : 'tab-content hidden'}>
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Team Collaborators</h3>
                  {canManage && (
                    <div className="flex gap-2">
                      <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700" onClick={() => setShowAddTeammateModal(true)}>
                        <i className="fas fa-plus mr-2"></i>
                        Add Teammate
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {team.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img src={t.users?.avatar_url || ''} className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="font-medium text-gray-900">{t.users?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{t.users?.email || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <select className="border border-gray-200 rounded-md px-3 py-1 text-sm" value={t.role} onChange={(e) => handleUpdateCollaboratorRole(t.user_id || t.users?.id, e.target.value)} disabled={!canManage}>
                          <option>Admin</option>
                          <option>Editor</option>
                          <option>View Only</option>
                        </select>
                        {canManage && (
                          <button className="text-gray-400 hover:text-red-600" onClick={() => handleRemoveCollaborator(t.user_id || t.users?.id)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {team.length === 0 && <p className="text-sm text-gray-500">No collaborators</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Add Teammate Modal */}
          {showAddTeammateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Add Teammate</h3>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => { setShowAddTeammateModal(false); setSelectedUserId(''); }}><i className="fas fa-times"></i></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select teammate</label>
                    <select className="w-full border rounded-lg px-3 py-2" value={selectedUserId} onChange={(e)=>setSelectedUserId(e.target.value)}>
                      <option value="">Choose a user</option>
                      {availableOrgUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="px-4 py-2 border rounded-lg" onClick={() => { setShowAddTeammateModal(false); setSelectedUserId(''); }}>Cancel</button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50" disabled={!selectedUserId || isSaving} onClick={saveNewTeammate}>{isSaving ? 'Adding...' : 'Add'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Candidates Tab => Pipeline Board */}
          <div id="candidates-tab" className={activeTab === 'candidates' ? 'tab-content' : 'tab-content hidden'}>
            <JobPipeline embedded={true} jobId={id} />
          </div>

          {/* Activity Tab */}
          <div id="activity-tab" className={activeTab === 'activity' ? 'tab-content' : 'tab-content hidden'}>
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

