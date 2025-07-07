import { useState, useEffect } from 'react';
import { FaBolt, FaKey, FaCopy, FaCheckCircle } from 'react-icons/fa';
import { supabase } from '../../../lib/supabase';
import ZapierWizardModal from './ZapierWizardModal.jsx';

const BACKEND = import.meta.env.VITE_BACKEND_URL;

export default function ZapierIntegrationCard({ user }) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const metaRole = user?.user_metadata?.role || user?.user_metadata?.account_type;
  const roleValue = user?.user_type || user?.role || metaRole;
  const hasAccess = [
    'SuperAdmin',
    'RecruitPro',
    'TeamAdmin',
    'admin',
    'team_admin',
    'member',
    'recruiter',
    'Recruiter',
    'super_admin',
  ].includes(roleValue);

  if (!hasAccess) return null;

  const fetchExistingKey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${BACKEND}/api/apiKeys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.keys && data.keys.length > 0) {
        setApiKey(data.keys[0].key);
      }
    } catch (err) {
      console.error('Error fetching API keys', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExistingKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${BACKEND}/api/apiKeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.apiKey) setApiKey(data.apiKey);
    } catch (err) {
      console.error('Error generating API key', err);
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleGenerateWrapper = async () => {
    if (apiKey) return; // already
    await handleGenerate();
  };

  return (
    <div className="rounded-xl bg-white shadow border px-6 py-5 dark:bg-gray-800 dark:border-gray-700 mt-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-red-500 rounded-lg flex items-center justify-center mr-3">
            <FaBolt className="text-white text-lg" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Zapier / Make Integration</h3>
        </div>
        {apiKey && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
            <FaCheckCircle className="mr-1" />
            Enabled
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
        Generate an API key and connect HirePilot to Zapier or Make. Build workflows that create, update, or enrich leads and trigger automations when pipeline stages change.
      </p>

      {/* API Key Section */}
      <div className="mb-6">
        {apiKey ? (
          <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <FaKey className="text-gray-500 mr-2" />
            <span className="font-mono text-sm break-all flex-1 select-all">{apiKey}</span>
            <button
              onClick={copyKey}
              className="ml-3 text-blue-600 hover:text-blue-800 text-sm flex items-center"
            >
              {copied ? 'Copied!' : (<><FaCopy className="mr-1" />Copy</>)}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate API Key'}
          </button>
        )}
      </div>

      {/* Docs */}
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
        <div className="font-medium">Available Endpoints</div>
        <ul className="list-disc list-inside space-y-1">
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">POST {BACKEND}/api/zapier/leads</code></li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">POST {BACKEND}/api/zapier/enrich</code></li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">GET {BACKEND}/api/zapier/triggers/new-leads</code></li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">GET {BACKEND}/api/zapier/triggers/pipeline-stage-changes</code></li>
        </ul>
      </div>

      {/* Quick Links */}
      <div className="mt-4 flex items-center gap-4">
        <a
          href="https://zapier.com/app/editor/template?url=hirepilot"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View Zapier Template →
        </a>
        <button onClick={()=>setShowWizard(true)} className="text-sm text-blue-600 hover:text-blue-800">Guided Setup →</button>
      </div>

      <ZapierWizardModal
        isOpen={showWizard}
        onClose={()=>setShowWizard(false)}
        apiKey={apiKey}
        onApiKeyGenerated={handleGenerateWrapper}
        onWebhookSaved={()=>{}}
      />
    </div>
  );
} 