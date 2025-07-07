import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { FaCheckCircle } from 'react-icons/fa';

const BACKEND = import.meta.env.VITE_BACKEND_URL;

export default function ZapierWizardModal({ isOpen, onClose, apiKey, onApiKeyGenerated, onWebhookSaved }) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvent, setHookEvent] = useState('lead.created');
  const [hookSecret, setHookSecret] = useState('');
  const close = () => { setStep(1); setHookUrl(''); setHookSecret(''); onClose(); };

  const generateKey = async () => {
    setGenerating(true);
    await onApiKeyGenerated();
    setGenerating(false);
    setStep(2);
  };

  const saveWebhook = async () => {
    if (!hookUrl) return;
    setSavingWebhook(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${BACKEND}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: hookUrl, event: hookEvent })
      });
      if (!res.ok) throw new Error('Failed to save webhook');
      const data = await res.json();
      setHookSecret(data.webhook.secret);
      onWebhookSaved?.();
      setStep(3);
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <button className="absolute top-3 right-3 text-gray-500" onClick={close}>×</button>
        <h2 className="text-xl font-semibold mb-4">Zapier / Make Setup</h2>
        {step === 1 && (
          <div>
            <p className="mb-4">Step 1: Generate your API key.</p>
            {apiKey ? (
              <div className="flex items-center gap-2 text-green-600 mb-4"><FaCheckCircle/> Key already generated.</div>
            ) : null}
            <button onClick={generateKey} disabled={generating} className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {generating ? 'Generating…' : apiKey ? 'Regenerate Key' : 'Generate Key'}
            </button>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="mb-2">Step 2: Paste the Zapier/Make Catch-Hook URL where you want HirePilot to send events.</p>
            <input value={hookUrl} onChange={e=>setHookUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." className="w-full border rounded p-2 mb-4"/>
            <label className="block mb-2 text-sm">Event</label>
            <select value={hookEvent} onChange={e=>setHookEvent(e.target.value)} className="w-full border rounded p-2 mb-4">
              <option value="lead.created">lead.created</option>
              <option value="lead.updated">lead.updated</option>
              <option value="lead.stage_changed">lead.stage_changed</option>
            </select>
            <button onClick={saveWebhook} disabled={savingWebhook||!hookUrl} className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {savingWebhook ? 'Saving…' : 'Save Webhook'}
            </button>
          </div>
        )}
        {step === 3 && (
          <div>
            <p className="mb-4 text-green-700 flex items-center gap-2"><FaCheckCircle/> Webhook saved!</p>
            <p className="mb-4 text-sm">Use this secret to verify signatures (optional):</p>
            <pre className="bg-gray-100 p-2 rounded text-xs break-all">{hookSecret}</pre>
            <button onClick={()=>setStep(4)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">Next</button>
          </div>
        )}
        {step === 4 && (
          <div>
            <p className="mb-4">All set! Your Zap can now receive events and use the API key to create/enrich leads.</p>
            <button onClick={close} className="px-4 py-2 bg-green-600 text-white rounded-md">Done</button>
          </div>
        )}
      </div>
    </div>
  );
} 