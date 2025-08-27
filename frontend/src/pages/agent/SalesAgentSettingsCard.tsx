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
  const [preview, setPreview] = useState('');

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
        <pre className="rounded border border-slate-700 bg-slate-900 p-3 text-sm text-gray-200 whitespace-pre-wrap">{previewBody}</pre>
        <button className="mt-2 rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-white" onClick={()=> setPreview(previewBody)}>Refresh preview</button>
      </div>
    </div>
  );
}


