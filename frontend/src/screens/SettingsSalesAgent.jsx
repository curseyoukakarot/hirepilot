import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';

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

function computeNeeds(policy){
  const needs = [];
  if (policy?.sender?.behavior === 'single' && !policy?.sender?.email) needs.push('sender_email');
  if (!policy?.assets?.demo_video_url) needs.push('demo_video_url');
  if (!policy?.assets?.pricing_url) needs.push('pricing_url');
  return needs;
}

function MissingBanner({ needs }){
  if (!needs?.length) return null;
  const map = {
    sender_email: 'Sender email (Settings → Sales Agent → “Send from”)',
    demo_video_url: 'Demo video URL',
    pricing_url: 'Pricing page URL'
  };
  return (
    <div className="mb-4 rounded-lg border border-red-500 bg-red-50 text-red-800 p-4">
      <div className="font-semibold mb-1">Complete your Sales Agent setup</div>
      <ul className="list-disc ml-5">
        {needs.map(k => <li key={k}>{map[k] ?? k}</li>)}
      </ul>
      <div className="text-sm mt-2">The agent will not auto-send without a configured sender. Links are optional, but recommended.</div>
    </div>
  );
}

function Section({ title, desc, children }){
  return (
    <div className="rounded-2xl border border-zinc-200 p-5 bg-white">
      <div className="mb-2">
        <div className="text-lg font-semibold">{title}</div>
        {desc ? <div className="text-sm text-zinc-500">{desc}</div> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function SettingsSalesAgent(){
  const [policy, setPolicy] = useState(null);
  const [needs, setNeeds] = useState([]);
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
    } catch (e) {
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
    } finally {
      setSaving(false);
    }
  };

  const previewBody = useMemo(() => {
    if (!policy) return '';
    const lines = [];
    lines.push('Hey {{firstName}} — appreciate the reply!');
    if (policy.assets?.demo_video_url) lines.push(`Here’s a quick demo: ${policy.assets.demo_video_url}`);
    if (policy.assets?.pricing_url) lines.push(`Pricing details: ${policy.assets.pricing_url}`);
    const ev = policy.scheduling?.event_type ? `${policy.scheduling.event_type}` : '';
    lines.push(ev ? `Grab a time here: https://calendly.com/${ev}` : 'If helpful, I can share a quick link to book a time.');
    lines.push('— {{yourName}}');
    return lines.join('\n\n');
  }, [policy]);

  if (!policy) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sales Agent</h2>
        <p className="text-sm text-zinc-500">Control how the agent handles replies, shares demos/pricing, and books meetings.</p>
      </div>

      <MissingBanner needs={needs} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Mode" desc="Auto-send or propose drafts for approval.">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="radio" checked={policy.mode === 'handle'} onChange={() => setPolicy({ ...policy, mode: 'handle' })} />
              <span>Handle (auto-send)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={policy.mode === 'share'} onChange={() => setPolicy({ ...policy, mode: 'share' })} />
              <span>Share & ask (drafts)</span>
            </label>
          </div>
        </Section>

        <Section title="Send from" desc="Choose sender behavior and default email address.">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="radio" checked={policy.sender?.behavior === 'single'} onChange={() => setPolicy({ ...policy, sender: { ...policy.sender, behavior: 'single' } })} />
              <span>Single sender</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={policy.sender?.behavior === 'rotate'} onChange={() => setPolicy({ ...policy, sender: { ...policy.sender, behavior: 'rotate' } })} />
              <span>Rotate senders</span>
            </label>
          </div>
          {policy.sender?.behavior === 'single' && (
            <div className="space-y-2">
              <label className="block text-sm">Sender email</label>
              <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="you@yourdomain.com" value={policy.sender?.email || ''} onChange={(e)=> setPolicy({ ...policy, sender: { ...policy.sender, email: e.target.value } })} />
              {!policy.sender?.email && <div className="text-xs text-red-500">Required for auto-send.</div>}
            </div>
          )}
        </Section>

        <Section title="Scheduling" desc="Default Calendly event type.">
          <div className="space-y-2">
            <label className="block text-sm">Calendly event type</label>
            <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="your-org/15min-intro" value={policy.scheduling?.event_type || ''} onChange={(e)=> setPolicy({ ...policy, scheduling: { ...policy.scheduling, event_type: e.target.value } })} />
            <div className="text-xs text-zinc-500">Will display as https://calendly.com/<b>{policy.scheduling?.event_type || '…'}</b></div>
          </div>
        </Section>

        <Section title="Assets" desc="Links the agent can include in replies.">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm">Demo video URL</label>
              <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="https://youtu.be/…" value={policy.assets?.demo_video_url || ''} onChange={(e)=> setPolicy({ ...policy, assets: { ...policy.assets, demo_video_url: e.target.value } })} />
            </div>
            <div>
              <label className="block text-sm">Pricing page URL</label>
              <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="https://yourdomain.com/pricing" value={policy.assets?.pricing_url || ''} onChange={(e)=> setPolicy({ ...policy, assets: { ...policy.assets, pricing_url: e.target.value } })} />
            </div>
            <div>
              <label className="block text-sm">One-pager URL (PDF)</label>
              <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="https://…/onepager.pdf" value={policy.assets?.one_pager_url || ''} onChange={(e)=> setPolicy({ ...policy, assets: { ...policy.assets, one_pager_url: e.target.value } })} />
            </div>
          </div>
        </Section>

        <Section title="Reply style" desc="Tone and format used by the agent.">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Tone</label>
              <select className="w-full rounded-lg border border-zinc-300 bg-white p-2" value={policy.reply_style?.tone} onChange={(e)=> setPolicy({ ...policy, reply_style: { ...policy.reply_style, tone: e.target.value } })}>
                <option value="friendly-direct">Friendly & Direct</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Length</label>
              <select className="w-full rounded-lg border border-zinc-300 bg-white p-2" value={policy.reply_style?.length} onChange={(e)=> setPolicy({ ...policy, reply_style: { ...policy.reply_style, length: e.target.value } })}>
                <option value="short">Short (≤120 words)</option>
                <option value="medium">Medium</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm">Format</label>
              <select className="w-full rounded-lg border border-zinc-300 bg-white p-2" value={policy.reply_style?.format} onChange={(e)=> setPolicy({ ...policy, reply_style: { ...policy.reply_style, format: e.target.value } })}>
                <option value="bullet_then_cta">Bullets then CTA</option>
                <option value="paragraph">Single paragraph</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Limits" desc="Protect deliverability.">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Max sends per thread per day</label>
              <input type="number" min={1} max={3} className="w-full rounded-lg border border-zinc-300 bg-white p-2" value={policy.limits?.per_thread_daily ?? 1} onChange={(e)=> setPolicy({ ...policy, limits: { ...policy.limits, per_thread_daily: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="block text-sm">Quiet hours (local)</label>
              <input className="w-full rounded-lg border border-zinc-300 bg-white p-2" placeholder="20:00-07:00" value={policy.limits?.quiet_hours_local || '20:00-07:00'} onChange={(e)=> setPolicy({ ...policy, limits: { ...policy.limits, quiet_hours_local: e.target.value } })} />
            </div>
          </div>
        </Section>

        <Section title="Live preview" desc="Sample reply using your current settings.">
          <pre className="rounded-lg border border-zinc-200 bg-white p-3 text-sm whitespace-pre-wrap">{previewBody}</pre>
        </Section>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-medium text-white" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button className="rounded-xl bg-zinc-200 hover:bg-zinc-300 px-4 py-2" onClick={()=> setPreview(previewBody)}>
          Refresh Preview
        </button>
        {needs?.length ? (
          <span className="text-xs text-red-500">Setup incomplete — the agent won’t auto-send until required fields are set.</span>
        ) : (
          <span className="text-xs text-green-600">Setup complete.</span>
        )}
      </div>

      {/* --- Test & Dev tools --- */}
      <div className="mt-6 rounded-2xl border border-zinc-200 p-4 bg-white space-y-3">
        <div className="font-semibold">Test tools</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Send test email */}
          <div className="space-y-2">
            <div className="text-sm text-zinc-600">Send a test email using your configured sender. If you leave the field blank, we’ll try your account email.</div>
            <div className="flex items-center gap-2">
              <input id="test-to" placeholder="you@yourdomain.com" className="flex-1 rounded-lg border border-zinc-300 bg-white p-2" onChange={(e)=> (window).__testTo = e.target.value} />
              <button className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm text-white" onClick={async ()=>{
                const to = (window).__testTo;
                try {
                  const res = await apiPost('/api/sales/test-email', to && to.length ? { to } : {});
                  alert(res?.ok ? `Test email sent to ${res?.sent?.to}` : `Failed: ${res?.message || res?.error || 'unknown'}`);
                } catch (e) {
                  alert(`Failed: ${e.message || e}`);
                }
              }}>Send test email</button>
            </div>
          </div>

          {/* Simulate inbound (dev only) */}
          {import.meta.env.VITE_DEV_TOOLS === 'true' && (
            <div className="space-y-2">
              <div className="text-sm text-zinc-600">Simulate an inbound reply (dev only). This enqueues the same worker path as a real reply.</div>
              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-zinc-200 hover:bg-zinc-300 px-3 py-2 text-sm" onClick={async ()=>{
                  try {
                    const res = await apiPost('/api/sales/sim-inbound', { subject: 'Re: HirePilot', body: 'Hi — interested, can you send pricing and a demo?' });
                    alert(res?.ok ? `Simulated inbound on thread ${res?.thread_id}` : `Failed: ${res?.message || res?.error || 'unknown'}`);
                  } catch (e) {
                    alert(`Failed: ${e.message || e}`);
                  }
                }}>Simulate inbound reply</button>
              </div>
              <div className="text-xs text-zinc-500">Set <code>VITE_DEV_TOOLS=true</code> to show this in non-prod environments.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


