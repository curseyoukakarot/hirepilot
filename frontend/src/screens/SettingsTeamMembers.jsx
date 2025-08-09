import React, { useState, useEffect } from 'react';
import { FaCrown, FaUser, FaEye, FaPlus, FaTrash, FaEnvelope, FaUserPlus, FaClock, FaGear, FaXmark, FaKey, FaBolt, FaRobot } from 'react-icons/fa6';
import InviteTeamMemberModal from '../components/InviteTeamMemberModal';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

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
  const [requireCheckout, setRequireCheckout] = useState(false);

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
        .single();
      setPlanTier(subscription?.plan_tier || null);
      if (subscription) {
        setRequireCheckout((subscription.seat_count || 0) >= (subscription.included_seats || 1));
      }

      // Fetch current user only (team owner until team concept implemented)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id);

      if (usersError) throw usersError;

      // Fetch invites created BY the current user or sent TO current user
      const { data: invites, error: invitesError } = await supabase
        .from('team_invites')
        .select('*')
        .eq('status', 'pending')
        .or(`invited_by.eq.${user.id},email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      setTeamMembers(users);
      setPendingInvites(invites);
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
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
  const userRole = currentUser?.user_metadata?.role || currentUser?.user_metadata?.account_type;
  const roleAllowsInvite = ['admin', 'team_admin', 'super_admin'].includes(userRole);
  const isStarter = (planTier === 'starter');
  const canInvite = roleAllowsInvite && !isStarter;

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

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Invites</h3>
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
                            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                              Pending
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
      </div>
    </div>
  );
}
