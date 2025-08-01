import { useState, useEffect } from "react";
import { FaSlack, FaCheckCircle } from "react-icons/fa";
import { supabase } from "../../../lib/supabase";

export default function RexSlackIntegrationCard({ user }) {
  // Toggle state – default enabled for demo
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState("#Slack workspace");

  const metaRole = user?.user_metadata?.role || user?.user_metadata?.account_type;
  const roleValue = user?.user_type || user?.role || metaRole;

  const hasAccess = [
    "SuperAdmin",
    "RecruitPro",
    "TeamAdmin",
    "recruiter",
    "Recruiter",
    "super_admin",
    "admin",
  ].includes(roleValue);

  if (!hasAccess) return null;

  // fetch current toggle once user is present
  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('users')
        .select('rex_slack_enabled')
        .eq('id', user.id)
        .single();
      if (!error && data) setEnabled(Boolean(data.rex_slack_enabled));

      // check slack_accounts presence
      const { data: slackRow } = await supabase
        .from('slack_accounts')
        .select('team_name')
        .eq('user_id', user.id)
        .single();
      if (slackRow) {
        setConnected(true);
        if (slackRow.team_name) setChannel(slackRow.team_name);
      }
    })();
  }, [user]);

  const refreshStatus = async () => {
    if (!user) return;
    const { data: slackRow } = await supabase
      .from('slack_accounts')
      .select('team_name')
      .eq('user_id', user.id)
      .single();
    setConnected(Boolean(slackRow));
    if (slackRow?.team_name) setChannel(slackRow.team_name);
  };

  const handleToggle = async () => {
    const newVal = !enabled;
    setEnabled(newVal);
    if (user?.id) {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/integrations/slack/enabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, enabled: newVal })
      });
    }
  };

  return (
    <div className="rounded-xl bg-white shadow border px-6 py-5 dark:bg-gray-800 dark:border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
            <FaSlack className="text-white text-lg" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            REX Slack Integration
          </h3>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
          <FaCheckCircle className="mr-1" />
          Connected
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
        Enable Slack-based automation and notifications through REX. Once
        connected, REX can message you directly inside Slack to coordinate
        outreach, post campaign insights, and handle updates in real time.
      </p>

      {/* Workspace Info */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center">
        <FaSlack className="text-purple-600 mr-2" />
        <span className="text-sm text-gray-700 dark:text-gray-200">
          Connected to {channel}
        </span>
      </div>

      {/* Toggle + Disconnect */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-3">
            Enable REX Slack Notifications
          </span>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
              enabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-500"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {connected ? (
          <button
            onClick={async () => {
              if (!confirm('Disconnect Slack?')) return;
              await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/slack/disconnect`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
              });
              await refreshStatus();
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={async () => {
              const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/slack/connect?user_id=${user.id}`);
              const { url } = await res.json();
              const popup = window.open(url, '_blank', 'width=600,height=700');
              const timer = setInterval(async () => {
                if (popup?.closed) {
                  clearInterval(timer);
                  await refreshStatus();
                }
              }, 1500);
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Connect to Slack
          </button>
        )}
      </div>
    </div>
  );
} 