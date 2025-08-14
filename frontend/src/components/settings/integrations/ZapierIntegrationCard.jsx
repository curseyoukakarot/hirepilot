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

  // Expose Zapier/Make integration to all authenticated users regardless of role

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

      {/* Available Event Types */}
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-3 mb-6">
        <div className="font-medium">🎯 Available Event Types</div>
        <div className="grid gap-3">
          <div>
            <div className="font-medium text-xs text-blue-600 dark:text-blue-400 mb-1">🧍 LEADS & CANDIDATES</div>
            <div className="text-xs space-y-1">
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">lead_created</code> - New lead added</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">lead_updated</code> - Lead details changed</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">lead_converted</code> - Lead becomes candidate</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">lead_enriched</code> - Apollo enrichment</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_created</code> - New candidate added</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_hired</code> - Candidate hired!</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_rejected</code> - Candidate rejected</div>
            </div>
          </div>
          
          <div>
            <div className="font-medium text-xs text-purple-600 dark:text-purple-400 mb-1">📊 PIPELINE STAGES</div>
            <div className="text-xs space-y-1">
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_moved_to_stage</code> - Generic stage change</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_interviewed</code> - Marked as interviewed</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_offered</code> - Offer stage reached</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">candidate_moved_to_*</code> - Dynamic stage events</div>
            </div>
          </div>

          <div>
            <div className="font-medium text-xs text-green-600 dark:text-green-400 mb-1">🔔 MESSAGING</div>
            <div className="text-xs space-y-1">
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">message_sent</code> - Outbound message sent</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">message_reply</code> - Candidate replied</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">email_opened</code> - Email opened</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">email_clicked</code> - Email link clicked</div>
              <div><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">email_bounced</code> - Email failed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Endpoints */}
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
        <div className="font-medium">🔗 Trigger Endpoints</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><code className="bg-blue-50 dark:bg-gray-600 px-1 rounded text-blue-700 dark:text-blue-300">GET {BACKEND}/api/zapier/triggers/events</code> - Universal events (recommended)</li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">GET https://your-project.supabase.co/functions/v1/zap-events</code> - Supabase Edge Function</li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">GET {BACKEND}/api/zapier/triggers/new-leads</code> - Legacy leads only</li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">GET {BACKEND}/api/zapier/triggers/pipeline-stage-changes</code> - Legacy stages only</li>
        </ul>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 Use <code>?event_type=lead_created</code> to filter events, <code>?since=2024-01-15T10:00:00Z</code> for date filtering
        </div>
      </div>

      {/* Action Endpoints */}
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2 mt-4">
        <div className="font-medium">⚡ Action Endpoints</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">POST {BACKEND}/api/zapier/leads</code> - Create/update leads</li>
          <li><code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">POST {BACKEND}/api/zapier/enrich</code> - Enrich lead data</li>
        </ul>
      </div>

      {/* Testing Section */}
      {apiKey && (
        <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2 mt-4 p-3 bg-blue-50 dark:bg-gray-700 rounded-lg">
          <div className="font-medium">🧪 Test Your Integration</div>
          <div className="text-xs space-y-2">
            <p>Send test events to verify your webhooks are working:</p>
            <div className="flex gap-2">
              <code className="text-xs bg-white dark:bg-gray-600 px-2 py-1 rounded">
                POST {BACKEND}/api/zapier/test-event
              </code>
              <code className="text-xs bg-white dark:bg-gray-600 px-2 py-1 rounded">
                Body: {"{"}"event_type": "lead_created"{"}"}
              </code>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              💡 Use your API key in the X-API-Key header
            </p>
          </div>
        </div>
      )}

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