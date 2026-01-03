import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

type TeamMember = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null };

export default function TeamSharingSettings({ currentUserRole }: { currentUserRole: string }) {
  const [settings, setSettings] = useState({
    shareLeads: false,
    shareCandidates: false,
    shareDeals: true,
    allowTeamEditing: false,
    teamAdminViewPool: true,
    shareAnalytics: false,
    analyticsTeamPool: false,
    analyticsAdminViewEnabled: false,
    analyticsAdminViewUserId: null as string | null
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/team/getSettings');
        if (res.ok) {
          const data = await res.json();
          setSettings({
            shareLeads: data.share_leads,
            shareCandidates: data.share_candidates,
            shareDeals:
              data.share_deals === undefined || data.share_deals === null
                ? true
                : !!data.share_deals,
            allowTeamEditing: data.allow_team_editing,
            teamAdminViewPool:
              data.team_admin_view_pool === undefined || data.team_admin_view_pool === null
                ? true
                : data.team_admin_view_pool,
            shareAnalytics: data.share_analytics || false,
            analyticsTeamPool: data.analytics_team_pool || false,
            analyticsAdminViewEnabled: data.analytics_admin_view_enabled || false,
            analyticsAdminViewUserId: data.analytics_admin_view_user_id || null
          });
        } else {
          throw new Error('Failed to fetch settings');
        }
      } catch (error) {
        console.error('Error fetching team settings:', error);
        toast.error('Failed to fetch team settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const normalizedRole = useMemo(() => String(currentUserRole || '').toLowerCase(), [currentUserRole]);
  const canManage = ['admin', 'team_admin', 'team_admins', 'super_admin'].includes(normalizedRole);

  useEffect(() => {
    if (!canManage) {
      setTeamMembers([]);
      return;
    }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: me } = await supabase.from('users').select('team_id').eq('id', user.id).maybeSingle();
        if (!me?.team_id) return;
        const { data: members } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('team_id', me.team_id);
        setTeamMembers(members || []);
      } catch (error) {
        console.error('Failed to load team members for analytics view', error);
      }
    })();
  }, [canManage]);

  const updateSetting = async (field: string, value: any, extraPayload: Record<string, any> = {}) => {
    try {
      const payload: Record<string, any> = { ...extraPayload };
      switch (field) {
        case 'shareLeads':
          payload.shareLeads = value;
          break;
        case 'shareCandidates':
          payload.shareCandidates = value;
          break;
        case 'shareDeals':
          payload.shareDeals = value;
          break;
        case 'allowTeamEditing':
          payload.allowTeamEditing = value;
          break;
        case 'teamAdminViewPool':
          payload.adminViewTeamPool = value;
          break;
        case 'shareAnalytics':
          payload.shareAnalytics = value;
          break;
        case 'analyticsTeamPool':
          payload.analyticsTeamPool = value;
          break;
        case 'analyticsAdminViewEnabled':
          payload.analyticsAdminViewEnabled = value;
          break;
        case 'analyticsAdminViewUserId':
          payload.analyticsAdminViewUserId = value;
          break;
        default:
          payload[field] = value;
      }

      const res = await fetch('/api/team/updateSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      setSettings((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'shareLeads' && !value) {
          next.allowTeamEditing = false;
        }
        if (field === 'analyticsAdminViewEnabled' && !value) {
          next.analyticsAdminViewUserId = null;
        }
        if (field === 'analyticsAdminViewUserId') {
          next.analyticsAdminViewUserId = value;
        }
        if (Object.prototype.hasOwnProperty.call(extraPayload, 'analyticsAdminViewUserId')) {
          next.analyticsAdminViewUserId = extraPayload.analyticsAdminViewUserId;
        }
        return next;
      });
      const label =
        field === 'shareLeads'
          ? 'Leads sharing'
          : field === 'shareCandidates'
            ? 'Candidates sharing'
            : field === 'shareDeals'
              ? 'Deals sharing'
            : field === 'allowTeamEditing'
              ? 'Shared lead editing'
              : field === 'teamAdminViewPool'
                ? 'Team lead pool'
                : field === 'shareAnalytics'
                  ? 'Analytics sharing'
                  : field === 'analyticsTeamPool'
                    ? 'Analytics team pool'
                    : field === 'analyticsAdminViewEnabled'
                      ? 'Admin member analytics'
                      : field === 'analyticsAdminViewUserId'
                        ? 'Analytics member selection'
                        : 'Setting';
      toast.success(
        `${label} ${
          typeof value === 'boolean' ? (value ? 'enabled' : 'disabled') : 'updated'
        }`
      );
    } catch (error) {
      console.error('Error updating team settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    }
  };

  const ensureAdminViewUser = () => {
    if (settings.analyticsAdminViewUserId) return settings.analyticsAdminViewUserId;
    const fallback = teamMembers[0]?.id || null;
    if (fallback) {
      setSettings((prev) => ({ ...prev, analyticsAdminViewUserId: fallback }));
    }
    return fallback;
  };

  if (loading) return <p className="text-gray-500">Loading sharing settings...</p>;

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Team Sharing</h3>
      <p className="text-sm text-gray-500 mb-6">Control shared visibility for leads, candidates, and analytics.</p>

      {canManage ? (
        <div className="space-y-6">
          <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Leads, Candidates & Deals</p>
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Share Leads with Team</span>
              <p className="text-sm text-gray-500">Make your leads visible to all team members</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.shareLeads}
                onChange={(e) => updateSetting('shareLeads', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Show entire team pool to admins</span>
              <p className="text-sm text-gray-500">
                When enabled, team admins automatically see every teammate&apos;s leads and candidates, even if members
                haven&apos;t shared yet.
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.teamAdminViewPool}
                onChange={(e) => updateSetting('teamAdminViewPool', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Allow teammates to edit shared leads</span>
              <p className="text-sm text-gray-500">
                When enabled, members in your team can update shared leads directly.
              </p>
              {!settings.shareLeads && (
                <p className="text-xs text-gray-400 mt-1">Enable lead sharing to unlock this option.</p>
              )}
            </div>
            <label className={`inline-flex items-center ${!settings.shareLeads ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.allowTeamEditing}
                disabled={!settings.shareLeads}
                onChange={(e) => updateSetting('allowTeamEditing', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Share Candidates with Team</span>
              <p className="text-sm text-gray-500">Make your candidates visible to all team members</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.shareCandidates}
                onChange={(e) => updateSetting('shareCandidates', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Share Deals with Team</span>
              <p className="text-sm text-gray-500">When enabled, the /deals page shows a pooled view across the team.</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.shareDeals}
                onChange={(e) => updateSetting('shareDeals', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Analytics</p>

          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Share analytics with team</span>
              <p className="text-sm text-gray-500">Let members access Campaign Performance analytics.</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.shareAnalytics}
                onChange={(e) => updateSetting('shareAnalytics', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-start justify-between py-3 border-b border-gray-200 gap-4">
            <div>
              <span className="font-medium text-gray-900">View a teammate&apos;s analytics</span>
              <p className="text-sm text-gray-500">Toggle on to preview Analytics as a specific team member.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.analyticsAdminViewEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    const fallback = enabled ? ensureAdminViewUser() : null;
                    updateSetting('analyticsAdminViewEnabled', enabled, {
                      analyticsAdminViewUserId: enabled ? fallback : null
                    });
                  }}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
              </label>
              {settings.analyticsAdminViewEnabled && (
                <select
                  className="border rounded px-2 py-1 text-sm min-w-[200px]"
                  value={settings.analyticsAdminViewUserId || ''}
                  onChange={(e) => updateSetting('analyticsAdminViewUserId', e.target.value)}
                >
                  <option value="" disabled>Select teammate</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.first_name || member.last_name
                        ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                        : member.email || 'Unnamed'}
                    </option>
                  ))}
                  {!teamMembers.length && <option value="">No teammates</option>}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <span className="font-medium text-gray-900">Combine team analytics</span>
              <p className="text-sm text-gray-500">Campaign Performance will include every teammate&apos;s outreach.</p>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.analyticsTeamPool}
                onChange={(e) => updateSetting('analyticsTeamPool', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600 text-sm">
            Your team admin controls sharing preferences for leads, candidates, and analytics.
          </p>
        </div>
      )}
    </div>
  );
}
