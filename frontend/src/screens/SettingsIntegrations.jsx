import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import ApolloApiKeyModal from '../components/ApolloApiKeyModal';

export default function SettingsIntegrations() {
  const [loading, setLoading] = useState(true);
  const [agentModeEnabled, setAgentModeEnabled] = useState(false);

  // Integration statuses
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [sendgridConnected, setSendgridConnected] = useState(false);
  const [apolloConnected, setApolloConnected] = useState(false);

  // Category accordion states
  const [open, setOpen] = useState({ messaging: true, sourcing: false, automation: false, collaboration: false });

  // SendGrid modal state (reuse simple flow from previous implementation)
  const [showSendGridModal, setShowSendGridModal] = useState(false);
  const [sendGridApiKey, setSendGridApiKey] = useState('');
  const [sendGridLoading, setSendGridLoading] = useState(false);
  const [allowedSenders, setAllowedSenders] = useState([]);
  const [selectedSender, setSelectedSender] = useState('');
  const [validationError, setValidationError] = useState('');
  const [sendGridStep, setSendGridStep] = useState('validate'); // 'validate' | 'chooseSender'

  // Apollo modal
  const [showApolloModal, setShowApolloModal] = useState(false);

  // Active connection count for header
  const activeConnections = useMemo(() => {
    return [googleConnected, outlookConnected, sendgridConnected, apolloConnected, agentModeEnabled]
      .filter(Boolean).length;
  }, [googleConnected, outlookConnected, sendgridConnected, apolloConnected, agentModeEnabled]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Google status from table if present
        const { data: googleData } = await supabase
          .from('google_accounts')
          .select('status')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        setGoogleConnected(googleData?.[0]?.status === 'connected');

        // Other integrations table
        const { data: rows } = await supabase
          .from('integrations')
          .select('provider,status')
          .eq('user_id', user.id);
        setOutlookConnected(!!rows?.find(r => r.provider === 'outlook' && r.status === 'connected'));
        setSendgridConnected(!!rows?.find(r => r.provider === 'sendgrid' && r.status === 'connected'));
        setApolloConnected(!!rows?.find(r => r.provider === 'apollo' && r.status === 'connected'));

        // Agent mode
        try {
          const data = await api('/api/agent-mode');
          setAgentModeEnabled(!!data.agent_mode_enabled);
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------- Handlers ----------
  const connectGoogle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/google/init?user_id=${user.id}`);
      const js = await resp.json();
      if (resp.ok && js.url) window.location.href = js.url; else toast.error(js.error || 'Failed to start Google OAuth');
    } catch { toast.error('Failed to start Google OAuth'); }
  };
  const disconnectGoogle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/google/disconnect`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id })
      });
      if (resp.ok) { setGoogleConnected(false); toast.success('Google disconnected'); } else toast.error('Failed to disconnect Google');
    } catch { toast.error('Failed to disconnect Google'); }
  };

  const connectOutlook = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const clientId = import.meta.env.VITE_OUTLOOK_CLIENT_ID || '1b3df991-884a-4d19-9cd4-9901baddcb97';
    const redirectUri = `${import.meta.env.VITE_BACKEND_URL}/api/auth/outlook/callback`;
    const scope = encodeURIComponent('openid profile email offline_access Mail.Send');
    const state = user.id;
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    window.location.href = url;
  };

  // SendGrid modal handlers
  const validateSendGridKey = async () => {
    try {
      setSendGridLoading(true); setValidationError('');
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendgrid/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: sendGridApiKey })
      });
      const js = await resp.json();
      if (!resp.ok) { setValidationError(js.error || 'Failed to validate'); return; }
      const normalized = (js.senders || []).map(s => ({
        id: s.id, email: s.email || s.from_email || '', name: s.name || s.from_name || s.nickname || ''
      }));
      setAllowedSenders(normalized);
      if (normalized.length > 0) { setSelectedSender(normalized[0].email); setSendGridStep('chooseSender'); }
      else setValidationError('No verified senders found.');
    } finally { setSendGridLoading(false); }
  };
  const saveSendGridSender = async () => {
    try {
      setSendGridLoading(true); setValidationError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendgrid/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, api_key: sendGridApiKey, default_sender: selectedSender })
      });
      if (resp.ok) { setSendgridConnected(true); setShowSendGridModal(false); setSendGridApiKey(''); setAllowedSenders([]); setSelectedSender(''); setSendGridStep('validate'); toast.success('SendGrid connected'); }
      else { const js = await resp.json(); setValidationError(js.error || 'Failed to save'); }
    } finally { setSendGridLoading(false); }
  };

  // Apollo modal success
  const onApolloSuccess = () => { setApolloConnected(true); setShowApolloModal(false); toast.success('Apollo key saved'); };

  // Agent mode toggle
  const setAgentMode = async (enabled) => {
    setAgentModeEnabled(enabled);
    try { await api('/api/agent-mode', { method: 'POST', body: JSON.stringify({ enabled }) }); }
    catch { setAgentModeEnabled(!enabled); toast.error('Failed to update Agent Mode'); }
  };

  const Card = ({ iconClass, iconSrc, name, status, onConnect, onDisconnect, connectLabel = 'Connect', disableActions = false }) => (
    <div className="p-4 bg-white rounded-xl shadow-sm flex justify-between items-center border hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent">
          {iconSrc ? (
            <img src={iconSrc} alt={name} className="w-8 h-8 object-contain" />
          ) : (
            <i className={iconClass}></i>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className={`text-xs ${status === 'Connected' ? 'text-green-600' : status === 'Pending' ? 'text-yellow-600' : 'text-gray-500'}`}>{status}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === 'Connected' ? (
          <button disabled={disableActions} onClick={onDisconnect} className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">Disconnect</button>
        ) : (
          <button disabled={disableActions} onClick={onConnect} className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">{connectLabel}</button>
        )}
      </div>
    </div>
  );

  if (loading) return <div className="p-6">Loading integrations...</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 p-6 rounded-2xl flex justify-between items-center border border-indigo-100 mb-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Integrations Hub</h1>
            <p className="text-gray-600">Manage all your connected apps and automation keys</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-full">
              <i className="fa-solid fa-plug mr-2"></i>
              {activeConnections} Active Connections
            </span>
          </div>
        </div>

        <div className="mb-8">
          <div className="relative max-w-md">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input type="text" placeholder="Find Integration..." className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>
        </div>

        {/* Messaging & Email */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50" onClick={()=>setOpen(s=>({...s, messaging:!s.messaging}))}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-envelope text-blue-600"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Messaging & Email</h3>
                <p className="text-sm text-gray-500">3 integrations</p>
              </div>
            </div>
            <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${open.messaging ? 'rotate-180' : ''}`}></i>
          </div>
          {open.messaging && (
            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  iconClass="fa-brands fa-google text-red-600"
                  name="Gmail"
                  status={googleConnected ? 'Connected' : 'Not Connected'}
                  onConnect={connectGoogle}
                  onDisconnect={disconnectGoogle}
                />
                <Card
                  iconClass="fa-brands fa-microsoft text-blue-600"
                  name="Outlook"
                  status={outlookConnected ? 'Connected' : 'Not Connected'}
                  onConnect={connectOutlook}
                  onDisconnect={()=>toast('Use Outlook account settings to disconnect')}
                />
                <Card
                  iconSrc="/sendgrid.png"
                  name="SendGrid"
                  status={sendgridConnected ? 'Connected' : 'Not Connected'}
                  onConnect={()=>setShowSendGridModal(true)}
                  onDisconnect={()=>toast('Disconnect handled in settings (coming soon)')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sourcing & Enrichment */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50" onClick={()=>setOpen(s=>({...s, sourcing:!s.sourcing}))}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-search text-purple-600"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Sourcing & Enrichment</h3>
                <p className="text-sm text-gray-500">3 integrations</p>
              </div>
            </div>
            <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${open.sourcing ? 'rotate-180' : ''}`}></i>
          </div>
          {open.sourcing && (
            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  iconSrc="/apollo-logo-v2.png"
                  name="Apollo"
                  status={apolloConnected ? 'Connected' : 'Not Connected'}
                  onConnect={()=>setShowApolloModal(true)}
                  onDisconnect={()=>setShowApolloModal(true)}
                  connectLabel={apolloConnected ? 'Manage' : 'Connect'}
                />
                <Card iconSrc="/hunter.png" name="Hunter.io" status={'Pending'} disableActions onConnect={()=>{}} />
                <Card iconSrc="/skrapp.png" name="Skrapp" status={'Pending'} disableActions onConnect={()=>{}} />
              </div>
            </div>
          )}
        </div>

        {/* Automations (hold off) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50" onClick={()=>setOpen(s=>({...s, automation:!s.automation}))}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-bolt text-amber-600"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Automations</h3>
                <p className="text-sm text-gray-500">2 integrations</p>
              </div>
            </div>
            <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${open.automation ? 'rotate-180' : ''}`}></i>
          </div>
          {open.automation && (
            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card iconSrc="/zapier-icon.png" name="Zapier" status={'Pending'} disableActions onConnect={()=>{}} />
                <Card iconSrc="/make-logo-v1.png" name="Make" status={'Pending'} disableActions onConnect={()=>{}} />
              </div>
            </div>
          )}
        </div>

        {/* Collaboration */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-6 cursor-pointer hover:bg-gray-50" onClick={()=>setOpen(s=>({...s, collaboration:!s.collaboration}))}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-users text-pink-600"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Collaboration</h3>
                <p className="text-sm text-gray-500">2 integrations</p>
              </div>
            </div>
            <i className={`fa-solid fa-chevron-down text-gray-400 transition-transform duration-300 ${open.collaboration ? 'rotate-180' : ''}`}></i>
          </div>
          {open.collaboration && (
            <div className="border-t border-gray-100 bg-gray-50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card iconClass="fa-brands fa-slack text-purple-600" name="Slack" status={'Pending'} disableActions onConnect={()=>{}} />
                <Card
                  iconClass="fa-solid fa-terminal text-blue-600"
                  name="Agent Mode"
                  status={agentModeEnabled ? 'Connected' : 'Not Connected'}
                  onConnect={()=>setAgentMode(true)}
                  onDisconnect={()=>setAgentMode(false)}
                  connectLabel={agentModeEnabled ? 'Enabled' : 'Enable'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Admin Enrichment Keys panel (visual only for now) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-2xl text-white shadow-lg mt-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Admin Enrichment Keys</h3>
              <p className="text-indigo-200">Configure API keys for data enrichment services</p>
            </div>
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-200 text-sm font-medium rounded-full border border-indigo-400/30">
              <i className="fa-solid fa-shield-alt mr-1"></i>
              Admin Only
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Hunter.io API Key</label>
              <input type="password" placeholder="••••••••••••••••••••" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Skrapp.io API Key</label>
              <input type="password" placeholder="••••••••••••••••••••" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Apollo API Key</label>
              <input type="password" placeholder="••••••••••••••••••••" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-200 mb-2">Enrichment Priority Order</label>
              <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none">
                <option value="hunter-first" className="text-gray-900">Hunter.io → Apollo → Skrapp</option>
                <option value="apollo-first" className="text-gray-900">Apollo → Hunter.io → Skrapp</option>
                <option value="skrapp-first" className="text-gray-900">Skrapp → Hunter.io → Apollo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg transition-colors">
              <i className="fa-solid fa-save mr-2"></i>
              Save Configuration
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-sm">
            <i className="fa-solid fa-plus mr-2"></i>
            Add New Integration
          </button>
        </div>
      </div>

      {/* SendGrid Modal */}
      {showSendGridModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Connect SendGrid</h3>
            {sendGridStep === 'validate' && (
              <>
                <input type="password" className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" placeholder="SendGrid API Key" value={sendGridApiKey} onChange={e=>setSendGridApiKey(e.target.value)} />
                {validationError && <p className="text-red-500 text-sm mb-4">{validationError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={()=>setShowSendGridModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={sendGridLoading}>Cancel</button>
                  <button onClick={validateSendGridKey} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50" disabled={sendGridLoading || !sendGridApiKey}>{sendGridLoading ? 'Validating...' : 'Validate Key'}</button>
                </div>
              </>
            )}
            {sendGridStep === 'chooseSender' && (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Sender</label>
                <select className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" value={selectedSender} onChange={e=>setSelectedSender(e.target.value)}>
                  {allowedSenders.map(s=> <option key={s.email} value={s.email}>{s.email}</option>)}
                </select>
                {validationError && <p className="text-red-500 text-sm mb-4">{validationError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={()=>setShowSendGridModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={sendGridLoading}>Cancel</button>
                  <button onClick={saveSendGridSender} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50" disabled={sendGridLoading || !selectedSender}>{sendGridLoading ? 'Saving...' : 'Save Sender'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Apollo Modal */}
      <ApolloApiKeyModal isOpen={showApolloModal} onClose={()=>setShowApolloModal(false)} onSuccess={onApolloSuccess} currentApiKey={''} />
    </div>
  );
}
