import React, { useEffect, useState } from 'react';
import { FaUserPlus, FaEdit, FaTrash, FaCoins, FaKey, FaGear } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'member' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: '' });
  const [creditUser, setCreditUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState(1000);
  const [creditLoading, setCreditLoading] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [featureUser, setFeatureUser] = useState(null);
  const [features, setFeatures] = useState({ rex_enabled: false, zapier_enabled: false });
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const navigate = useNavigate();

  /* ----------------------------------------------
   * Config
   * --------------------------------------------*/
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError('');
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError('Failed to load users');
      }
      setLoading(false);
    };
    fetchUsers();
  }, [success]);

  // Invite user
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(inviteForm),
      });
      if (res.status === 409) {
        const data = await res.json();
        setSuccess(data.message || 'User already exists');
      } else if (!res.ok) {
        throw new Error('Failed to invite user');
      } else {
        setSuccess('User invited successfully!');
      }
      setShowInvite(false);
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'member' });
    } catch (err) {
      setError('Failed to invite user');
    }
    setInviteLoading(false);
  };

  // Edit user
  const handleEdit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update user');
      setSuccess('User updated!');
      setEditUser(null);
    } catch (err) {
      setError('Failed to update user');
    }
  };

  // Assign credits
  const handleAssignCredits = async (e) => {
    e.preventDefault();
    setCreditLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${creditUser.id}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ total_credits: creditAmount }),
      });
      if (!res.ok) throw new Error('Failed to assign credits');
      setSuccess('Credits assigned!');
      setCreditUser(null);
    } catch (err) {
      setError('Failed to assign credits');
    }
    setCreditLoading(false);
  };

  // Delete user
  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setSuccess('User deleted!');
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordUser) return;
    setPasswordLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${passwordUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to reset password');
      }
      setSuccess('Password updated!');
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      setError('Failed to reset password');
    }
    setPasswordLoading(false);
  };

  // Backfill credits for existing users
  const handleBackfillCredits = async () => {
    if (!window.confirm('This will assign credits to all users who don\'t currently have any credits based on their role. Continue?')) return;

    setBackfillLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/users/backfill-credits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Failed to backfill credits');
      
      const result = await res.json();
      setSuccess(`Backfill completed! Processed ${result.successful} users successfully. ${result.errors > 0 ? `${result.errors} errors occurred.` : ''}`);
    } catch (err) {
      setError('Failed to backfill credits');
    }
    
    setBackfillLoading(false);
  };

  // Access control: Only super admins
  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let role = null;
      if (user) {
        const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
        role = data?.role;
      }
      if (role !== 'super_admin') {
        navigate('/dashboard');
      }
    };
    checkRole();
  }, [navigate]);

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            onClick={handleBackfillCredits}
            disabled={backfillLoading}
          >
            <FaCoins /> {backfillLoading ? 'Processing...' : 'Backfill Credits'}
          </button>
          <button
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setShowInvite(true)}
          >
            <FaUserPlus /> Invite User
          </button>
        </div>
      </div>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {success && <div className="mb-4 text-green-600">{success}</div>}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Name</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Email</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Role</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Credits</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">No users found.</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="border-b border-gray-200">
                <td className="px-4 py-2 text-gray-800">{user.firstName} {user.lastName}</td>
                <td className="px-4 py-2 text-gray-800">{user.email}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-700">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-800">{user.balance ?? 0}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button className="p-2 bg-yellow-100 hover:bg-yellow-200 rounded" onClick={() => { setEditUser(user); setEditForm({ firstName: user.firstName, lastName: user.lastName, role: user.role }); }}><FaEdit /></button>
                  <button className="p-2 bg-blue-100 hover:bg-blue-200 rounded" onClick={() => { setCreditUser(user); setCreditAmount(1000); }}><FaCoins /></button>
                  <button className="p-2 bg-purple-100 hover:bg-purple-200 rounded" onClick={() => { setPasswordUser(user); setNewPassword(''); }}><FaKey /></button>
                  <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded" onClick={async () => {
                    const token = (await supabase.auth.getSession()).data.session?.access_token;
                    const res = await fetch(`${BACKEND_URL}/api/admin/users/${user.id}/features`, { headers: { 'Authorization': `Bearer ${token}` }});
                    if (res.ok) {
                      const data = await res.json();
                      setFeatures({ rex_enabled: !!data.rex_enabled, zapier_enabled: !!data.zapier_enabled });
                      setFeatureUser(user);
                    }
                  }} title="Features"><FaGear /></button>
                  <button className="p-2 bg-red-100 hover:bg-red-200 rounded" onClick={() => handleDelete(user.id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite User Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Invite User</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <input type="email" required placeholder="Email" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
              <input type="text" required placeholder="First Name" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} />
              <input type="text" required placeholder="Last Name" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} />
              <select className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
                <option value="super_admin">Super Admin</option>
                <option value="RecruitPro">RecruitPro</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white" disabled={inviteLoading}>{inviteLoading ? 'Inviting...' : 'Invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Edit User</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <input type="text" required placeholder="First Name" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
              <input type="text" required placeholder="Last Name" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
              <select className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
                <option value="super_admin">Super Admin</option>
                <option value="RecruitPro">RecruitPro</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Credits Modal */}
      {creditUser && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Assign Credits</h2>
            <form onSubmit={handleAssignCredits} className="space-y-4">
              <input type="number" min={0} className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={creditAmount} onChange={e => setCreditAmount(Number(e.target.value))} />
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setCreditUser(null)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white" disabled={creditLoading}>{creditLoading ? 'Assigning...' : 'Assign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Set New Password</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="password" required placeholder="New Password" className="w-full border border-gray-300 px-3 py-2 rounded text-gray-800 bg-gray-50" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <div className="flex gap-2 justify-end">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setPasswordUser(null)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white" disabled={passwordLoading}>{passwordLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feature Flags Modal */}
      {featureUser && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Features for {featureUser.email}</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">REX Access</span>
                <input type="checkbox" checked={features.rex_enabled} onChange={(e) => setFeatures(f => ({ ...f, rex_enabled: e.target.checked }))} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Zapier/Make Access</span>
                <input type="checkbox" checked={features.zapier_enabled} onChange={(e) => setFeatures(f => ({ ...f, zapier_enabled: e.target.checked }))} />
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <button className="px-4 py-2 rounded bg-gray-200 text-gray-700" onClick={() => setFeatureUser(null)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-blue-600 text-white" disabled={featuresLoading} onClick={async () => {
                  setFeaturesLoading(true);
                  const token = (await supabase.auth.getSession()).data.session?.access_token;
                  const res = await fetch(`${BACKEND_URL}/api/admin/users/${featureUser.id}/features`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(features)
                  });
                  setFeaturesLoading(false);
                  if (res.ok) {
                    setFeatureUser(null);
                    setSuccess('Features updated');
                    // Force refresh list to reflect sidebar visibility elsewhere
                    const refresh = await fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` }});
                    if (refresh.ok) setUsers(await refresh.json());
                  } else {
                    const err = await res.text();
                    setError(err || 'Failed to update features');
                  }
                }}>{featuresLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 