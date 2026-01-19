import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';

type CampaignData = {
  campaign: {
    id: string;
    title: string;
    audience_tag?: string;
    status: string;
    created_at: string;
    created_by?: string;
    default_sender_id?: string;
  };
  sequence?: {
    id: string;
    steps_json: {
      step1: { subject: string; body: string };
      step2: { subject: string; body: string };
      step3: { subject: string; body: string };
      spacingBusinessDays: number;
    };
    created_at: string;
  };
  leads?: Array<{
    id: string;
    name?: string;
    email?: string;
    title?: string;
    company?: string;
    outreach_stage: string;
    reply_status?: string;
    scheduler_run_id?: string | null;
    created_at: string;
  }>;
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CampaignData | null>(null);
  const [stats, setStats] = useState<{ total_leads: number; emails_sent: number; replies_received: number; positive_replies: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [senderBehavior, setSenderBehavior] = useState<'single'|'rotate'|'specific'>('single');
  const [senderOptions, setSenderOptions] = useState<Array<{ id:string; email:string }>>([]);
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [senderEmails, setSenderEmails] = useState<string[]>([]);
  const [senderSaving, setSenderSaving] = useState<boolean>(false);
  const [senderSyncing, setSenderSyncing] = useState<boolean>(false);
  const [autoOutreachEnabled, setAutoOutreachEnabled] = useState<boolean>(true);
  const [showNewOnly, setShowNewOnly] = useState<boolean>(false);
  // Saved sequences integration
  const [savedSequences, setSavedSequences] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
  const [enrolling, setEnrolling] = useState<boolean>(false);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      setError(null);
      const campaignData = await api(`/api/sourcing/campaigns/${id}`);
      setData(campaignData);
      try {
        const s = await api(`/api/sourcing/campaigns/${id}/stats`);
        setStats(s || null);
      } catch {}
    } catch (err) {
      console.error('Error loading campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  // Load campaign config (sender behavior + auto outreach)
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const cfg = await api(`/api/sourcing/campaign-config/${id}`);
        const behavior = String((cfg as any)?.sender_behavior || 'single') as any;
        if (behavior === 'single' || behavior === 'rotate' || behavior === 'specific') {
          setSenderBehavior(behavior);
        }
        setSenderEmail(String((cfg as any)?.sender_email || ''));
        setSenderEmails(Array.isArray((cfg as any)?.sender_emails) ? (cfg as any).sender_emails : []);
        setAutoOutreachEnabled((cfg as any)?.auto_outreach_enabled !== false);
      } catch {}
    })();
  }, [id]);

  // Realtime: refresh campaign details when status or related fields change
  useEffect(() => {
    if (!id) return;
    let channel: any;
    (async () => {
      try {
        channel = supabase
          .channel(`sourcing-campaign-${id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'sourcing_campaigns',
            filter: `id=eq.${id}`
          }, async () => {
            await loadCampaign();
          });
        await channel.subscribe();
      } catch {}
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        // Fast path: load cached senders (if any), then do a best-effort background sync
        // so the list matches the connected SendGrid account.
        const senders = await api('/api/sourcing/senders');
        const normalized = (senders || []).map((s:any) => ({ id: s.id, email: s.from_email }));
        setSenderOptions(normalized);
      } catch (e) {
        // Keep UI usable even if this fails (button below can retry).
        console.warn('Failed to load cached senders', e);
      }

      // Background refresh: keep sender list in sync with SendGrid without requiring manual action.
      try {
        await api('/api/sourcing/senders/sync', { method: 'POST' });
        const refreshed = await api('/api/sourcing/senders');
        const n2 = (refreshed || []).map((s:any) => ({ id: s.id, email: s.from_email }));
        setSenderOptions(n2);
      } catch {}
    })();
  }, []);

  // Load saved sequences (Message Center templates)
  useEffect(() => {
    (async () => {
      try {
        const seqs = await api('/api/sequences');
        const list = (seqs || []).map((s:any) => ({ id: s.id, name: s.name || 'Untitled sequence' }));
        setSavedSequences(list);
      } catch {}
    })();
  }, []);

  const handleAction = async (action: string) => {
    if (!id) return;
    
    try {
      setActionLoading(action);
      let endpoint = '';
      let method = 'POST';
      
      switch (action) {
        case 'schedule':
          endpoint = `/api/sourcing/campaigns/${id}/schedule`;
          break;
        case 'pause':
          endpoint = `/api/sourcing/campaigns/${id}/pause`;
          break;
        case 'resume':
          endpoint = `/api/sourcing/campaigns/${id}/resume`;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      await api(endpoint, { method });

      // Reload campaign data
      await loadCampaign();
    } catch (err) {
      console.error(`Error ${action}ing campaign:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} campaign`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-600 text-gray-200';
      case 'scheduled': return 'bg-blue-600 text-blue-100';
      case 'running': return 'bg-green-600 text-green-100';
      case 'paused': return 'bg-yellow-600 text-yellow-100';
      case 'completed': return 'bg-purple-600 text-purple-100';
      default: return 'bg-gray-600 text-gray-200';
    }
  };

  const getOutreachStageColor = (stage: string) => {
    switch (stage) {
      case 'queued': return 'text-gray-400';
      case 'step1_sent': return 'text-blue-400';
      case 'step2_sent': return 'text-purple-400';
      case 'step3_sent': return 'text-orange-400';
      case 'replied': return 'text-green-400';
      case 'bounced': return 'text-red-400';
      case 'unsubscribed': return 'text-red-300';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-1/4"></div>
          <div className="h-8 bg-slate-700 rounded w-1/2"></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64 bg-slate-700 rounded"></div>
            <div className="h-64 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen">
        <Link to="/super-admin/sourcing" className="text-blue-400 hover:underline mb-4 inline-block">
          ← Back to Campaigns
        </Link>
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading campaign</p>
          <p className="text-sm mt-1">{error || 'Campaign not found'}</p>
        </div>
      </div>
    );
  }

  const { campaign, sequence, leads } = data;

  const allLeads = Array.isArray(leads) ? leads : [];
  const latestSchedulerRunId =
    allLeads.find((l: any) => l?.scheduler_run_id)?.scheduler_run_id || null;
  const isLeadNew = (lead: any) => {
    if (latestSchedulerRunId) return String(lead?.scheduler_run_id || '') === String(latestSchedulerRunId);
    const ts = lead?.created_at ? new Date(lead.created_at).getTime() : NaN;
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) <= (24 * 60 * 60 * 1000);
  };
  const newLeadCount = allLeads.filter(isLeadNew).length;
  const displayedLeads = showNewOnly ? allLeads.filter(isLeadNew) : allLeads;

  return (
    <div className="p-6 bg-gray-900 min-h-screen space-y-6">
      {/* Breadcrumb */}
      <Link to="/super-admin/sourcing" className="text-blue-400 hover:underline inline-flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Campaigns
      </Link>

      {/* Campaign Header */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl text-white font-bold mb-2">{campaign.title}</h1>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(campaign.status)}`}>
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
              {campaign.audience_tag && (
                <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm">
                  {campaign.audience_tag}
                </span>
              )}
              <span className="text-gray-400 text-sm">
                Created {new Date(campaign.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {campaign.status === 'draft' && sequence && leads && leads.length > 0 && (
            <button
              onClick={() => handleAction('schedule')}
              disabled={actionLoading === 'schedule'}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'schedule' ? 'Scheduling...' : '🚀 Schedule Sends'}
            </button>
          )}
          
          {campaign.status === 'running' && (
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading === 'pause'}
              className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'pause' ? 'Pausing...' : '⏸️ Pause Campaign'}
            </button>
          )}
          
          {campaign.status === 'paused' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading === 'resume'}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'resume' ? 'Resuming...' : '▶️ Resume Campaign'}
            </button>
          )}

          {/* Relaunch (schedule/resume) */}
          <button
            onClick={async()=>{
              if(!id) return;
              // Guard: require sender + a sequence (generated or attached)
              const hasSender = (senderBehavior==='rotate') || (senderBehavior==='specific' ? senderEmails.length>0 : !!senderEmail);
              const hasSequence = !!sequence || !!selectedSequenceId;
              if (!hasSender || !hasSequence){
                alert('Please select a sender and attach or generate an email sequence before relaunching.');
                return;
              }
              setActionLoading('relaunch');
              try{
                // If a saved sequence is selected, enroll current leads now
                if (selectedSequenceId && data?.leads?.length){
                  const leadIds = data.leads.map(l=>l.id);
                  await api(`/api/sequences/${selectedSequenceId}/enroll`, { method:'POST', body: JSON.stringify({ leadIds }) });
                }
                // Schedule or resume
                if (data?.campaign?.status === 'paused') {
                  await api(`/api/sourcing/campaigns/${id}/resume`, { method:'POST' });
                } else {
                  await api(`/api/sourcing/campaigns/${id}/schedule`, { method:'POST' });
                }
                await loadCampaign();
              }catch(err){ setError(err instanceof Error ? err.message : 'Failed to relaunch'); }
              setActionLoading(null);
            }}
            disabled={actionLoading==='relaunch'}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading==='relaunch' ? 'Relaunching…' : '🔄 Relaunch'}
          </button>

          {/* Delete */}
          <button
            onClick={async()=>{
              if(!id) return;
              if(!confirm('Delete this campaign? This cannot be undone.')) return;
              setActionLoading('delete');
              try{
                await api(`/api/sourcing/campaigns/${id}`, { method:'DELETE' });
                navigate('/super-admin/sourcing');
              }catch(err){ setError(err instanceof Error ? err.message : 'Failed to delete'); }
              setActionLoading(null);
            }}
            disabled={actionLoading==='delete'}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading==='delete' ? 'Deleting…' : '🗑️ Delete'}
          </button>

          <Link
            to={`/super-admin/sourcing/campaigns/${id}/replies`}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
          >
            💬 View Replies
          </Link>

          <Link
            to="/rex-chat"
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
          >
            🤖 Chat with REX
          </Link>
        </div>
        {/* Sender Behavior Controls */}
        <div className="mt-6 p-4 border border-slate-700 rounded-lg bg-slate-900/50">
          <div className="text-gray-200 font-medium mb-2">Sender Behavior</div>
          <div className="flex items-center gap-6 text-gray-300 mb-3">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="senderBehavior" checked={senderBehavior==='single'} onChange={()=>setSenderBehavior('single')} />
              <span>Send from a single sender</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="senderBehavior" checked={senderBehavior==='rotate'} onChange={()=>setSenderBehavior('rotate')} />
              <span>Rotate between available senders</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="senderBehavior" checked={senderBehavior==='specific'} onChange={()=>setSenderBehavior('specific')} />
              <span>Rotate between specific senders…</span>
            </label>
            <button
              onClick={async()=>{
                setSenderSyncing(true);
                try {
                  await api('/api/sourcing/senders/sync', { method: 'POST' });
                  const refreshed = await api('/api/sourcing/senders');
                  const n2 = (refreshed || []).map((s:any) => ({ id: s.id, email: s.from_email }));
                  setSenderOptions(n2);
                  toast.success('SendGrid senders synced');
                } catch (e: any) {
                  const msg = e?.message || 'Failed to sync SendGrid senders';
                  setError(msg);
                  toast.error(msg);
                }
                setSenderSyncing(false);
              }}
              className="ml-auto px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
              disabled={senderSyncing}
            >
              {senderSyncing ? 'Syncing…' : 'Sync SendGrid senders'}
            </button>
          </div>
          {senderBehavior === 'single' && (
            <div className="flex items-center gap-3">
              <select value={senderEmail} onChange={e=>setSenderEmail(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-gray-100">
                <option value="">Select sender…</option>
                {senderOptions.map(s => (
                  <option key={s.id} value={s.email}>{s.email}</option>
                ))}
              </select>
              <button
                onClick={async()=>{
                  setSenderSaving(true);
                  try {
                    await api(`/api/sourcing/campaign-config/${id}/sender`, { method: 'POST', body: JSON.stringify({ senderBehavior, senderEmail }) });
                  } catch {}
                  setSenderSaving(false);
                }}
                disabled={senderSaving || (senderBehavior==='single' && !senderEmail)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
              >
                {senderSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
          {senderBehavior === 'specific' && (
            <div className="flex items-center gap-3 flex-wrap">
              <select multiple value={senderEmails} onChange={e=>{
                const opts = Array.from(e.target.selectedOptions).map(o=>o.value);
                setSenderEmails(opts);
              }} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-gray-100 min-w-[260px] h-28">
                {senderOptions.map(s => (
                  <option key={s.id} value={s.email}>{s.email}</option>
                ))}
              </select>
              <button
                onClick={async()=>{
                  setSenderSaving(true);
                  try {
                    await api(`/api/sourcing/campaign-config/${id}/sender`, { method: 'POST', body: JSON.stringify({ senderBehavior, senderEmails }) });
                  } catch {}
                  setSenderSaving(false);
                }}
                disabled={senderSaving || senderEmails.length === 0}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
              >
                {senderSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
          {senderBehavior === 'rotate' && (
            <div>
              <button
                onClick={async()=>{
                  setSenderSaving(true);
                  try {
                    await api(`/api/sourcing/campaign-config/${id}/sender`, { method: 'POST', body: JSON.stringify({ senderBehavior }) });
                  } catch {}
                  setSenderSaving(false);
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                {senderSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Sequence */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">Email Sequence</h2>
            {sequence && (
              <span className="text-sm text-gray-400">
                {sequence.steps_json.spacingBusinessDays} business days apart
              </span>
            )}
          </div>
          
          {sequence ? (
            <div className="space-y-4">
              {['step1', 'step2', 'step3'].map((stepKey, index) => {
                const step = sequence.steps_json[stepKey as keyof typeof sequence.steps_json];
                if (typeof step === 'object' && step.subject && step.body) {
                  return (
                    <div key={stepKey} className="border border-slate-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">Step {index + 1}</h3>
                        <span className="text-xs text-gray-400">
                          {index === 0 ? 'Immediate' : `Day ${index * sequence.steps_json.spacingBusinessDays}`}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        <strong>Subject:</strong> {step.subject}
                      </div>
                      <div className="text-sm text-gray-300 bg-slate-900 rounded p-3 whitespace-pre-wrap">
                        {step.body}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 text-4xl mb-2">📝</div>
              <p className="text-gray-400">No sequence generated yet</p>
              <Link
                to="/rex-chat"
                className="mt-3 inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Generate with REX
              </Link>
              <div className="mt-6 text-left max-w-md mx-auto">
                <div className="text-gray-300 mb-2">Or attach a saved sequence</div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedSequenceId}
                    onChange={e=>setSelectedSequenceId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-gray-100"
                  >
                    <option value="">Select a saved sequence…</option>
                    {savedSequences.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={async()=>{
                      if (!id || !selectedSequenceId) return;
                      if (!data?.leads || !data.leads.length) return;
                      setEnrolling(true);
                      try{
                        const leadIds = data.leads.map(l=>l.id);
                        await api(`/api/sequences/${selectedSequenceId}/enroll`, { method:'POST', body: JSON.stringify({ leadIds }) });
                        // Mark campaign as running so it appears active in Agent Mode
                        try { await api(`/api/sourcing/campaigns/${id}/resume`, { method: 'POST' }); } catch {}
                        await loadCampaign();
                        alert('Sequence attached and scheduled for current leads.');
                      }catch(err){ console.error(err); alert('Failed to attach sequence'); }
                      setEnrolling(false);
                    }}
                    disabled={enrolling || !selectedSequenceId || !(data?.leads||[]).length}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white disabled:opacity-50"
                  >
                    {enrolling ? 'Attaching…' : 'Attach & Schedule'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leads */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">
              Leads ({displayedLeads.length}{showNewOnly ? ` of ${allLeads.length}` : ''})
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNewOnly(v => !v)}
                className={`text-sm px-3 py-1 rounded font-medium transition-colors border ${
                  showNewOnly
                    ? 'bg-emerald-600/20 text-emerald-200 border-emerald-600/40'
                    : 'bg-gray-700 text-white border-slate-600 hover:bg-gray-600'
                }`}
                title={latestSchedulerRunId ? 'Filter to leads from the latest scheduler run' : 'Filter to leads added in the last 24 hours'}
                disabled={newLeadCount === 0}
              >
                New ({newLeadCount})
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-300 select-none">
                <span className="text-xs text-gray-400">Auto outreach</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!id) return;
                    const next = !autoOutreachEnabled;
                    setAutoOutreachEnabled(next);
                    try {
                      await api(`/api/sourcing/campaign-config/${id}/auto-outreach`, {
                        method: 'POST',
                        body: JSON.stringify({ enabled: next })
                      });
                      toast.success(next ? 'Auto outreach enabled' : 'Auto outreach disabled');
                    } catch (e: any) {
                      setAutoOutreachEnabled(!next);
                      toast.error(e?.message || 'Failed to update auto outreach');
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoOutreachEnabled ? 'bg-emerald-600' : 'bg-slate-600'
                  }`}
                  aria-pressed={autoOutreachEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoOutreachEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              <Link
                to="/rex-chat"
                className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded font-medium transition-colors"
              >
                + Add More
              </Link>
            </div>
          </div>
          
          {displayedLeads && displayedLeads.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayedLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between border-b border-slate-700/50 py-3">
                  <div className="flex-1">
                    <div className="text-white font-medium flex items-center gap-2">
                      <span>{lead.name || lead.email || 'Unknown'}</span>
                      {isLeadNew(lead) && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                          New
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {lead.title && `${lead.title} • `}
                      {lead.company && `${lead.company} • `}
                      {lead.email}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getOutreachStageColor(lead.outreach_stage)}`}>
                      {lead.outreach_stage.replace('_', ' ')}
                    </div>
                    {lead.reply_status && lead.reply_status !== 'none' && (
                      <div className="text-xs text-gray-500 mt-1">
                        Reply: {lead.reply_status}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 text-4xl mb-2">👥</div>
              <p className="text-gray-400 mb-3">No leads added yet</p>
              <Link
                to="/rex-chat"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Add Leads with REX
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Campaign Stats */}
      {leads && leads.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
          <h2 className="text-white font-semibold text-lg mb-4">Campaign Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{stats?.total_leads ?? leads.length}</div>
              <div className="text-sm text-gray-400">Total Leads</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{stats?.emails_sent ?? 0}</div>
              <div className="text-sm text-gray-400">Emails Sent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{stats?.replies_received ?? 0}</div>
              <div className="text-sm text-gray-400">Replied</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{stats?.positive_replies ?? 0}</div>
              <div className="text-sm text-gray-400">Positive</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">
                {leads.filter(l => ['bounced', 'unsubscribed'].includes(l.outreach_stage)).length}
              </div>
              <div className="text-sm text-gray-400">Bounced/Unsub</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
