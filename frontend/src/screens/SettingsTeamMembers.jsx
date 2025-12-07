import React, { useState, useEffect } from 'react';
import { FaCrown, FaUser, FaEye, FaPlus, FaTrash, FaEnvelope, FaUserPlus, FaClock, FaGear, FaXmark, FaKey, FaBolt, FaRobot } from 'react-icons/fa6';
import InviteTeamMemberModal from '../components/InviteTeamMemberModal';
import { supabase } from '../lib/supabaseClient';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import GuestCollaboratorModal from '../components/GuestCollaboratorModal';

export default function SettingsTeamMembers() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEmailActionModalOpen, setIsEmailActionModalOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [planTier, setPlanTier] = useState(null);
  const [dbRole, setDbRole] = useState('');
  const [requireCheckout, setRequireCheckout] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [collabEdit, setCollabEdit] = useState(null);
  const [collabDeleteOpen, setCollabDeleteOpen] = useState(false);
  const [collabDeleteRow, setCollabDeleteRow] = useState(null);
  const [jobOptions, setJobOptions] = useState([]);
  const [teamSettings, setTeamSettings] = useState({
    shareLeads: false,
    shareCandidates: false,
    allowTeamEditing: false
  });

  const handleOpenInviteModal = () => setIsInviteModalOpen(true);
  const handleCloseInviteModal = () => setIsInviteModalOpen(false);

  const openRoleModal = (invite) => {
    setSelectedInvite(invite);
    setSelectedRole(invite.role);
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setIsRoleModalOpen(false);
    setSelectedInvite(null);
    setSelectedRole('');
  };

  const openDeleteModal = (invite) => {
    setSelectedInvite(invite);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedInvite(null);
  };

  const openEmailActionModal = (invite) => {
    setSelectedInvite(invite);
    setIsEmailActionModalOpen(true);
  };

  const closeEmailActionModal = () => {
    setIsEmailActionModalOpen(false);
    setSelectedInvite(null);
  };

  const handleRoleChange = async () => {
    if (!selectedInvite || !selectedRole) return;

    try {
      // Update the role in team_invites table
      const { error: updateError } = await supabase
        .from('team_invites')
        .update({ role: selectedRole })
        .eq('id', selectedInvite.id);

      if (updateError) throw updateError;

      toast.success('Role updated successfully');
      closeRoleModal();
      fetchTeamData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch subscription to determine plan tier and seats
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_tier, seat_count, included_seats')
        .eq('user_id', user.id)
        .maybeSingle();
      setPlanTier(subscription?.plan_tier || null);
      if (subscription) {
        setRequireCheckout((subscription.seat_count || 0) >= (subscription.included_seats || 1));
      }

      // Fetch current user profile to get team_id
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setDbRole(currentUserProfile?.role || '');

      // Fetch all team members if user has a team
      let users = [currentUserProfile];
      if (currentUserProfile?.team_id) {
        const { data: teamUsers, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('team_id', currentUserProfile.team_id);
        
        if (usersError) throw usersError;
        users = teamUsers || [currentUserProfile];
      }

      // Fetch invites created BY the current user or sent TO current user
      const { data: invites, error: invitesError } = await supabase
        .from('team_invites')
        .select('*')
        .in('status', ['pending', 'accepted'])
        .or(`invited_by.eq.${user.id},email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      setTeamMembers(users);
      setPendingInvites(invites);

      // Jobs for collaborator assignment
      const { data: jobs } = await supabase.from('job_requisitions').select('id,title').eq('user_id', user.id);
      setJobOptions(jobs || []);
      // Preload collaborators so they appear without toggling
      try {
        const { data: collabRows } = await supabase
          .from('job_guest_collaborators')
          .select('id,email,role,created_at,job_id, job_requisitions(title)')
          .order('created_at', { ascending: false });
        setCollaborators(collabRows || []);
      } catch {}
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
    fetchTeamSettings();
  }, []);

  const handleEmailAction = async (action) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/team/invite/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          inviteId: selectedInvite.id,
          action: action 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to process email action');
      }

      toast.success(
        action === 'reset' 
          ? 'Password reset email sent' 
          : 'Invitation resent successfully', 
        {
          duration: 4000,
          icon: '✉️',
        }
      );
      closeEmailActionModal();
      fetchTeamData();
    } catch (error) {
      console.error('Error with email action:', error);
      toast.error(error.message || 'Failed to process email action', {
        duration: 4000,
      });
    }
  };

  const handleDeleteInvite = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/team/invite/${selectedInvite.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete invitation');
      }

      toast.success('Invitation deleted successfully', {
        duration: 4000,
        icon: '🗑️',
      });
      closeDeleteModal();
      fetchTeamData();
    } catch (error) {
      console.error('Error deleting invite:', error);
      toast.error(error.message || 'Failed to delete invitation. Please try again.', {
        duration: 4000,
      });
    }
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return <FaCrown className="text-yellow-500" />;
      case 'member':
        return <FaUser className="text-blue-500" />;
      case 'team_admin':
        return <FaUser className="text-purple-500" />;
      case 'viewer':
        return <FaUser className="text-gray-400" />;
      default:
        return <FaUser className="text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800';
      case 'member':
        return 'bg-blue-100 text-blue-800';
      case 'team_admin':
        return 'bg-purple-100 text-purple-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // derive UI gating by role (Starter=member; Pro=admin; Team=team_admin; super_admin)
  const userRoleMeta = (currentUser?.user_metadata?.role || currentUser?.user_metadata?.account_type || '').toLowerCase();
  const userRoleDb = String(dbRole || '').toLowerCase();
  const effectiveRole = userRoleDb || userRoleMeta;
  const roleAllowsInvite = ['admin', 'team_admin', 'super_admin'].includes(effectiveRole);
  const allowedPlans = ['pro','team','recruitpro'];
  const allowedRoles = ['admin','team_admin','super_admin'];
  const planKey = (planTier || '').toLowerCase();
  const canInvite = roleAllowsInvite && planKey !== 'starter';
  // Show collaborators for super_admin or any non-free plan
  const canSeeCollaborators = (effectiveRole === 'super_admin') || (planKey !== 'free');

  useEffect(() => {
    if (effectiveRole === 'super_admin') setShowCollaborators(true);
  }, [effectiveRole]);

  const loadCollaborators = async () => {
    setCollabLoading(true);
    try {
      const { data } = await supabase
        .from('job_guest_collaborators')
        .select('id,email,role,created_at,job_id, job_requisitions(title)')
        .order('created_at', { ascending: false });
      const rows = data || [];
      // Derive acceptance by calling backend guest-status (Auth Admin lookup)
      const emails = Array.from(new Set(rows.map(r => r.email).filter(Boolean)));
      let acceptedMap = {};
      if (emails.length) {
        try {
          const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/guest-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails }) });
          if (resp.ok) {
            const js = await resp.json();
            acceptedMap = js.accepted || {};
          }
        } catch {}
      }
      setCollaborators(rows.map(r => ({ ...r, __accepted: !!acceptedMap[String(r.email || '').toLowerCase()] })));
    } finally { setCollabLoading(false); }
  };

  useEffect(() => { if (showCollaborators) loadCollaborators(); }, [showCollaborators]);

  const addCollaborator = async () => {
    if (!newCollab.email) return;
    try {
      setCollabLoading(true);
      // open modal submit handled below
    } finally {}
  };

  const updateCollabRole = async (row, role) => {
    await supabase.from('job_guest_collaborators').update({ role }).eq('id', row.id);
    await loadCollaborators();
  };

  const deleteCollab = async (row) => {
    if (!confirm('Delete collaborator?')) return;
    await supabase.from('job_guest_collaborators').delete().eq('id', row.id);
    await loadCollaborators();
  };

  // Team sharing settings functions
  const fetchTeamSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's team_id
      const { data: userData } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userData?.team_id) return;

      // Get team settings
      const { data: settings } = await supabase
        .from('team_settings')
        .select('share_leads, share_candidates, allow_team_editing')
        .eq('team_id', userData.team_id)
        .maybeSingle();

      if (settings) {
        setTeamSettings({
          shareLeads: settings.share_leads || false,
          shareCandidates: settings.share_candidates || false,
          allowTeamEditing: settings.allow_team_editing || false
        });
      }
    } catch (error) {
      console.error('Error fetching team settings:', error);
    }
  };

  const updateTeamSetting = async (setting, value) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Call backend so server can populate team_admin_id
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/team/updateSettings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          shareLeads: setting === 'shareLeads' ? value : undefined,
          shareCandidates: setting === 'shareCandidates' ? value : undefined,
          allowTeamEditing:
            setting === 'allowTeamEditing'
              ? value
              : (setting === 'shareLeads' && value === false ? false : undefined),
        })
      });
      const js = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(js?.error || 'Failed to update team settings');

      // Update local state
      setTeamSettings(prev => {
        const next = { ...prev, [setting]: value };
        if (setting === 'shareLeads' && value === false) {
          next.allowTeamEditing = false;
        }
        return next;
      });

      // Backend already updates all existing records. No additional client-side update.

      const toastLabel =
        setting === 'shareLeads'
          ? 'Leads sharing'
          : setting === 'shareCandidates'
            ? 'Candidates sharing'
            : 'Shared lead editing';
      toast.success(`${toastLabel} ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating team setting:', error);
      toast.error('Failed to update team setting');
    }
  };

  const updateAllRecordsSharing = async (setting, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const table = setting === 'shareLeads' ? 'leads' : 'candidates';
      const column = 'shared';

      // Update all user's records
      const { error } = await supabase
        .from(table)
        .update({ [column]: value })
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating records sharing:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your team members and their roles</p>
          </div>
          {canInvite && (
            <button 
              onClick={handleOpenInviteModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2 text-sm font-medium flex items-center"
            >
              <FaPlus className="mr-2" /> Invite Member
            </button>
          )}
          {canSeeCollaborators && (
            <button
              onClick={() => setShowCollaborators(s => !s)}
              className={`ml-2 border rounded-xl px-4 py-2 text-sm ${showCollaborators ? 'bg-gray-100' : ''}`}
            >
              👤 Collaborators
            </button>
          )}
        </div>

        {/* Role Permissions */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Role Permissions</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaCrown className="text-yellow-500" />
                <span className="font-medium">Admin</span>
              </div>
              <p className="text-gray-500">Full access to all features and settings</p>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaUser className="text-blue-500" />
                <span className="font-medium">Member</span>
              </div>
              <p className="text-gray-500">Can manage campaigns and view analytics</p>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaUser className="text-purple-500" />
                <span className="font-medium">Team Admin</span>
              </div>
              <p className="text-gray-500">Manage team seats & billing</p>
            </div>
          </div>
        </div>

        {/* Team Sharing Settings */}
        <div className="mb-8 p-4 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Sharing</h3>
          <p className="text-sm text-gray-500 mb-4">Control shared visibility for leads and candidates across your team.</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-gray-900">Share Leads with Team</span>
                <p className="text-sm text-gray-500">Make your leads visible to all team members</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={teamSettings.shareLeads}
                  onChange={() => updateTeamSetting('shareLeads', !teamSettings.shareLeads)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-gray-900">Allow teammates to edit shared leads</span>
                <p className="text-sm text-gray-500">
                  When enabled, anyone in your team can update leads shared with them.
                </p>
                {!teamSettings.shareLeads && (
                  <p className="text-xs text-gray-400 mt-1">Turn on lead sharing to enable this option.</p>
                )}
              </div>
              <label className={`inline-flex items-center ${!teamSettings.shareLeads ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={teamSettings.allowTeamEditing}
                  disabled={!teamSettings.shareLeads}
                  onChange={() => updateTeamSetting('allowTeamEditing', !teamSettings.allowTeamEditing)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium text-gray-900">Share Candidates with Team</span>
                <p className="text-sm text-gray-500">Make your candidates visible to all team members</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={teamSettings.shareCandidates}
                  onChange={() => updateTeamSetting('shareCandidates', !teamSettings.shareCandidates)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading team members...</p>
          </div>
        ) : teamMembers.length === 0 && pendingInvites.length === 0 ? (
          // Empty State
          <div className="text-center p-8 border-2 border-dashed rounded-lg">
            <div className="inline-flex justify-center items-center w-12 h-12 bg-blue-50 rounded-full mb-4">
              <FaUserPlus className="text-blue-600 text-xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Members Yet</h3>
            <p className="text-gray-500 mb-4">Invite team members to collaborate on campaigns and share access.</p>
            <button 
              onClick={handleOpenInviteModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 inline-flex items-center"
            >
              <FaPlus className="mr-2" /> Invite Your First Team Member
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Team Members */}
            {teamMembers.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Active Members</h3>
                <div className="bg-white rounded-lg border divide-y">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <img 
                          src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.first_name + ' ' + member.last_name)}&background=random`}
                          alt={`${member.first_name} ${member.last_name}`}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{member.first_name} {member.last_name}</h4>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                              {member.role}
                            </span>
                            {member.id === currentUser?.id && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">You</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(member.role)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Invites */}
            {pendingInvites.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Invites</h3>
                <div className="bg-white rounded-lg border divide-y">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <FaClock className="text-gray-400" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{invite.first_name} {invite.last_name}</h4>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(invite.role)}`}>
                              {invite.role}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              invite.status === 'accepted' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {invite.status === 'accepted' ? 'Active' : 'Pending'}
                            </span>
                            {/* Integration icons (visual only) */}
                            <span className="inline-flex items-center gap-1 ml-2 text-gray-500">
                              <FaRobot title="REX" />
                              <FaBolt title="Zapier/Make" />
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{invite.email}</p>
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-3">
                            <span>Invited {format(new Date(invite.created_at), 'MMM d, yyyy')}</span>
                            <span className="text-gray-500">Credits: {invite.role === 'member' ? 350 : invite.role === 'admin' ? 1000 : 500}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => openEmailActionModal(invite)}
                          className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded-full transition-colors"
                          title="Resend Invitation"
                        >
                          <FaEnvelope className="text-lg" />
                        </button>
                        <button
                          onClick={() => openRoleModal(invite)}
                          className="text-gray-600 hover:text-gray-700 p-1 hover:bg-gray-50 rounded-full transition-colors"
                          title="Change Role"
                        >
                          <FaGear className="text-lg" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(invite)}
                          className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete Invitation"
                        >
                          <FaTrash className="text-lg" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {canSeeCollaborators && showCollaborators && (
          <div className="mt-8">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Guest Collaborators</h3>
                  <p className="text-sm text-gray-500">Manage external collaborators across your job requisitions.</p>
                </div>
                <button className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm" onClick={()=>{ setCollabEdit(null); setCollabModalOpen(true); }}>+ Add Collaborator</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Name/Email</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-left">Job Requisitions</th>
                      <th className="px-3 py-2 text-left">Date Invited</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {collabLoading ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
                    ) : (collaborators || []).map(row => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-full" />
                            <div>
                              <div className="text-gray-900">{row.email}</div>
                              {row.user_id && <div className="text-xs text-gray-500">linked</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select value={row.role} onChange={(e)=>updateCollabRole(row, e.target.value)} className="border rounded px-2 py-1 text-sm">
                            <option>View Only</option>
                            <option>Commenter</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {row.job_requisitions?.title || '—'}
                        </td>
                        <td className="px-3 py-2">{row.created_at ? format(new Date(row.created_at),'MMM d, yyyy') : '—'}</td>
                        <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{row.__accepted ? 'Accepted' : 'Invited'}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button className="text-gray-600" onClick={()=>{ setCollabEdit({ email: row.email, role: row.role, jobs: row.job_id ? [row.job_id] : [] }); setCollabModalOpen(true); }}>✏️</button>
                            <button className="text-red-600" onClick={()=>{ setCollabDeleteRow(row); setCollabDeleteOpen(true); }}>🗑️</button>
                            {!row.user_id && <button className="text-blue-600" onClick={async()=>{ await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/send-guest-invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: row.email, job_id: row.job_id, role: row.role }) }); toast.success(`Invite resent to ${row.email}`); }}>✉️</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!collabLoading && (collaborators || []).length === 0) && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No collaborators yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && selectedInvite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Delete Invitation</h2>
                <button 
                  onClick={closeDeleteModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaXmark />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600">
                  Are you sure you want to delete the invitation for{' '}
                  <span className="font-medium">{selectedInvite.first_name} {selectedInvite.last_name}</span>?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteInvite}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete Invitation
                </button>
              </div>
            </div>
          </div>
        )}

        <InviteTeamMemberModal 
          isOpen={isInviteModalOpen}
          onClose={handleCloseInviteModal}
          onInviteSuccess={fetchTeamData}
          requireCheckout={requireCheckout}
        />

        {/* Role Change Modal */}
        {isRoleModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Change Role</h2>
                <button 
                  onClick={closeRoleModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaXmark />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Change role for {selectedInvite?.first_name} {selectedInvite?.last_name}
                </p>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeRoleModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRoleChange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Action Modal */}
        {isEmailActionModalOpen && selectedInvite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Email Actions</h2>
                <button 
                  onClick={closeEmailActionModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaXmark />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Select an action for <span className="font-medium">{selectedInvite.email}</span>
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleEmailAction('invite')}
                    disabled={selectedInvite.status === 'active'}
                    className={`w-full px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 ${
                      selectedInvite.status === 'active'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <FaEnvelope />
                    <span>Resend Invitation Email</span>
                  </button>
                  <button
                    onClick={() => handleEmailAction('reset')}
                    disabled={selectedInvite.status !== 'active'}
                    className={`w-full px-4 py-2 text-white rounded-md flex items-center justify-center space-x-2 ${
                      selectedInvite.status !== 'active'
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    <FaKey />
                    <span>Send Password Reset</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={closeEmailActionModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Collaborator Modal */}
        <GuestCollaboratorModal
          open={collabModalOpen}
          onClose={()=>{ setCollabModalOpen(false); setCollabEdit(null); }}
          mode={collabEdit ? 'edit' : 'add'}
          defaultValues={collabEdit || {}}
          jobOptions={jobOptions}
          loading={collabLoading}
          onSubmit={async ({ email, role, jobs }) => {
            try {
              setCollabLoading(true);
              if (collabEdit) {
                // update: set role for all rows with this email (simplified)
                await supabase.from('job_guest_collaborators').update({ role }).eq('email', email);
              } else {
                const list = (jobs && jobs.length ? jobs : [null]);
                for (const jid of list) {
                  if (jid) {
                    // use backend route to ensure status and constraints are consistent
                    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${jid}/guest-invite`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email })
                    });
                  } else {
                    // For non-job invites, fall back to direct insert without 'status' (column not in schema)
                    await supabase.from('job_guest_collaborators').insert({ email, role, job_id: null, invited_by: currentUser?.id || null });
                    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/send-guest-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, job_id: null, role }) });
                  }
                }
              }
              setCollabModalOpen(false); setCollabEdit(null);
              await loadCollaborators();
              toast.success(collabEdit ? 'Collaborator updated' : 'Collaborator invited');
            } catch (e) { toast.error(e.message || 'Failed to save'); } finally { setCollabLoading(false); }
          }}
        />

        {/* Delete Collaborator Modal */}
        {collabDeleteOpen && collabDeleteRow && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Delete Collaborator</h3>
                <button className="text-gray-400 hover:text-gray-600" onClick={()=>{ setCollabDeleteOpen(false); setCollabDeleteRow(null); }}>✕</button>
              </div>
              <p className="text-sm text-gray-600 mb-6">Are you sure you want to remove {collabDeleteRow.email}? They will lose access to linked job requisitions.</p>
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 border rounded" onClick={()=>{ setCollabDeleteOpen(false); setCollabDeleteRow(null); }}>Cancel</button>
                <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={async()=>{ await supabase.from('job_guest_collaborators').delete().eq('id', collabDeleteRow.id); setCollabDeleteOpen(false); setCollabDeleteRow(null); await loadCollaborators(); toast.success('Collaborator deleted'); }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
