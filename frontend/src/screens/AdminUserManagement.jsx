import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaUserPlus, FaEdit, FaTrash, FaCoins, FaKey, FaCog, FaEye, FaUserSecret, FaEnvelope, FaPaperPlane, FaListAlt, FaGamepad, FaTable } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import UserDetailDrawer from '../components/UserDetailDrawer';
import BulkAddToTableModal from '../components/tables/BulkAddToTableModal';

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
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [dripModalOpen, setDripModalOpen] = useState(false);
  const [dripSubmitting, setDripSubmitting] = useState(false);
  const [dripPlan, setDripPlan] = useState('all'); // all | free | paid
  const [selectedTemplates, setSelectedTemplates] = useState(new Set());
  const [dripUserIds, setDripUserIds] = useState(new Set());
  const [dripUserSearch, setDripUserSearch] = useState('');
  const [featureUser, setFeatureUser] = useState(null);
  const [features, setFeatures] = useState({ rex_enabled: false, zapier_enabled: false });
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [viewUserId, setViewUserId] = useState(null);
  const [impersonating, setImpersonating] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sendToTableOpen, setSendToTableOpen] = useState(false);
  const pageSize = 50;

  // Email Status modal state
  const [emailStatusOpen, setEmailStatusOpen] = useState(false);
  const [emailStatusLoading, setEmailStatusLoading] = useState(false);
  const [emailStatusPlan, setEmailStatusPlan] = useState('all'); // all | free | paid
  const [emailStatusQuery, setEmailStatusQuery] = useState('');
  const [emailStatusData, setEmailStatusData] = useState([]); // [{ id,email,plan,name,sent,queued,completed,failed }]

  const navigate = useNavigate();

  /* ----------------------------------------------
   * Config
   * --------------------------------------------*/
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const selectAllRef = useRef(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((users?.length || 0) / pageSize)), [users, pageSize]);
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return (users || []).slice(start, end);
  }, [users, currentPage, pageSize]);
  const pageStart = users.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = users.length === 0 ? 0 : Math.min(currentPage * pageSize, users.length);
  const selectedUsers = useMemo(
    () => (users || []).filter((u) => selectedUserIds.has(u.id)),
    [users, selectedUserIds]
  );
  const allSelectedOnPage = pagedUsers.length > 0 && pagedUsers.every((u) => selectedUserIds.has(u.id));
  const someSelectedOnPage = pagedUsers.some((u) => selectedUserIds.has(u.id)) && !allSelectedOnPage;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelectedOnPage;
  }, [someSelectedOnPage]);

  useEffect(() => {
    if (!users || users.length === 0) {
      setSelectedUserIds(new Set());
      return;
    }
    const validIds = new Set(users.map((u) => u.id));
    const next = new Set(Array.from(selectedUserIds).filter((id) => validIds.has(id)));
    if (next.size !== selectedUserIds.size) {
      setSelectedUserIds(next);
    }
  }, [users, selectedUserIds]);

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

  const fetchEmailStatus = async () => {
    setEmailStatusLoading(true);
    setError('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const params = new URLSearchParams();
      if (emailStatusQuery) params.set('user', emailStatusQuery);
      if (emailStatusPlan !== 'all') params.set('plan', emailStatusPlan);
      const res = await fetch(`${BACKEND_URL}/api/admin/email/status?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load email status');
      const json = await res.json();
      setEmailStatusData(json.users || []);
    } catch (e) {
      setError('Failed to load email status');
    }
    setEmailStatusLoading(false);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        pagedUsers.forEach((u) => next.delete(u.id));
      } else {
        pagedUsers.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

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

  // Backfill Free Welcome Emails (server computes recipients)
  // Drip Backfill Modal helpers
  const DRIP_TEMPLATES = {
    free: [
      { key: 'drip.free.campaign', label: 'Free: Campaign', template: 'drip-free-campaign' },
      { key: 'drip.free.rex', label: 'Free: REX', template: 'drip-free-rex' },
      { key: 'drip.free.csv', label: 'Free: CSV', template: 'drip-free-csv' },
      { key: 'drip.free.extension', label: 'Free: Extension', template: 'drip-free-extension' },
      { key: 'drip.free.requests', label: 'Free: LinkedIn Requests', template: 'drip-free-requests' },
      { key: 'drip.free.leads', label: 'Free: Leads', template: 'drip-free-leads' },
    ],
    paid: [
      { key: 'drip.paid.agent', label: 'Paid: Agent Mode', template: 'drip-paid-agent' },
      { key: 'drip.paid.rex', label: 'Paid: REX Advanced', template: 'drip-paid-rex' },
      { key: 'drip.paid.deals', label: 'Paid: Deals', template: 'drip-paid-deals' },
      { key: 'drip.paid.leads', label: 'Paid: Leads', template: 'drip-paid-leads' },
      { key: 'drip.paid.candidates', label: 'Paid: Candidates', template: 'drip-paid-candidates' },
      { key: 'drip.paid.reqs', label: 'Paid: Job REQs', template: 'drip-paid-reqs' },
    ]
  };

  const toggleTemplate = (tpl) => {
    const next = new Set(selectedTemplates);
    if (next.has(tpl)) next.delete(tpl); else next.add(tpl);
    setSelectedTemplates(next);
  };

  const selectAllForPlan = (plan) => {
    const next = new Set(selectedTemplates);
    DRIP_TEMPLATES[plan].forEach(t => next.add(t.template));
    setSelectedTemplates(next);
  };

  const clearAll = () => setSelectedTemplates(new Set());

  const submitDripBackfill = async () => {
    try {
      setDripSubmitting(true);
      setError('');
      setSuccess('');
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const body = {
        plan: dripPlan === 'all' ? undefined : dripPlan,
        templates: Array.from(selectedTemplates),
        user_ids: Array.from(dripUserIds)
      };
      const templates = body.templates || [];
      const jobSeekerWelcomeSelected = templates.includes('jobseeker-welcome');
      const dripTemplatesOnly = templates.filter(t => t !== 'jobseeker-welcome');
      body.templates = dripTemplatesOnly;
      if (!body.templates || body.templates.length === 0) delete body.templates;
      if (!body.user_ids || body.user_ids.length === 0) delete body.user_ids;
      let dripResult = null;
      if (dripTemplatesOnly.length > 0 || dripPlan !== 'all') {
        const res = await fetch(`${BACKEND_URL}/api/admin/users/backfill-drips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Failed to enqueue drips');
        dripResult = await res.json().catch(() => null);
      }

      let jsResult = null;
      if (jobSeekerWelcomeSelected) {
        const jsBody = { mode: 'backfill' };
        const selectedIds = Array.from(dripUserIds);
        // IMPORTANT: only send user_ids if the admin explicitly selected users.
        // If we send an empty array, the backend treats it as a filter and will match nobody.
        if (selectedIds.length > 0) jsBody.user_ids = selectedIds;
        const res2 = await fetch(`${BACKEND_URL}/api/admin/send-jobseeker-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(jsBody)
        });
        const json2 = await res2.json().catch(() => ({}));
        if (!res2.ok) throw new Error(json2?.error || 'Failed to backfill job seeker welcome');
        jsResult = json2;
      }

      const parts = [];
      if (dripResult) parts.push(`Enqueued ${dripResult.enqueued} drip emails for ${dripResult.plan} users.`);
      if (jsResult) {
        const sent = (jsResult.results || []).filter((r) => r.sent).length;
        const failed = (jsResult.results || []).length - sent;
        parts.push(`Job Seeker welcome sent: ${sent}${failed ? `, failed: ${failed}` : ''}`);
      }
      setSuccess(parts.join(' '));
      setDripModalOpen(false);
      setSelectedTemplates(new Set());
      setDripPlan('all');
      setDripUserIds(new Set());
    } catch (e) {
      setError(e?.message || 'Failed to enqueue drips');
    } finally {
      setDripSubmitting(false);
    }
  };

  const handleBackfillWelcome = async () => {
    if (!window.confirm('Send Free Forever welcome email to all eligible users who have not received it yet?')) return;
    setWelcomeLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/send-free-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mode: 'backfill' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to backfill welcome emails');
      const sent = (json.results || []).filter((r) => r.sent).length;
      const failed = (json.results || []).length - sent;
      setSuccess(`Welcome emails sent: ${sent}${failed ? `, failed: ${failed}` : ''}`);
    } catch (err) {
      setError(err.message || 'Failed to backfill welcome emails');
    }
    setWelcomeLoading(false);
  };

  // Send welcome for a single user
  const handleSendWelcomeSingle = async (user) => {
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/send-free-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ recipients: [{ id: user.id, email: user.email, first_name: user.firstName || 'there' }] })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to send welcome email');
      const ok = Array.isArray(json.results) && json.results[0]?.sent;
      setSuccess(ok ? `Welcome email sent to ${user.email}` : `Failed to send to ${user.email}`);
    } catch (err) {
      setError(err.message || 'Failed to send welcome email');
    }
  };

  // Send Job Seeker welcome for a single user (job_seeker_* tiers)
  const handleSendJobSeekerWelcomeSingle = async (user) => {
    setError('');
    setSuccess('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/send-jobseeker-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ recipients: [{ id: user.id, email: user.email, first_name: user.firstName || 'there' }] })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to send job seeker welcome email');
      const ok = Array.isArray(json.results) && json.results[0]?.sent;
      setSuccess(ok ? `Job Seeker welcome sent to ${user.email}` : `Failed to send to ${user.email}`);
    } catch (err) {
      setError(err.message || 'Failed to send job seeker welcome email');
    }
  };

  // Impersonate user
  const handleImpersonate = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to impersonate ${userEmail}?`)) {
      return;
    }

    try {
      setImpersonating(true);
      
      // Store current session before impersonating
      const currentSession = await supabase.auth.getSession();
      if (currentSession.data.session) {
        // Back-compat for older banner implementations
        localStorage.setItem('superAdminSession', JSON.stringify(currentSession.data));

        // Cross-subdomain cookie storage (so "Exit Impersonation" works on jobs.* too)
        const s = currentSession.data.session;
        const rootDomain = window.location.hostname.endsWith('thehirepilot.com') ? '.thehirepilot.com' : undefined;
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `hp_super_admin_session=${encodeURIComponent(JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token
        }))}; Path=/; SameSite=Lax${secure}${rootDomain ? `; Domain=${rootDomain}` : ''}; Max-Age=${60 * 60 * 24}`;

        // Where to return after exiting impersonation
        document.cookie = `hp_super_admin_return=${encodeURIComponent(window.location.href)}; Path=/; SameSite=Lax${secure}${rootDomain ? `; Domain=${rootDomain}` : ''}; Max-Age=${60 * 60 * 24}`;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${BACKEND_URL}/api/admin/impersonateUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Impersonation error response:', error);
        throw new Error(error.error || 'Failed to impersonate user');
      }

      const { action_link } = await res.json();
      
      // IMPORTANT: Clear local Supabase client session before redirecting to the magic link.
      // This prevents stale JWTs (old session_id) from being used during callback hydration,
      // which can cause 403 session_not_found on /auth/v1/user.
      try {
        const mod = await import('../auth/clearSupabaseLocalState');
        mod.clearSupabaseLocalState();
      } catch {}
      
      // Redirect to the impersonation link
      window.location.href = action_link;
    } catch (error) {
      console.error('Error impersonating user:', error);
      setError(error.message || 'Failed to impersonate user');
      setImpersonating(false);
    }
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
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
            onClick={handleBackfillWelcome}
            disabled={welcomeLoading}
          >
            <FaEnvelope /> {welcomeLoading ? 'Sending…' : 'Backfill Free Welcome Emails'}
          </button>
          <button
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            onClick={handleBackfillCredits}
            disabled={backfillLoading}
          >
            <FaCoins /> {backfillLoading ? 'Processing...' : 'Backfill Credits'}
          </button>
          <button
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            onClick={() => { setDripModalOpen(true); setDripUserIds(new Set(selectedUserIds.size ? Array.from(selectedUserIds) : [])); }}
          >
            <FaPaperPlane /> Backfill Drips
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded ${selectedUserIds.size ? 'bg-slate-700 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            onClick={() => selectedUserIds.size && setSendToTableOpen(true)}
            disabled={!selectedUserIds.size}
          >
            <FaTable /> Send to Table
          </button>
          <button
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded hover:bg-rose-700"
            onClick={() => { setEmailStatusOpen(true); fetchEmailStatus(); }}
          >
            <FaListAlt /> Email Status
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

  {/* Backfill Drips Modal */}
  {dripModalOpen && (
    <div className="fixed inset-0 bg-black bg-opacity-20 z-50 overflow-y-auto">
      <div className="mx-auto my-8 bg-white rounded-lg p-6 w-[calc(100%-2rem)] max-w-3xl shadow-lg border border-gray-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Backfill Drip Emails</h2>
          <button onClick={() => setDripModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* User selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select users</label>
          <div className="flex items-center gap-2 mb-2">
            <input className="border rounded px-3 py-2 w-full" placeholder="Search by email or name" value={dripUserSearch} onChange={(e)=>setDripUserSearch(e.target.value)} />
            <button className="text-sm text-indigo-600" onClick={()=> setDripUserIds(new Set(users.map(u=>u.id)))}>Select all</button>
            <button className="text-sm text-gray-600" onClick={()=> setDripUserIds(new Set())}>Clear</button>
          </div>
          <div className="max-h-40 overflow-auto border rounded p-3 space-y-2">
            {(users || [])
              .filter(u => !dripUserSearch || `${u.firstName || ''} ${u.lastName || ''} ${u.email}`.toLowerCase().includes(dripUserSearch.toLowerCase()))
              .map(u => (
                <label key={u.id} className="flex items-center gap-2 text-gray-800">
                  <input type="checkbox" checked={dripUserIds.has(u.id)} onChange={()=>{
                    const next = new Set(dripUserIds);
                    if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                    setDripUserIds(next);
                  }}/>
                  <span>{u.firstName} {u.lastName} · {u.email}</span>
                  {u.plan && <span className="ml-auto text-xs text-gray-500">{String(u.plan).toUpperCase()}</span>}
                </label>
              ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Target plan</label>
          <div className="flex gap-4 text-gray-800">
            {['all','free','paid'].map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input type="radio" name="drip-plan" checked={dripPlan === p} onChange={() => setDripPlan(p)} />
                <span className="capitalize">{p}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-800">Free templates</h3>
              <button className="text-sm text-indigo-600" onClick={() => selectAllForPlan('free')}>Select all</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto border rounded p-3">
              {DRIP_TEMPLATES.free.map(t => (
                <label key={t.template} className="flex items-center gap-2 text-gray-800">
                  <input type="checkbox" checked={selectedTemplates.has(t.template)} onChange={() => toggleTemplate(t.template)} />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-800">Paid templates</h3>
              <button className="text-sm text-indigo-600" onClick={() => selectAllForPlan('paid')}>Select all</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto border rounded p-3">
              {DRIP_TEMPLATES.paid.map(t => (
                <label key={t.template} className="flex items-center gap-2 text-gray-800">
                  <input type="checkbox" checked={selectedTemplates.has(t.template)} onChange={() => toggleTemplate(t.template)} />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-medium text-gray-800 mb-2">Job Seeker (all tiers)</h3>
          <div className="space-y-2 border rounded p-3">
            <label className="flex items-center gap-2 text-gray-800">
              <input
                type="checkbox"
                checked={selectedTemplates.has('jobseeker-welcome')}
                onChange={() => toggleTemplate('jobseeker-welcome')}
              />
              <span>Job Seeker Welcome</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button className="text-sm text-gray-600" onClick={clearAll}>Clear selection</button>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded bg-gray-200 text-gray-800" onClick={() => setDripModalOpen(false)}>Cancel</button>
            <button className={`px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 ${dripSubmitting ? 'opacity-70 cursor-not-allowed':''}`} onClick={submitDripBackfill} disabled={dripSubmitting}>
              {dripSubmitting ? 'Enqueuing…' : 'Enqueue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Email Status Modal */}
  {emailStatusOpen && (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm">
      <div className="mx-auto my-6 sm:my-10 bg-white rounded-2xl p-6 w-[calc(100%-2rem)] max-w-5xl shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Email Status</h2>
          <button onClick={() => setEmailStatusOpen(false)} className="text-gray-500 hover:text-gray-700 transition">✕</button>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by user</label>
            <input className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-400 transition" placeholder="Search by email or id" value={emailStatusQuery} onChange={(e)=>setEmailStatusQuery(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select className="border border-gray-300 px-3 py-2 rounded-lg text-gray-800 bg-gray-50 focus:outline-none" value={emailStatusPlan} onChange={(e)=>setEmailStatusPlan(e.target.value)}>
              <option value="all">All</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <button onClick={fetchEmailStatus} className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition">Refresh</button>
        </div>

        {/* Content */}
        <div className="min-h-[160px] max-h-[75vh] overflow-y-auto pr-1">
          {emailStatusLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500 animate-pulse">Loading…</div>
          ) : (emailStatusData || []).length === 0 ? (
            <div className="text-center py-16 text-gray-500">No matching users.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emailStatusData.map((u) => (
                <div key={u.id} className="rounded-xl border border-gray-200 p-4 bg-white/80 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{u.name || '—'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${String(u.plan).toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>{String(u.plan || '').toUpperCase() || '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Queued</div>
                      <div className="space-y-1 max-h-28 overflow-auto pr-1">
                        {(u.queued || []).map((q, idx) => (
                          <div key={idx} className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                            <div className="truncate font-medium">{q.event_key || q.template || '—'}</div>
                            <div className="text-[10px] text-gray-500">next: {q.next_run_at || '—'}</div>
                          </div>
                        ))}
                        {(u.queued || []).length === 0 && <div className="text-xs text-gray-400">None</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Sent</div>
                      <div className="space-y-1 max-h-28 overflow-auto pr-1">
                        {(u.sent || []).slice(0,6).map((s, idx) => (
                          <div key={idx} className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                            <div className="truncate font-medium">{s.event_type}</div>
                            <div className="text-[10px] text-gray-500">at: {s.created_at}</div>
                          </div>
                        ))}
                        {(u.sent || []).length === 0 && <div className="text-xs text-gray-400">None</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-1">Failed</div>
                      <div className="space-y-1 max-h-28 overflow-auto pr-1">
                        {(u.failed || []).map((f, idx) => (
                          <div key={idx} className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                            <div className="truncate font-medium">{f.event_key || f.template || '—'}</div>
                            <div className="text-[10px] text-red-600">{f.failed_reason || 'failed'}</div>
                          </div>
                        ))}
                        {(u.failed || []).length === 0 && <div className="text-xs text-gray-400">None</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )}
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelectedOnPage}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Select all users on this page"
                />
              </th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Name</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Email</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Role</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Credits</th>
              <th className="px-4 py-2 text-left bg-gray-100 border-b border-gray-200 text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No users found.</td></tr>
            ) : pagedUsers.map(user => (
              <tr key={user.id} className="border-b border-gray-200">
                <td className="px-4 py-2 text-gray-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    aria-label={`Select ${user.email}`}
                  />
                </td>
                <td className="px-4 py-2 text-gray-800">{user.firstName} {user.lastName}</td>
                <td className="px-4 py-2 text-gray-800">{user.email}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-700">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-800">{user.balance ?? 0}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button 
                    className="p-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded" 
                    onClick={() => setViewUserId(user.id)}
                    title="View User Details"
                  >
                    <FaEye />
                  </button>
                  <button
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded"
                    title="Backfill Drips for this user"
                    onClick={() => {
                      setSelectedTemplates(new Set());
                      setDripPlan(String(user.plan || '').toLowerCase() === 'free' ? 'free' : 'paid');
                      setDripUserIds(new Set([user.id]));
                      setDripModalOpen(true);
                    }}
                  >
                    <FaPaperPlane />
                  </button>
                  <button 
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded" 
                    onClick={() => handleImpersonate(user.id, user.email)}
                    disabled={impersonating}
                    title="Impersonate User"
                  >
                    <FaUserSecret />
                  </button>
                  <button className="p-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded" onClick={() => { setEditUser(user); setEditForm({ firstName: user.firstName, lastName: user.lastName, role: user.role }); }}><FaEdit /></button>
                  <button className="p-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded" onClick={() => { setCreditUser(user); setCreditAmount(1000); }}><FaCoins /></button>
                  <button className="p-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded" onClick={() => { setPasswordUser(user); setNewPassword(''); }}><FaKey /></button>
                  <button className="p-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded" title="Send Welcome Email" onClick={() => handleSendWelcomeSingle(user)}><FaEnvelope /></button>
                  {String(user.role || '').toLowerCase().startsWith('job_seeker_') && (
                    <button
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded"
                      title="Send Job Seeker Welcome (Controller)"
                      onClick={() => handleSendJobSeekerWelcomeSingle(user)}
                    >
                      <FaGamepad />
                    </button>
                  )}
                  <button className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded" onClick={async () => {
                    const token = (await supabase.auth.getSession()).data.session?.access_token;
                    const res = await fetch(`${BACKEND_URL}/api/admin/users/${user.id}/features`, { headers: { 'Authorization': `Bearer ${token}` }});
                    if (res.ok) {
                      const data = await res.json();
                      setFeatures({ rex_enabled: !!data.rex_enabled, zapier_enabled: !!data.zapier_enabled });
                      setFeatureUser(user);
                    }
                  }} title="Features"><FaCog /></button>
                  <button className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded" onClick={() => handleDelete(user.id)}><FaTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3 text-sm text-gray-600">
        <div>
          Showing {pageStart}-{pageEnd} of {users.length} • Selected {selectedUserIds.size}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
          <button
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <BulkAddToTableModal
        open={sendToTableOpen}
        onClose={() => setSendToTableOpen(false)}
        entity="users"
        ids={Array.from(selectedUserIds)}
        onSuccess={() => setSelectedUserIds(new Set())}
      />

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
                <option value="team_admin">Team Admin</option>
                <option value="viewer">Viewer</option>
                <option value="super_admin">Super Admin</option>
                <option value="RecruitPro">RecruitPro</option>
                <option value="free">Free (Recruiter)</option>
                <option value="job_seeker_free">Job Seeker Free</option>
                <option value="job_seeker_pro">Job Seeker Pro</option>
                <option value="job_seeker_elite">Job Seeker Elite</option>
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
                <option value="team_admin">Team Admin</option>
                <option value="viewer">Viewer</option>
                <option value="super_admin">Super Admin</option>
                <option value="RecruitPro">RecruitPro</option>
                <option value="free">Free (Recruiter)</option>
                <option value="job_seeker_free">Job Seeker Free</option>
                <option value="job_seeker_pro">Job Seeker Pro</option>
                <option value="job_seeker_elite">Job Seeker Elite</option>
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

      {/* User Detail Drawer */}
      <UserDetailDrawer userId={viewUserId} onClose={() => setViewUserId(null)} />
    </div>
  );
} 