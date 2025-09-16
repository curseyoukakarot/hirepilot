import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

export default function TeamSharingSettings({ currentUserRole }: { currentUserRole: string }) {
  const [settings, setSettings] = useState({ shareLeads: false, shareCandidates: false });
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

  const updateSetting = async (field: 'shareLeads' | 'shareCandidates', value: boolean) => {
    try {
      const res = await fetch('/api/team/updateSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      setSettings((prev) => ({ ...prev, [field]: value }));
      toast.success(`${field === 'shareLeads' ? 'Leads' : 'Candidates'} sharing ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating team settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    }
  };

  if (loading) return <p className="text-gray-500">Loading sharing settings...</p>;

  const canManage = ['admin', 'team_admin', 'super_admin'].includes(currentUserRole);

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Team Sharing</h3>
      <p className="text-sm text-gray-500 mb-6">Control shared visibility for leads and candidates across your team.</p>

      {canManage ? (
        <div className="space-y-6">
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
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600 text-sm">
            Your team admin controls sharing preferences for leads and candidates.
          </p>
        </div>
      )}
    </div>
  );
}
