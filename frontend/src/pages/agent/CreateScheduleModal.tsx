import React, { useEffect, useState } from 'react';
import { listPersonas } from '../../lib/api/personas';
import { listSourcingCampaigns, createCampaignFromPersona } from '../../lib/api/campaigns';
import { supabase } from '../../lib/supabaseClient';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultPersonaId?: string;
  defaultActionTool?: string;
  defaultToolPayload?: Record<string, any>;
};

export default function CreateScheduleModal({ open, onClose, defaultPersonaId }: Props) {
  const [personas, setPersonas] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await listPersonas();
        setPersonas(Array.isArray(data) ? data : []);
      } catch {
        setPersonas([]);
      }
    })();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await listSourcingCampaigns();
        setCampaigns(Array.isArray(list) ? list : []);
      } catch {
        setCampaigns([]);
      }
    })();
  }, [open]);

  const [step, setStep] = useState<number>(1);
  const [actionType, setActionType] = useState<'source_persona' | 'launch_campaign' | 'persona_auto_outreach'>(() => 'source_persona');
  const [personaId, setPersonaId] = useState<string>(defaultPersonaId || '');
  useEffect(() => {
    if (!defaultPersonaId && personas.length > 0 && !personaId) {
      setPersonaId(personas[0].id);
    }
  }, [personas, defaultPersonaId, personaId]);
  const [campaignId, setCampaignId] = useState<string>('');
  useEffect(() => {
    if (!campaignId && campaigns.length > 0) {
      setCampaignId(campaigns[0].id);
    }
  }, [campaignId, campaigns]);
  const [campaignMode, setCampaignMode] = useState<'existing' | 'new'>('existing');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [leadsPerRun, setLeadsPerRun] = useState<number>(50);
  const [timingMode, setTimingMode] = useState<'one_time' | 'recurring'>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState<string>('');
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<string>('09:00');
  const [sendDelayMode, setSendDelayMode] = useState<'immediate' | 'delay'>('immediate');
  const [sendDelayHours, setSendDelayHours] = useState<number>(0);
  const [dailySendCap, setDailySendCap] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (actionType !== 'persona_auto_outreach') {
      setCampaignMode('existing');
    }
  }, [actionType]);
  useEffect(() => {
    if (campaignMode === 'new' && personaId && !newCampaignName) {
      const personaName = personas.find(p => p.id === personaId)?.name;
      if (personaName) setNewCampaignName(`${personaName} – Evergreen`);
    }
  }, [campaignMode, personaId, personas, newCampaignName]);
  useEffect(() => {
    if (sendDelayMode === 'delay' && sendDelayHours < 1) {
      setSendDelayHours(1);
    }
  }, [sendDelayMode, sendDelayHours]);

  if (!open) return null;

  const toggleDay = (d: string) => {
    setRecurringDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const personaSelected = Boolean(personaId);
  const existingCampaignSelected = Boolean(campaignId);
  const newCampaignValid = newCampaignName.trim().length >= 3;
  const personaAutoReady = personaSelected && (campaignMode === 'existing' ? existingCampaignSelected : newCampaignValid);
  const targetStepReady = actionType === 'launch_campaign'
    ? existingCampaignSelected
    : actionType === 'persona_auto_outreach'
      ? personaAutoReady
      : personaSelected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Create Schedule</h3>
          <button className="text-slate-300 hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <span className={`px-2 py-1 rounded ${step>=1? 'bg-primary/20 text-primary':'bg-slate-800'}`}>1. Action</span>
          <span className={`px-2 py-1 rounded ${step>=2? 'bg-primary/20 text-primary':'bg-slate-800'}`}>2. Target</span>
          <span className={`px-2 py-1 rounded ${step>=3? 'bg-primary/20 text-primary':'bg-slate-800'}`}>3. Timing</span>
          <span className={`px-2 py-1 rounded ${step>=4? 'bg-primary/20 text-primary':'bg-slate-800'}`}>4. Confirm</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">Select Action Type</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button className={`p-4 rounded-lg border transition-colors ${actionType==='source_persona' ? 'border-blue-400 bg-blue-500/10 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'}`} onClick={()=>setActionType('source_persona')}>
                <div className="font-semibold mb-1">Source Leads via Persona</div>
                <div className={`text-xs ${actionType==='source_persona' ? 'text-blue-300' : 'text-slate-400'}`}>Automate sourcing using saved persona filters</div>
              </button>
              <button className={`p-4 rounded-lg border transition-colors ${actionType==='launch_campaign' ? 'border-violet-400 bg-violet-500/10 text-violet-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'}`} onClick={()=>setActionType('launch_campaign')}>
                <div className="font-semibold mb-1">Launch Campaign / Send Sequence</div>
                <div className={`text-xs ${actionType==='launch_campaign' ? 'text-violet-300' : 'text-slate-400'}`}>Start sending a campaign at a scheduled time</div>
              </button>
              <button className={`p-4 rounded-lg border transition-colors ${actionType==='persona_auto_outreach' ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'}`} onClick={()=>setActionType('persona_auto_outreach')}>
                <div className="font-semibold mb-1">Persona + Auto Outreach</div>
                <div className={`text-xs ${actionType==='persona_auto_outreach' ? 'text-emerald-300' : 'text-slate-400'}`}>Source from a persona and auto-send via a campaign</div>
              </button>
            </div>
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {actionType==='source_persona' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Persona</label>
                <select value={personaId} onChange={(e)=>setPersonaId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                  {personas.length === 0 && (<option value="" disabled>No personas available</option>)}
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {actionType==='launch_campaign' && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Campaign</label>
                <select value={campaignId} onChange={(e)=>setCampaignId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                  {campaigns.length === 0 && <option value="" disabled>No campaigns found</option>}
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.title || c.name}</option>)}
                </select>
              </div>
            )}
            {actionType==='persona_auto_outreach' && (
              <>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Persona</label>
                  <select value={personaId} onChange={(e)=>setPersonaId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                    {personas.length === 0 && (<option value="" disabled>No personas available</option>)}
                    {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="mt-4 border border-slate-700 rounded-lg p-4 bg-slate-900/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-slate-300 font-semibold">Outreach Campaign</p>
                      <p className="text-xs text-slate-400">Choose how new leads should send from a campaign.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
                    <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border ${campaignMode==='existing' ? 'border-blue-400 bg-blue-500/10 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
                      <input type="radio" name="campaign-mode" className="accent-blue-500" checked={campaignMode==='existing'} onChange={()=>setCampaignMode('existing')} />
                      <span>Use existing campaign</span>
                    </label>
                    <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border ${campaignMode==='new' ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
                      <input type="radio" name="campaign-mode" className="accent-emerald-500" checked={campaignMode==='new'} onChange={()=>setCampaignMode('new')} />
                      <span>Create new campaign</span>
                    </label>
                  </div>
                  {campaignMode==='existing' ? (
                    <select value={campaignId} onChange={(e)=>setCampaignId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                      {campaigns.length === 0 && <option value="" disabled>No campaigns found</option>}
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.title || c.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e)=>setNewCampaignName(e.target.value)}
                      className="w-full bg-slate-800 text-white rounded px-3 py-2"
                      placeholder={`${personas.find(p => p.id === personaId)?.name || 'Persona'} – Evergreen`}
                    />
                  )}
                </div>
              </>
            )}
            <div className="flex justify-between">
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>setStep(1)}>Back</button>
              <button
                className={`px-4 py-2 rounded ${targetStepReady ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                onClick={()=>targetStepReady && setStep(3)}
                disabled={!targetStepReady}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {(actionType==='source_persona' || actionType==='persona_auto_outreach') && (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Leads per run</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={leadsPerRun}
                  onChange={(e)=>setLeadsPerRun(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  className="w-full bg-slate-800 text-white rounded px-3 py-2"
                />
                <p className="text-xs text-slate-500 mt-1">We\'ll attempt to source this many new leads each time.</p>
              </div>
            )}
            <label className="block text-sm text-slate-300">Time Settings</label>
            <div className="flex gap-2 mb-2">
              <button className={`px-3 py-1.5 rounded ${timingMode === 'one_time' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`} onClick={() => setTimingMode('one_time')}>One-Time</button>
              <button className={`px-3 py-1.5 rounded ${timingMode === 'recurring' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`} onClick={() => setTimingMode('recurring')}>Recurring</button>
            </div>
            {timingMode==='one_time' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input type="date" className="w-full bg-slate-800 text-white rounded px-3 py-2" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Time</label>
                  <input type="time" className="w-full bg-slate-800 text-white rounded px-3 py-2" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Days of Week</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Mon','Tue','Wed','Thu','Fri'].map(d => (
                    <button key={d} className={`px-2 py-1 rounded ${recurringDays.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`} onClick={() => toggleDay(d)}>{d}</button>
                  ))}
                </div>
                <label className="block text-xs text-slate-400 mb-1">Time</label>
                <input type="time" className="w-full bg-slate-800 text-white rounded px-3 py-2" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
              </div>
            )}
            {actionType==='persona_auto_outreach' && (
              <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/30 space-y-3">
                <div>
                  <p className="text-sm text-slate-300 font-semibold">Outreach behavior</p>
                  <p className="text-xs text-slate-500">Control when Step 1 is sent and cap total sends per run.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Send first message</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className={`flex-1 px-3 py-2 rounded border ${sendDelayMode==='immediate' ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
                      <input type="radio" className="mr-2 accent-emerald-500" checked={sendDelayMode==='immediate'} onChange={()=>setSendDelayMode('immediate')} />
                      Immediately when lead is created
                    </label>
                    <label className={`flex-1 px-3 py-2 rounded border ${sendDelayMode==='delay' ? 'border-amber-400 bg-amber-500/10 text-amber-100' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
                      <input type="radio" className="mr-2 accent-amber-500" checked={sendDelayMode==='delay'} onChange={()=>setSendDelayMode('delay')} />
                      <span>After</span>
                      {sendDelayMode==='delay' ? (
                        <input
                          type="number"
                          min={1}
                          max={72}
                          value={sendDelayHours}
                          onChange={(e)=>setSendDelayHours(Math.max(1, Math.min(72, Number(e.target.value) || 1)))}
                          className="ml-2 bg-slate-900 text-white w-16 rounded px-2 py-1 inline-block"
                        />
                      ) : (
                        <span className="ml-2 text-slate-400">_</span>
                      )}
                      <span className="ml-2">hours</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">Daily send cap (optional)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={dailySendCap}
                    onChange={(e)=>setDailySendCap(e.target.value)}
                    placeholder="Leave blank to use campaign defaults"
                    className="w-full bg-slate-800 text-white rounded px-3 py-2"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>setStep(2)}>Back</button>
              <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>setStep(4)}>Next</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h4 className="text-white font-medium">Confirmation</h4>
            <div className="text-slate-300 text-sm">
              <div>Action: {{
                source_persona: 'Source via Persona',
                launch_campaign: 'Launch Campaign',
                persona_auto_outreach: 'Source persona + auto-send'
              }[actionType]}</div>
              {actionType!=='launch_campaign' && (
                <div>Persona: {personas.find(p=>p.id===personaId)?.name || 'Select a persona'}</div>
              )}
              {actionType==='launch_campaign' && (
                <div>Campaign: {campaigns.find(c=>c.id===campaignId)?.title || campaigns.find(c=>c.id===campaignId)?.name || 'Select a campaign'}</div>
              )}
              {actionType==='persona_auto_outreach' && (
                <>
                  <div>Campaign: {campaignMode==='existing'
                    ? (campaigns.find(c=>c.id===campaignId)?.title || campaigns.find(c=>c.id===campaignId)?.name || 'Select a campaign')
                    : (newCampaignName || 'New campaign')}
                  </div>
                  <div>Leads per run: {leadsPerRun}</div>
                  <div>Step 1 send: {sendDelayMode==='immediate' ? 'Immediately' : `After ${sendDelayHours} hour(s)`}</div>
                  <div>Daily cap: {dailySendCap ? `${dailySendCap} sends/day` : 'Use campaign default limits'}</div>
                </>
              )}
              {actionType!=='persona_auto_outreach' && actionType!=='launch_campaign' && (
                <div>Leads per run: {leadsPerRun}</div>
              )}
              <div>Timing: {timingMode==='one_time'
                ? `${oneTimeDate || 'Date TBD'} ${timeOfDay}`
                : `Recurring on ${recurringDays.length ? recurringDays.join(', ') : 'selected days'} at ${timeOfDay}`}</div>
            </div>
            <div className="text-amber-400 text-xs">Note: UI-only. Credits may apply when running in production.</div>
            <div className="flex justify-between">
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>setStep(3)}>Back</button>
              <button
                className={`px-4 py-2 rounded ${saving ? 'bg-green-800 text-white/70' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                disabled={saving}
                onClick={async () => {
                  try {
                    setError(null);
                    setSaving(true);
                    let resolvedCampaignId = campaignId;
                    if (actionType === 'persona_auto_outreach' && campaignMode === 'new') {
                      if (!personaId) throw new Error('Select a persona before creating a campaign');
                      const name = newCampaignName.trim() || `${personas.find(p => p.id === personaId)?.name || 'Persona'} – Evergreen`;
                      const created = await createCampaignFromPersona({ persona_id: personaId, name });
                      resolvedCampaignId = created.id;
                      setCampaignId(created.id);
                      setCampaigns(prev => prev.some(c => c.id === created.id) ? prev : [created, ...prev]);
                    }
                    const body: any = {
                      name: actionType === 'source_persona'
                        ? `Source – ${personas.find(p=>p.id===personaId)?.name || 'Persona'}`
                        : actionType === 'persona_auto_outreach'
                          ? `Auto Track – ${personas.find(p=>p.id===personaId)?.name || 'Persona'}`
                          : `Schedule – ${campaigns.find(c=>c.id===campaignId)?.title || campaigns.find(c=>c.id===campaignId)?.name || 'Campaign'}`,
                      schedule_kind: timingMode === 'recurring' ? 'recurring' : 'one_time',
                    };
                    const cronOrRun = timingMode === 'recurring'
                      ? buildCronExpression(recurringDays, timeOfDay)
                      : buildRunAtIso(oneTimeDate, timeOfDay);
                    if (timingMode === 'recurring') body.cron_expr = cronOrRun;
                    else body.run_at = cronOrRun || new Date().toISOString();

                    if (actionType === 'source_persona') {
                      body.action_type = 'source_via_persona';
                      body.persona_id = personaId;
                      body.payload = {
                        action_tool: 'sourcing.run_persona',
                        tool_payload: { persona_id: personaId, batch_size: leadsPerRun }
                      };
                    } else if (actionType === 'launch_campaign') {
                      body.action_type = 'launch_campaign';
                      body.campaign_id = resolvedCampaignId;
                      body.payload = { batch_size: leadsPerRun };
                    } else if (actionType === 'persona_auto_outreach') {
                      body.action_type = 'persona_with_auto_outreach';
                      body.persona_id = personaId;
                      body.linked_persona_id = personaId;
                      body.campaign_id = resolvedCampaignId;
                      body.linked_campaign_id = resolvedCampaignId;
                      body.auto_outreach_enabled = true;
                      body.leads_per_run = leadsPerRun;
                      body.send_delay_minutes = sendDelayMode === 'immediate' ? 0 : sendDelayHours * 60;
                      body.daily_send_cap = dailySendCap ? Number(dailySendCap) : null;
                      body.payload = {
                        action_tool: 'sourcing.run_persona',
                        tool_payload: {
                          persona_id: personaId,
                          campaign_id: resolvedCampaignId,
                          auto_outreach_enabled: true,
                          leads_per_run: leadsPerRun,
                          send_delay_minutes: body.send_delay_minutes,
                          daily_send_cap: body.daily_send_cap
                        }
                      };
                    }

                    const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || (import.meta as any)?.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
                    const apiUrl = (p: string) => `${API_BASE}${p}`;
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const resp = await fetch(apiUrl('/api/schedules'), { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials:'include', body: JSON.stringify(body) });
                    if (resp.ok) {
                      onClose();
                      window.location.href = '/agent/advanced/schedules';
                    } else {
                      const message = await resp.text();
                      setError(message || 'Failed to create schedule');
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Failed to create schedule');
                  } finally {
                    setSaving(false);
                  }
                }}
              >Save</button>
            </div>
            {error && <div className="text-red-400 text-xs">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_TO_CRON: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function buildCronExpression(days: string[], time: string) {
  const safeTime = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const [hour, minute] = safeTime.split(':').map(Number);
  const mapped = (days || []).map(d => DAY_TO_CRON[d] ?? null).filter(v => v !== null) as number[];
  const dayField = mapped.length ? mapped.join(',') : '*';
  return `${minute} ${hour} * * ${dayField}`;
}

function buildRunAtIso(dateStr: string, time: string) {
  if (!dateStr) return null;
  const safeTime = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const composed = new Date(`${dateStr}T${safeTime}`);
  return Number.isNaN(composed.getTime()) ? null : composed.toISOString();
}


