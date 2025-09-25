import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import JobDetailsCard from '../components/job/JobDetailsCard';
import JobPipeline from './JobPipeline';
import PipelineBoard from '../components/pipeline/PipelineBoard';
import DfyDashboard from './DfyDashboard';
import AddGuestModal from '../components/AddGuestModal';
import UpgradeModal from '../components/UpgradeModal';
import ShareJobModal from '../components/ShareJobModal';

export default function JobRequisitionPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [notes, setNotes] = useState([]);
  const [team, setTeam] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [guestRole, setGuestRole] = useState(''); // '' | 'view_only' | 'commenter'
  const [candidates, setCandidates] = useState({ applied: [], screened: [], interview: [], offer: [] });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [showAddTeammateModal, setShowAddTeammateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [editDescOpen, setEditDescOpen] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const displayName = (u) => {
    if (!u) return 'Unknown';
    if (u.full_name) return u.full_name;
    const snake = [u.first_name, u.last_name].filter(Boolean).join(' ');
    if (snake) return snake;
    const camel = [u.firstName, u.lastName].filter(Boolean).join(' ');
    if (camel) return camel;
    return u.email || 'Unknown';
  };

  const nameFromEmail = (email) => {
    const local = String(email || '').split('@')[0];
    if (!local) return 'Guest';
    const words = local.replace(/[_\.-]+/g, ' ').trim().split(/\s+/);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Guest';
  };

  const initialsFrom = (nameOrEmail) => {
    const base = String(nameOrEmail || '').trim();
    const source = base.includes('@') ? base.split('@')[0] : base;
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return (parts[0][0] || 'U').toUpperCase();
    return 'U';
  };

  const collaboratorDisplayName = (t) => {
    if (t?.users) return displayName(t.users);
    if (t?.email) return nameFromEmail(t.email);
    return 'Unknown';
  };

  const Avatar = ({ user, email, size = 8 }) => {
    const px = typeof size === 'number' ? size : 8;
    const classBase = `w-${px} h-${px} rounded-full flex items-center justify-center text-white text-xs font-semibold`;
    const url = user?.avatar_url;
    const label = user ? displayName(user) : nameFromEmail(email);
    if (url) return <img src={url} className={`w-${px} h-${px} rounded-full object-cover`} />;
    return <div className={`${classBase} bg-gray-400`}>{initialsFrom(label || email)}</div>;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Load current user profile to determine org and permissions
      let profile = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: p } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          profile = p || null;
          setCurrentUser(profile);
          const roleKey = (profile?.role || '').toLowerCase().replace(/[-\s]/g, '_');
          const manageable = ['account_owner','team_admin','super_admin','admin','owner','org_admin'].includes(roleKey);
          setCanManage(manageable);
        }
      } catch {}

      // Use backend endpoint to avoid PGRST116 and include guest authorization
      let jobData = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
        const resp = await fetch(`${base}/api/jobs/${id}`, { headers: { 'Authorization': `Bearer ${session?.access_token || ''}` } });
        if (resp.ok) {
          const js = await resp.json();
          jobData = js.job;
        }
      } catch {}
      if (!jobData) {
        const { data: j } = await supabase.from('job_requisitions').select('*').eq('id', id).maybeSingle();
        jobData = j || null;
      }
      setJob(jobData);
      setKeywords(Array.isArray(jobData?.keywords) ? jobData.keywords : (typeof jobData?.keywords === 'string' ? (jobData.keywords || '').split(',').map(s=>s.trim()).filter(Boolean) : []));
      setDescDraft(jobData?.description || '');
      // Guest access check
      if (profile?.email && jobData?.id) {
        const { data: guestAccess } = await supabase
          .from('job_guest_collaborators')
          .select('role')
          .eq('job_id', jobData.id)
          .eq('email', profile.email)
          .maybeSingle();
        if (guestAccess) {
          const role = String(guestAccess.role || '').toLowerCase().replace(/\s|\+/g,'_');
          setGuestRole(role);
          sessionStorage.setItem('guest_mode', '1');
        }
      }
      if (profile && jobData && (jobData.user_id === profile.id || jobData.created_by === profile.id)) {
        setCanManage(true);
      }

      // Traits replaced by Keywords from Campaign setup / job record

      // Load notes from activity log (note_added)
      try {
        const { data: notesResp } = await supabase
          .from('job_activity_log')
          .select('id, actor_id, created_at, metadata')
          .eq('job_id', id)
          .eq('type', 'note_added')
          .order('created_at', { ascending: true });
        setNotes((notesResp || []).map(r => ({ id: r.id, content: r.metadata?.text || '', actor_id: r.actor_id, created_at: r.created_at })));
      } catch { setNotes([]); }

      // Collaborators (no nested joins) → then fetch users by ids
      const { data: teamData } = await supabase
        .from('job_collaborators')
        .select('user_id, role')
        .eq('job_id', id);
      let mergedTeam = teamData || [];
      if (mergedTeam.length > 0) {
        const ids = [...new Set(mergedTeam.map(r => r.user_id))];
        const { data: userRows } = await supabase
          .from('users')
          .select('*')
          .in('id', ids);
        const byId = new Map((userRows || []).map(u => [u.id, u]));
        mergedTeam = mergedTeam.map(r => ({ ...r, users: byId.get(r.user_id) }));
      }
      const filteredTeam = (mergedTeam || []).filter(r => !profile?.team_id || r.users?.team_id === profile.team_id);
      // Append guest collaborators (email only) to show in Team list
      try {
        const { data: guestRows } = await supabase
          .from('job_guest_collaborators')
          .select('email, role')
          .eq('job_id', id);
        const guestList = guestRows || [];
        const emails = [...new Set(guestList.map(g => String(g.email || '').toLowerCase()).filter(Boolean))];
        let usersByEmail = new Map();
        if (emails.length) {
          const { data: userByEmailRows } = await supabase
            .from('users')
            .select('*')
            .in('email', emails);
          (userByEmailRows || []).forEach(u => usersByEmail.set(String(u.email || '').toLowerCase(), u));
        }
        const guestAsTeam = guestList.map(g => ({ is_guest: true, role: g.role, email: g.email, users: usersByEmail.get(String(g.email || '').toLowerCase()) || null }));
        setTeam([...(filteredTeam || []), ...guestAsTeam]);
      } catch {
        setTeam(filteredTeam);
      }

      // Load team users for Add Teammate
      if (profile?.team_id) {
        const { data: teamRows } = await supabase
          .from('users')
          .select('*')
          .eq('team_id', profile.team_id);
        setOrgUsers(teamRows || []);
      } else {
        setOrgUsers([]);
      }

      const { data: candidatesData } = await supabase
        .from('candidate_jobs')
        .select('status')
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

  const handleEdit = (label) => {
    if (label === 'description') {
      if (guestRole === 'view_only') return;
      setDescDraft(job?.description || '');
      setEditDescOpen(true);
    }
  };

  const saveDescription = async () => {
    if (guestRole === 'view_only') return;
    try {
      setSavingDesc(true);
      await supabase.from('job_requisitions').update({ description: descDraft }).eq('id', id);
      setJob(prev => ({ ...(prev || {}), description: descDraft }));
      // activity log (best-effort)
      try { await supabase.from('job_activity_log').insert({ job_id: id, actor_id: currentUser?.id || null, type: 'description_updated', metadata: {}, created_at: new Date().toISOString() }); } catch {}
      setEditDescOpen(false);
    } catch (e) { alert(e.message || 'Failed to save'); } finally { setSavingDesc(false); }
  };
  const handleAddKeyword = async (kw) => {
    if (guestRole === 'view_only') return;
    const value = (kw || '').trim();
    if (!value) return;
    const next = Array.from(new Set([...(keywords || []), value]));
    setKeywords(next);
    await supabase.from('job_requisitions').update({ keywords: next }).eq('id', id);
  };
  const handleRemoveKeyword = async (kw) => {
    if (guestRole === 'view_only') return;
    const next = (keywords || []).filter(k => k !== kw);
    setKeywords(next);
    await supabase.from('job_requisitions').update({ keywords: next }).eq('id', id);
  };
  const handlePostNote = async () => {
    if (guestRole === 'view_only') return;
    const text = (noteText || '').trim();
    if (!text) return;
    const row = {
      job_id: id,
      actor_id: currentUser?.id || null,
      type: 'note_added',
      metadata: { text },
      created_at: new Date().toISOString()
    };
    await supabase.from('job_activity_log').insert(row);
    setNotes(prev => [...prev, { id: crypto.randomUUID?.() || String(Date.now()), content: text, actor_id: currentUser?.id || null, created_at: new Date().toISOString() }]);
    setNoteText('');
  };
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
      // log
      await supabase.from('job_activity_log').insert({
        job_id: id,
        actor_id: currentUser?.id || null,
        type: 'collaborator_role_changed',
        metadata: { target_user_id: userId, role: newRole },
        created_at: new Date().toISOString()
      });
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
      await supabase.from('job_activity_log').insert({
        job_id: id,
        actor_id: currentUser?.id || null,
        type: 'collaborator_removed',
        metadata: { target_user_id: userId },
        created_at: new Date().toISOString()
      });
    } catch (e) {
      alert('Failed to remove collaborator: ' + (e.message || e));
    }
  };

  const saveNewTeammate = async () => {
    if (!selectedUserId) return;
    try {
      setIsSaving(true);
      
      // Use the new collaborator API endpoint with notifications
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
      
      const response = await fetch(`${base}/api/collaborators/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jobId: id,
          userId: selectedUserId,
          role: 'Editor'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add collaborator');
      }

      const result = await response.json();
      
      // Find the added user from orgUsers
      const addedUser = (orgUsers || []).find(u => u.id === selectedUserId);
      
      // Add to team state with proper format
      if (addedUser) {
        setTeam(prev => [...prev, { 
          user_id: selectedUserId, 
          role: 'Editor', 
          users: addedUser 
        }]);
      }
      
      // Show success message with notification info
      const notificationInfo = result.notifications;
      let successMessage = '✅ Collaborator added — they will now see this job in their Jobs list.';
      if (notificationInfo.slack || notificationInfo.email) {
        const notifications = [];
        if (notificationInfo.slack) notifications.push('Slack');
        if (notificationInfo.email) notifications.push('Email');
        successMessage += ` (${notifications.join(' & ')} notification sent)`;
      }
      
      toast.success(successMessage);
      
      setShowAddTeammateModal(false);
      setSelectedUserId('');
    } catch (e) {
      toast.error('❌ Failed to add collaborator. Please try again.');
      console.error('Failed to add collaborator:', e);
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
    // If the user is a guest for this job, render minimal shell instead of blocking
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">Job not found</div>
    );
  }

  // In-app access control (optional): allow if owner, collaborator, or guest
  const hasCollabAccess = () => {
    if (!currentUser || !job) return false;
    if (job.user_id === currentUser.id || job.created_by === currentUser.id) return true;
    const isTeamCollab = (team || []).some(t => (t.user_id || t.users?.id) === currentUser.id);
    // Guest collaborator based on job_guest_collaborators entry matched by email
    const isGuestByInvite = Boolean(guestRole);
    return isTeamCollab || isGuestByInvite;
  };

  if (!hasCollabAccess()) {
    // Guests should not see premium gating modal
    if (guestRole) {
      return <div className="min-h-screen bg-gray-50 flex items-center justify-center">No access</div>;
    }
    return <UpgradeModal feature="Job Collaboration" onClose={() => window.history.back()} />;
  }

  return (
    <>
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
                    <div key={i} className="border-2 border-white rounded-full">
                      <Avatar user={t.users} email={t.email} size={8} />
                    </div>
                  ))}
                </div>

                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" onClick={() => setShareOpen(true)}>
                  <i className="fas fa-share-alt mr-2"></i>
                  Share
                </button>

                <button className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700" onClick={() => window.location.assign('/rex-chat')}>
                  <i className="fas fa-robot mr-2"></i>
                  REX
                </button>

                <div className="relative">
                  <button className="p-2 text-gray-400 hover:text-gray-600" onClick={() => setShowActionsMenu(v => !v)}>
                    <i className="fas fa-ellipsis-h"></i>
                  </button>
                  {showActionsMenu && (
                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border z-10">
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50" onClick={() => { setShowActionsMenu(false); const next = prompt('Edit job name', job.title || ''); if (next != null && next.trim() && next !== job.title) { (async()=>{ try { await supabase.from('job_requisitions').update({ title: next.trim() }).eq('id', id); setJob(prev => ({ ...(prev||{}), title: next.trim() })); await supabase.from('job_activity_log').insert({ job_id: id, actor_id: currentUser?.id || null, type: 'job_title_updated', metadata: { title: next.trim() }, created_at: new Date().toISOString() }); } catch(e) { alert('Failed to update title'); } })(); } }}>
                        Edit Name (Job Req)
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => { setShowActionsMenu(false); if (!confirm('Delete this job requisition? This cannot be undone.')) return; (async()=>{ try { await supabase.from('job_requisitions').delete().eq('id', id); window.location.assign('/jobs'); } catch(e) { alert('Failed to delete'); } })(); }}>
                        Delete
                      </button>
                    </div>
                  )}
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
              <button
                className={`tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'dfy' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('dfy')}
              >
                Dashboard
              </button>
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        <main id="main-content" className="w-full">
          {/* Overview Tab */}
          <div id="overview-tab" className={activeTab === 'overview' ? 'tab-content' : 'tab-content hidden'}>
            <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Role Description */}
                <div id="role-description" className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Role Description</h3>
                    <button className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50" onClick={() => handleEdit('description')} disabled={guestRole==='view_only'}>
                      <i className="fas fa-edit mr-1"></i>
                      Edit
                    </button>
                  </div>
                  <div className="prose max-w-none text-gray-600 whitespace-pre-line">
                    {job.description || "No description provided."}
                  </div>
                </div>

                {/* Keywords (replaces Success Profile) */}
                <div id="keywords" className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Keywords</h3>
                    {canManage && guestRole !== 'view_only' && (
                      <button className="text-sm text-blue-600 hover:text-blue-700" onClick={() => {
                        const v = prompt('Add keyword');
                        if (v) handleAddKeyword(v);
                      }}>
                        <i className="fas fa-plus mr-1"></i>
                        Add Keyword
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(keywords || []).length === 0 && <p className="text-sm text-gray-500">No keywords yet</p>}
                    {(keywords || []).map((k) => (
                      <span key={k} className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 text-xs">
                        {k}
                        {canManage && guestRole !== 'view_only' && (
                          <button className="text-blue-400 hover:text-blue-700" onClick={()=>handleRemoveKeyword(k)} title="Remove">×</button>
                        )}
                      </span>
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
                        <img src={''} className="w-8 h-8 rounded-full" />
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700">{n.content}</p>
                          </div>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <span>{n.actor_id || 'Unknown'}</span>
                            <span className="mx-1">•</span>
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <textarea placeholder="Add a note..." value={noteText} onChange={(e)=>setNoteText(e.target.value)} className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none disabled:bg-gray-50" rows="3" disabled={guestRole==='view_only'}></textarea>
                    <div className="flex justify-end mt-2">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50" onClick={handlePostNote} disabled={guestRole==='view_only'}>Post</button>
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
                        <Avatar user={t.users} email={t.email} size={8} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{collaboratorDisplayName(t)}</p>
                          <p className="text-xs text-gray-500">{t.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Team Tab */}
          <div id="team-tab" className={activeTab === 'team' ? 'tab-content' : 'tab-content hidden'}>
            <div className="max-w-7xl mx-auto px-6 py-6">
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
                      <button className="inline-flex items-center px-4 py-2 text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md text-sm" onClick={() => setShowAddGuestModal(true)}>
                        <i className="fas fa-user-plus mr-2"></i>
                        + Add Guest
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
                        <Avatar user={t.users} email={t.email} size={10} />
                        <div>
                          <p className="font-medium text-gray-900">{collaboratorDisplayName(t)}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-500">{t.users?.email || t.email || ''}</p>
                            {t.is_guest && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 border">Guest</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <select className="border border-gray-200 rounded-md px-3 py-1 text-sm" value={t.role} onChange={(e) => handleUpdateCollaboratorRole(t.user_id || t.users?.id, e.target.value)} disabled={!canManage || t.is_guest}
                        >
                          <option>Admin</option>
                          <option>Editor</option>
                          <option>View Only</option>
                        </select>
                        {canManage && !t.is_guest && (
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
                        <option key={u.id} value={u.id}>{displayName(u)} — {u.email}</option>
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

          {/* Edit Description Modal */}
          {editDescOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg w-full max-w-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Edit Job Description</h3>
                  <button className="text-gray-400 hover:text-gray-600" onClick={()=>setEditDescOpen(false)}>✕</button>
                </div>
                <textarea className="w-full border rounded p-3 min-h-[240px]" value={descDraft} onChange={(e)=>setDescDraft(e.target.value)} placeholder="Paste or write the job description..." />
                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-4 py-2 border rounded" onClick={()=>setEditDescOpen(false)}>Cancel</button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={savingDesc} onClick={saveDescription}>{savingDesc ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </div>
          )}

          <AddGuestModal
            open={showAddGuestModal}
            onClose={() => { setShowAddGuestModal(false); setGuestEmail(''); }}
            onSubmit={async ({ email, role }) => {
              try {
                // Use server endpoint to avoid RLS and ensure activity is logged
                const { data: { session } } = await supabase.auth.getSession();
                const base = (import.meta.env.VITE_BACKEND_URL || (window.location.host.endsWith('thehirepilot.com') ? 'https://api.thehirepilot.com' : 'http://localhost:8080')).replace(/\/$/, '');
                const resp = await fetch(`${base}/api/opportunities/${id}/guest-invite`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
                  body: JSON.stringify({ email })
                });
                if (!resp.ok) {
                  const err = await resp.json().catch(()=>({}));
                  throw new Error(err?.error || 'Failed to invite guest');
                }
                // Backend now handles emailing both guests and existing users.
                // Reload data to reflect correct collaborator vs guest state.
                await fetchData();
                setShowAddGuestModal(false);
                setGuestEmail('');
              } catch (e) { alert('Failed to invite guest: ' + (e.message || e)); }
            }}
          />

          {/* Candidates Tab => Pipeline Board (full-width) */}
          <div id="candidates-tab" className={activeTab === 'candidates' ? 'tab-content' : 'tab-content hidden'}>
            <div className="px-0 py-0">
              <PipelineBoard jobId={id} />
            </div>
          </div>

          {/* Activity Tab */}
          <div id="activity-tab" className={activeTab === 'activity' ? 'tab-content' : 'tab-content hidden'}>
            <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
              </div>
              <div className="p-6">
                <ActivityFeed jobId={id} />
              </div>
            </div>
            </div>
          </div>

          {/* Dashboard Tab */}
          <div id="dfy-tab" className={activeTab === 'dfy' ? 'tab-content' : 'tab-content hidden'}>
            <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
                </div>
              </div>
              <div className="p-0">
                <DfyDashboard embedded={true} jobId={id} />
              </div>
            </div>
            </div>
          </div>
        </main>
      </div>
    </div>
    {shareOpen && <ShareJobModal job={job} open={shareOpen} onClose={()=>setShareOpen(false)} />}
    </>
  );
}

function ActivityFeed({ jobId }) {
  const [items, setItems] = React.useState([]);
  const [actors, setActors] = React.useState({});

  React.useEffect(() => {
    const load = async () => {
      let { data } = await supabase
        .from('job_activity_log')
        .select('id, job_id, actor_id, type, metadata, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      data = data || [];
      setItems(data);
      const actorIds = [...new Set(data.map(d => d.actor_id).filter(Boolean))];
      if (actorIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .in('id', actorIds);
        const map = {};
        (users || []).forEach(u => { map[u.id] = u; });
        setActors(map);
      }
    };
    load();
  }, [jobId]);

  const renderText = (it) => {
    const actor = actors[it.actor_id];
    const who = actor ? (actor.full_name || [actor.first_name, actor.last_name].filter(Boolean).join(' ') || actor.email) : 'Someone';
    const m = it.metadata || {};
    switch ((it.type || '').toLowerCase()) {
      case 'collaborator_added':
        return `${who} added ${m.target_user_id || 'a teammate'} as ${m.role || 'Editor'}`;
      case 'collaborator_removed':
        return `${who} removed ${m.target_user_id || 'a teammate'}`;
      case 'collaborator_role_changed':
        return `${who} changed a teammate to ${m.role || 'Editor'}`;
      case 'guest_invited':
        return `${who} invited ${m.email} as ${m.role || 'View Only'}`;
      case 'comment_posted':
        return `${who} commented`;
      case 'note_added':
        return `${who} added a note`;
      case 'candidate_moved':
        return `${who} moved a candidate to ${m.stage_title || m.stage_id}`;
      case 'rex_triggered':
        return `${who} triggered REX`;
      default:
        return `${who} did ${it.type}`;
    }
  };

  if (!items.length) {
    return <p className="text-sm text-gray-500">No activity yet</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {items.map(it => (
        <li key={it.id} className="py-4 flex items-start gap-3">
          <img src={(actors[it.actor_id]?.avatar_url) || ''} className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">{renderText(it)}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(it.created_at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

