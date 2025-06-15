import React, { useState, useEffect } from 'react';
import { FaSlack, FaCircleInfo, FaGear } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function SettingsNotifications() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    campaignUpdates: true,
    teamActivity: true,
    slackWebhookUrl: null,
    slackChannel: null
  });
  const [loading, setLoading] = useState(true);
  const [showSlackModal, setShowSlackModal] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First try to get existing settings
      let { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // If no settings exist, create default settings
      if (error && error.code === 'PGRST116') {
        const defaultSettings = {
          user_id: user.id,
          email_notifications: true,
          campaign_updates: true,
          team_activity: true,
          slack_webhook_url: null,
          slack_channel: null
        };

        const { data: newData, error: insertError } = await supabase
          .from('user_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;
        data = newData;
      } else if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          emailNotifications: data.email_notifications,
          campaignUpdates: data.campaign_updates,
          teamActivity: data.team_activity,
          slackWebhookUrl: data.slack_webhook_url,
          slackChannel: data.slack_channel
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (field, value) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates = {};
      switch (field) {
        case 'emailNotifications':
          updates.email_notifications = value;
          break;
        case 'campaignUpdates':
          updates.campaign_updates = value;
          break;
        case 'teamActivity':
          updates.team_activity = value;
          break;
      }

      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [field]: value }));
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const handleSlackConnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to connect Slack');
        return;
      }
      
      console.log('Making request to:', `${import.meta.env.VITE_BACKEND_URL}/api/auth/slack/init`);
      
      // Add authorization header to the request
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/slack/init`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Log the raw response for debugging
      const responseText = await response.text();
      console.log('Raw server response:', responseText);
      
      // Only try to parse as JSON if we got a JSON response
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Unexpected content type:', contentType);
        throw new Error('Server did not return JSON');
      }
      
      const data = JSON.parse(responseText);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect to Slack');
      }
      
      if (data.url) {
        console.log('Redirecting to Slack URL:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      toast.error('Failed to connect to Slack');
    }
  };

  const handleSlackDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .update({
          slack_webhook_url: null,
          slack_channel: null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        slackWebhookUrl: null,
        slackChannel: null
      }));
      toast.success('Slack disconnected');
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
      toast.error('Failed to disconnect Slack');
    }
  };

  const handleSlackChannelUpdate = async (channel) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_settings')
        .update({ slack_channel: channel })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, slackChannel: channel }));
      setShowSlackModal(false);
      toast.success('Slack channel updated');
    } catch (error) {
      console.error('Error updating Slack channel:', error);
      toast.error('Failed to update Slack channel');
    }
  };

  const sendTestNotification = async () => {
    try {
      toast.loading('Sending test notification...', { id: 'slack-test' });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to send test notification', { id: 'slack-test' });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/slack/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      toast.success('Test notification sent to Slack!', { id: 'slack-test' });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification', { id: 'slack-test' });
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Manage how you receive notifications</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Email Notifications */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Email Notifications</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.emailNotifications}
                  onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-t">
                <div>
                  <p className="font-medium">Campaign Updates</p>
                  <p className="text-sm text-gray-500">Get notified about campaign status changes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.campaignUpdates}
                    onChange={(e) => updateSetting('campaignUpdates', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-3 border-t">
                <div>
                  <p className="font-medium">Team Activity</p>
                  <p className="text-sm text-gray-500">Notifications about team member actions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.teamActivity}
                    onChange={(e) => updateSetting('teamActivity', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Slack Integration */}
          <div className="pt-6 border-t">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium">Slack Integration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Get notifications directly in your Slack workspace
                </p>
              </div>
              {settings.slackWebhookUrl ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={sendTestNotification}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Send Test Message
                  </button>
                  <button
                    onClick={() => setShowSlackModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <FaGear className="text-xl" />
                  </button>
                  <button
                    onClick={handleSlackDisconnect}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSlackConnect}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <FaSlack className="inline-block mr-2" /> Connect Slack
                </button>
              )}
            </div>

            {settings.slackWebhookUrl ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-3">
                    <FaCircleInfo className="text-blue-500" />
                    <p>
                      Connected to channel: <span className="font-medium">#{settings.slackChannel || 'general'}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <FaCircleInfo className="text-blue-500" />
                  <p>
                    Connect your Slack workspace to receive real-time notifications about important updates and
                    activities.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slack Channel Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Slack Channel Settings</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Channel Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. general"
                value={settings.slackChannel || ''}
                onChange={(e) => handleSlackChannelUpdate(e.target.value)}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the channel name without the # symbol
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => setShowSlackModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => setShowSlackModal(false)}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
