import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

const DEFAULTS = {
  mode: 'handle',
  reply_style: { tone:'friendly-direct', length:'short', format:'bullet_then_cta', objection_posture:'clarify_then_value' },
  contact_capture: { ask_phone:false, ask_team_size:true, ask_timeline:true, only_if_missing:true },
  scheduling: { provider:'calendly', event_type:'hirepilot/15min-intro', time_window_days:10, work_hours:'9-5', timezone:'America/Chicago' },
  sender: { behavior:'single', email:'' },
  offers: [],
  assets: { demo_video_url:'', pricing_url:'', deck_url:'', one_pager_url:'' },
  limits: { per_thread_daily:1, quiet_hours_local:'20:00-07:00', max_followups:4 }
};

function computeNeeds(policy:any){
  const needs:string[] = [];
  if (policy?.sender?.behavior === 'single' && !policy?.sender?.email) needs.push('sender_email');
  if (!policy?.assets?.demo_video_url) needs.push('demo_video_url');
  if (!policy?.assets?.pricing_url) needs.push('pricing_url');
  return needs;
}

function MissingBanner({ needs }:{ needs: string[] }){
  if (!needs?.length) return null as any;
  const map: Record<string,string> = {
    sender_email: 'Sender email (Send from)',
    demo_video_url: 'Demo video URL',
    pricing_url: 'Pricing page URL'
  };
  return (
    <div className="mb-4 rounded-lg border border-yellow-500 bg-yellow-50 text-yellow-800 p-3">
      <div className="font-semibold mb-1">Complete your Sales Agent setup</div>
      <ul className="list-disc ml-5">
        {needs.map(k => <li key={k}>{map[k] ?? k}</li>)}
      </ul>
      <div className="text-xs mt-2">Auto-send requires a configured sender. Links are optional but recommended.</div>
    </div>
  );
}

