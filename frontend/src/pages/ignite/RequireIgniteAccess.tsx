import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

type RequireIgniteAccessProps = {
  children: React.ReactNode;
  role?: string | null;
  allowedRoles?: string[];
};

const IGNITE_ALLOWED_ROLES = new Set([
  'ignite_admin',
  'ignite_team',
  'ignite_client',
]);

export default function RequireIgniteAccess({
  children,
  role,
  allowedRoles,
}: RequireIgniteAccessProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setIsAuthed(!!data?.session);
        const sessionRole = String(
          data?.session?.user?.user_metadata?.account_type ||
            data?.session?.user?.user_metadata?.role ||
            data?.session?.user?.app_metadata?.role ||
            ''
        )
          .toLowerCase()
          .replace(/[\s-]/g, '_');
        setResolvedRole(sessionRole);
      } catch {
        if (!mounted) return;
        setIsAuthed(false);
        setResolvedRole('');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading...</div>;
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = String(role || resolvedRole || '')
    .toLowerCase()
    .replace(/\s|-/g, '_');
  const targetRoles = new Set(
    (allowedRoles && allowedRoles.length ? allowedRoles : Array.from(IGNITE_ALLOWED_ROLES)).map((item) =>
      String(item).toLowerCase().replace(/[\s-]/g, '_')
    )
  );
  if (!IGNITE_ALLOWED_ROLES.has(normalizedRole) || !targetRoles.has(normalizedRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account does not have Ignite portal access. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
