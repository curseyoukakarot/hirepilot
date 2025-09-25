import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import TeamMembersList from '../components/TeamMembersList';
import TeamSharingSettings from '../components/TeamSharingSettings';

export default function TeamSettings() {
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [planTier, setPlanTier] = useState('');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setLoading(true);
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUser(null);
          return;
        }
        setUser(user);
        // Get user's role (avoid 406 when no row)
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        setCurrentUserRole(userData?.role || 'member');
        // Get plan tier for gating
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan_tier')
          .eq('user_id', user.id)
          .maybeSingle();
        setPlanTier(String(sub?.plan_tier || ''));
      } catch (error) {
        console.error('Error fetching user data:', error);
        setCurrentUserRole('member');
      } finally {
        setLoading(false);
      }
    };
    fetchUserRole();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading team settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600">You must be logged in to view team settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">Team Settings</h1>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {currentUserRole?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            {/* Collaborators CTA visible for super_admin or any non-free plan */}
            {((String(currentUserRole||'').toLowerCase()==='super_admin') || (String(planTier||'').toLowerCase()!=='free')) && (
              <a href="/settings/team?collaborators=1" className="ml-auto inline-flex items-center px-4 py-2 rounded-md text-sm bg-purple-600 text-white hover:bg-purple-700">
                👤 Collaborators
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Team Members */}
          <TeamMembersList currentUserRole={currentUserRole} />
          {/* Team Sharing Settings */}
          <TeamSharingSettings currentUserRole={currentUserRole} />
        </div>
      </div>
    </div>
  );
}