export default function SalesAgentSettingsCard(){
  const [policy, setPolicy] = useState<any|null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [editingPreview, setEditingPreview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testTo, setTestTo] = useState('');
  // Strategy modal state
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyTone, setStrategyTone] = useState<string>('professional');
  const [strategyPriority, setStrategyPriority] = useState<string>('book');
  const [strategyInstructions, setStrategyInstructions] = useState<string>('');
  const [showExamples, setShowExamples] = useState<boolean>(false);

  useEffect(() => { (async()=>{
    try {
      const p = await apiGet('/api/sales/policy');
      const merged = { ...DEFAULTS, ...(p || {}) };
      merged.sender = { ...DEFAULTS.sender, ...(merged.sender || {}) };
      merged.assets = { ...DEFAULTS.assets, ...(merged.assets || {}) };
      merged.reply_style = { ...DEFAULTS.reply_style, ...(merged.reply_style || {}) };
      merged.scheduling = { ...DEFAULTS.scheduling, ...(merged.scheduling || {}) };
      merged.limits = { ...DEFAULTS.limits, ...(merged.limits || {}) };
      setPolicy(merged);
      setNeeds(computeNeeds(merged));
      // Initialize strategy defaults from policy if present
      try {
        const rs = (merged as any).reply_strategy || {};
        setStrategyTone(merged.reply_style?.tone || 'professional');
        setStrategyPriority(rs.priority || 'book');
        setStrategyInstructions(rs.instructions || '');
      } catch {}
    } catch {
      setPolicy(DEFAULTS);
      setNeeds(computeNeeds(DEFAULTS));
    }
  })(); }, []);

  const onSave = async () => {
    if (!policy) return;
    setSaving(true);
    try {
      const res = await apiPost('/api/sales/policy', policy);
      setNeeds(res?.needs || computeNeeds(policy));
    } finally { setSaving(false); }
  };

  const previewBody = useMemo(() => {
    if (!policy) return '';
    const lines:string[] = [];
    lines.push('Hey {{firstName}} — appreciate the reply!');
    if (policy.assets?.demo_video_url) lines.push(`Here’s a quick demo: ${policy.assets.demo_video_url}`);
    if (policy.assets?.pricing_url) lines.push(`Pricing details: ${policy.assets.pricing_url}`);
    const ev = policy.scheduling?.event_type ? `${policy.scheduling.event_type}` : '';
    lines.push(ev ? `Grab a time here: https://calendly.com/${ev}` : 'If helpful, I can share a quick link to book a time.');
    lines.push('— {{yourName}}');
    return lines.join('\n\n');
  }, [policy]);

  // Initialize preview text when policy changes
  useEffect(() => {
    if (!editingPreview) setPreviewText(previewBody);
  }, [previewBody, editingPreview]);

  async function refreshWithRex(instructions?: string){
    try {
      setRefreshing(true);
      const res = await apiPost('/api/rex/tools', {
        tool: 'sales_preview_reply',
        args: {
          policy,
          previous_text: previewText || previewBody,
          instructions: instructions || 'new variation'
        }
      });
      const next = res?.text || '';
      if (next && typeof next === 'string') setPreviewText(next);
    } finally {
      setRefreshing(false);
    }
  }

  if (!policy) return <div className="text-sm text-gray-300">Loading settings…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white">Sales Agent Settings</div>
          <div className="text-xs text-gray-400">Control replies, links, scheduling, and limits.</div>
        </div>
        <button className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm text-white" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <MissingBanner needs={needs} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-200 mb-1">Mode</div>
            <div className="flex items-center gap-4 text-sm text-gray-200">
              <label className="flex items-center gap-2"><input type="radio" checked={policy.mode==='handle'} onChange={()=> setPolicy({ ...policy, mode:'handle' })} /> Handle (auto-send)</label>
              <label className="flex items-center gap-2"><input type="radio" checked={policy.mode==='share'} onChange={()=> setPolicy({ ...policy, mode:'share' })} /> Share & ask</label>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200 mb-1">Send from</div>
            <div className="flex items-center gap-4 text-sm text-gray-200">
              <label className="flex items-center gap-2"><input type="radio" checked={policy.sender?.behavior==='single'} onChange={()=> setPolicy({ ...policy, sender:{ ...policy.sender, behavior:'single' }})} /> Single sender</label>
              <label className="flex items-center gap-2"><input type="radio" checked={policy.sender?.behavior==='rotate'} onChange={()=> setPolicy({ ...policy, sender:{ ...policy.sender, behavior:'rotate' }})} /> Rotate</label>
            </div>
            {policy.sender?.behavior==='single' && (
              <div className="mt-2">
                <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="you@yourdomain.com" value={policy.sender?.email || ''} onChange={(e)=> setPolicy({ ...policy, sender:{ ...policy.sender, email: e.target.value }})} />
                {!policy.sender?.email && <div className="text-xs text-red-400 mt-1">Sender email required for auto-send.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-200 mb-1">Calendly event type</div>
            <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="your-org/15min-intro" value={policy.scheduling?.event_type || ''} onChange={(e)=> setPolicy({ ...policy, scheduling:{ ...policy.scheduling, event_type: e.target.value }})} />
            <div className="text-xs text-gray-400 mt-1">Displayed as https://calendly.com/<b>{policy.scheduling?.event_type || '…'}</b></div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200 mb-1">Assets</div>
            <div className="space-y-2">
              <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="Demo video URL" value={policy.assets?.demo_video_url || ''} onChange={(e)=> setPolicy({ ...policy, assets:{ ...policy.assets, demo_video_url: e.target.value }})} />
              <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="Pricing page URL" value={policy.assets?.pricing_url || ''} onChange={(e)=> setPolicy({ ...policy, assets:{ ...policy.assets, pricing_url: e.target.value }})} />
              <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="One-pager URL (PDF)" value={policy.assets?.one_pager_url || ''} onChange={(e)=> setPolicy({ ...policy, assets:{ ...policy.assets, one_pager_url: e.target.value }})} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-200 mb-1">Limits</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="number" min={1} max={3} className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="Max sends per thread/day" value={policy.limits?.per_thread_daily ?? 1} onChange={(e)=> setPolicy({ ...policy, limits:{ ...policy.limits, per_thread_daily: Number(e.target.value) }})} />
          <input className="w-full rounded border border-slate-600 bg-slate-900 p-2 text-sm text-white" placeholder="Quiet hours (e.g., 20:00-07:00)" value={policy.limits?.quiet_hours_local || '20:00-07:00'} onChange={(e)=> setPolicy({ ...policy, limits:{ ...policy.limits, quiet_hours_local: e.target.value }})} />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-200 mb-1">Live preview</div>
        {!editingPreview ? (
          <pre className="rounded border border-slate-700 bg-slate-900 p-3 text-sm text-gray-200 whitespace-pre-wrap">{previewText || previewBody}</pre>
        ) : (
          <textarea
            className="w-full rounded border border-slate-700 bg-slate-950 p-3 text-sm text-white min-h-[180px]"
            value={previewText}
            onChange={(e)=> setPreviewText(e.target.value)}
          />
        )}
        <div className="mt-2 flex items-center gap-2">
          <button
            className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-white"
            onClick={()=> refreshWithRex()}
            disabled={refreshing}
            title="Ask REX to generate a fresh variation"
          >
            {refreshing ? 'Refreshing…' : 'Refresh preview (REX)'}
          </button>
          {!editingPreview ? (
            <button
              className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-white"
              onClick={()=> setEditingPreview(true)}
              title="Edit this draft directly"
            >
              Edit
            </button>
          ) : (
            <button
              className="rounded bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs text-white"
              onClick={()=> setEditingPreview(false)}
              title="Save your edited draft"
            >
              Save draft
            </button>
          )}
          <button
            className="rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs text-white"
            onClick={async ()=>{
              try {
                const msg = [
                  'Help me tune my Sales Agent reply parameters. Consider tone, length, format, and CTAs.',
                  'Current policy JSON:',
                  '```json',
                  JSON.stringify(policy || {}, null, 2),
                  '```',
                  'Current preview text:',
                  '```',
                  (previewText || previewBody || ''),
                  '```'
                ].join('\n');
                await fetch('/api/rex/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: undefined, messages: [{ role: 'user', content: msg }] })
                }).catch(()=>{});
              } finally {
                window.open('/rex-chat', '_blank');
              }
            }}
            title="Open REX to adjust reply style and parameters"
          >
            Tune with REX
          </button>
          <button
            className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-white"
            onClick={()=> setShowStrategyModal(true)}
            title="Open strategy modal to guide REX responses"
          >
            Sales Agent Response
          </button>
        </div>
      </div>

      {/* Test tools */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <div className="font-semibold text-gray-100 mb-1">Test tools</div>
        <div className="text-xs text-gray-400 mb-2">Send a test email using your configured sender. If you leave the field blank, we’ll try your account email.</div>
        <div className="flex items-center gap-2">
          <input
            placeholder="you@yourdomain.com"
            className="flex-1 rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white"
            value={testTo}
            onChange={(e)=> setTestTo(e.target.value)}
          />
          <button
            className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs text-white"
            onClick={async ()=>{
              try {
                const payload = testTo && testTo.length ? { to: testTo } : {} as any;
                const res = await apiPost('/api/sales/test-email', payload);
                alert(res?.ok ? `Test email sent to ${res?.sent?.to}` : `Failed: ${res?.message || res?.error || 'unknown'}`);
              } catch (e:any) {
                alert(`Failed: ${e?.message || e}`);
              }
            }}
          >
            Send test email
          </button>
        </div>
      </div>
      {/* Sales Agent Response Strategy Modal */}
      {showStrategyModal && (
        <div className="fixed inset-0 z-[999] items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in flex">
          <div className="w-full max-w-xl rounded-2xl bg-[#0f1115] border border-white/10 shadow-xl p-6 animate-scale-in text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Sales Agent Response Strategy</h2>
              <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-gray-200 transition-colors" onClick={()=> setShowStrategyModal(false)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 01-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Tell REX how to respond to interested prospects. These settings act as a strategy guide — REX still adapts intelligently to each message.
            </p>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm mb-2">Tone</label>
              <select value={strategyTone} onChange={(e)=> setStrategyTone(e.target.value)} className="w-full bg-[#181a20] border border-white/10 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="warm">Warm & friendly</option>
                <option value="direct">Direct & concise</option>
                <option value="enterprise">Enterprise polished</option>
                <option value="highenergy">High-energy</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm mb-2">Goal priority</label>
              <select value={strategyPriority} onChange={(e)=> setStrategyPriority(e.target.value)} className="w-full bg-[#181a20] border border-white/10 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
                <option value="book">Book a meeting ASAP</option>
                <option value="warm">Warm before booking</option>
                <option value="qualify">Qualify first</option>
                <option value="objection">Handle objections → then book</option>
                <option value="soft">Keep it soft / relationship-focused</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">Custom instructions</label>
              <textarea
                value={strategyInstructions}
                onChange={(e)=> setStrategyInstructions(e.target.value)}
                rows={4}
                placeholder="Example: Avoid sounding salesy. Always confirm availability if they offer times. Mention pricing link only if asked."
                className="w-full bg-[#181a20] border border-white/10 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-none"
              />
            </div>
            <button className="text-blue-400 text-sm hover:text-blue-300 underline mb-3 transition-colors" onClick={()=> setShowExamples(v=> !v)}>
              {showExamples ? 'Hide examples' : 'Show examples'}
            </button>
            {showExamples && (
              <div className="bg-[#14161b] text-gray-300 text-sm rounded-lg border border-white/5 p-3 space-y-2 mb-4 animate-slide-up">
                <p>• "If they ask about pricing, include our pricing page."</p>
                <p>• "If they seem unsure, suggest a short intro call."</p>
                <p>• "Stay concise — no more than 3–4 sentences."</p>
                <p>• "Acknowledge what they said before pivoting to the CTA."</p>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-8">
              <button className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors" onClick={()=> setShowStrategyModal(false)}>Cancel</button>
              <button
                className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-lg transition-colors"
                onClick={async ()=>{
                  if (!policy) return;
                  const next = {
                    ...policy,
                    reply_style: { ...(policy.reply_style || {}), tone: strategyTone },
                    reply_strategy: { priority: strategyPriority, instructions: strategyInstructions }
                  };
                  setPolicy(next);
                  try { await apiPost('/api/sales/policy', next); } catch {}
                  setShowStrategyModal(false);
                }}
              >
                Save Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


