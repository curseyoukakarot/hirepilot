import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { apiPost } from '../lib/api';

const backendBase = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');

export default function WorkspaceInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (!token) {
          setError('Invite token missing.');
          return;
        }
        const resp = await fetch(`${backendBase}/api/workspace-invites/${token}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || body.message || 'Failed to load invite');
        }
        const data = await resp.json();
        setInvite(data);
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user?.email) setUserEmail(String(auth.user.email).toLowerCase());
      } catch (e) {
        setError(e?.message || 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate(`/login?next=${encodeURIComponent(`/workspace-invite?token=${token}`)}`);
        return;
      }
      const resp = await apiPost(`/api/workspace-invites/${token}/accept`, {});
      const workspaceId = resp?.workspace_id;
      if (workspaceId) {
        try {
          window.localStorage.setItem('hp_active_workspace_id', String(workspaceId));
        } catch {}
      }
      navigate('/workspaces', { replace: true });
    } catch (e) {
      setError(e?.message || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-200">
        Loading invite...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-200">
        {error}
      </div>
    );
  }

  const isExpired = invite?.is_expired;
  const isAccepted = invite?.status && invite.status !== 'pending';
  const emailMismatch = userEmail && invite?.email && userEmail !== String(invite.email).toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950 p-8 text-gray-100">
        <h1 className="text-2xl font-semibold">Workspace Invite</h1>
        <p className="mt-2 text-sm text-gray-400">
          You were invited to join <strong>{invite?.workspace?.name || 'a workspace'}</strong>.
        </p>

        <div className="mt-4 space-y-1 text-sm text-gray-300">
          <div>Email: {invite?.email}</div>
          <div>Role: {invite?.role}</div>
          {invite?.invited_by?.email && (
            <div>
              Invited by: {invite.invited_by.first_name || invite.invited_by.last_name
                ? `${invite.invited_by.first_name || ''} ${invite.invited_by.last_name || ''}`.trim()
                : invite.invited_by.email}
            </div>
          )}
        </div>

        {isExpired && (
          <div className="mt-4 text-sm text-red-300">
            This invite has expired. Ask the workspace admin for a new link.
          </div>
        )}
        {isAccepted && (
          <div className="mt-4 text-sm text-amber-300">
            This invite has already been {invite?.status}.
          </div>
        )}
        {emailMismatch && (
          <div className="mt-4 text-sm text-amber-300">
            You are signed in as a different email. Please log in with {invite?.email}.
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800"
          >
            Sign in
          </button>
          <button
            type="button"
            disabled={accepting || isExpired || isAccepted || emailMismatch}
            onClick={handleAccept}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {accepting ? 'Accepting...' : 'Accept Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
