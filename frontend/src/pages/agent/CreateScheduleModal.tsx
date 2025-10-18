import React, { useEffect, useMemo, useState } from 'react';
import { listPersonas } from '../../lib/api/personas';
import { supabase } from '../../lib/supabaseClient';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultPersonaId?: string;
  defaultActionTool?: string;
  defaultToolPayload?: Record<string, any>;
};

export default function CreateScheduleModal({ open, onClose, defaultPersonaId, defaultActionTool, defaultToolPayload }: Props) {
  const [personas, setPersonas] = useState<any[]>([]);
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
  const campaigns = useMemo(() => ([
    { id: 'camp-1', name: 'AE NYC • Fall' },
    { id: 'camp-2', name: 'React Devs • Q4' }
  ]), []);

  const [step, setStep] = useState<number>(1);
  const [actionType, setActionType] = useState<'source_persona' | 'launch_campaign'>(() => defaultActionTool ? 'source_persona' : 'source_persona');
  const [personaId, setPersonaId] = useState<string>(defaultPersonaId || '');
  useEffect(() => {
    if (!defaultPersonaId && personas.length > 0 && !personaId) {
      setPersonaId(personas[0].id);
    }
  }, [personas, defaultPersonaId, personaId]);
  const [campaignId, setCampaignId] = useState<string>('camp-1');
  const [timingMode, setTimingMode] = useState<'one_time' | 'recurring'>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState<string>('');
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<string>('09:00');

  if (!open) return null;

  const toggleDay = (d: string) => {
    setRecurringDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

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
            <div className="grid grid-cols-2 gap-3">
              <button className={`p-4 rounded-lg border transition-colors ${actionType==='source_persona' ? 'border-blue-400 bg-blue-500/10 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'}`} onClick={()=>setActionType('source_persona')}>
                <div className="font-semibold mb-1">Source Leads via Persona</div>
                <div className={`text-xs ${actionType==='source_persona' ? 'text-blue-300' : 'text-slate-400'}`}>Automate sourcing using saved persona filters</div>
              </button>
              <button className={`p-4 rounded-lg border transition-colors ${actionType==='launch_campaign' ? 'border-violet-400 bg-violet-500/10 text-violet-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'}`} onClick={()=>setActionType('launch_campaign')}>
                <div className="font-semibold mb-1">Launch Campaign / Send Sequence</div>
                <div className={`text-xs ${actionType==='launch_campaign' ? 'text-violet-300' : 'text-slate-400'}`}>Start sending a campaign at a scheduled time</div>
              </button>
            </div>
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {actionType==='source_persona' ? (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Persona</label>
                <select value={personaId} onChange={(e)=>setPersonaId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                  {personas.length === 0 && (<option value="" disabled>No personas available</option>)}
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-slate-300 mb-1">Campaign</label>
                <select value={campaignId} onChange={(e)=>setCampaignId(e.target.value)} className="w-full bg-slate-800 text-white rounded px-3 py-2">
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-between">
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>setStep(1)}>Back</button>
              <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>setStep(3)}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
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
              <div>Action: {actionType==='source_persona' ? 'Source via Persona' : 'Launch Campaign'}</div>
              <div>Target: {actionType==='source_persona' ? personas.find(p=>p.id===personaId)?.name : campaigns.find(c=>c.id===campaignId)?.name}</div>
              <div>Timing: {timingMode==='one_time' ? `${oneTimeDate || 'TBD'} ${timeOfDay}` : `Recurring on ${recurringDays.join(', ') || 'days TBD'} at ${timeOfDay}`}</div>
            </div>
            <div className="text-amber-400 text-xs">Note: UI-only. Credits may apply when running in production.</div>
            <div className="flex justify-between">
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>setStep(3)}>Back</button>
              <button
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  try {
                    const body: any = {
                      name: actionType === 'source_persona' ? `Source – ${personas.find(p=>p.id===personaId)?.name}` : `Schedule – ${campaigns.find(c=>c.id===campaignId)?.name}`,
                      schedule_kind: timingMode === 'recurring' ? 'recurring' : 'one_time',
                    };
                    if (defaultActionTool) {
                      body.payload = { action_tool: defaultActionTool, tool_payload: defaultToolPayload || { persona_id: defaultPersonaId, batch_size: 50 } };
                    } else {
                      body.action_type = actionType === 'source_persona' ? 'source_via_persona' : 'launch_campaign';
                      body.persona_id = actionType === 'source_persona' ? personaId : undefined;
                      body.campaign_id = actionType !== 'source_persona' ? campaignId : undefined;
                      body.payload = { batch_size: 100 };
                    }
                    if (timingMode === 'recurring') body.cron_expr = '0 9 * * 1,3';
                    else body.run_at = new Date().toISOString();
                    const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || (import.meta as any)?.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
                    const apiUrl = (p: string) => `${API_BASE}${p}`;
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const resp = await fetch(apiUrl('/api/schedules'), { method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials:'include', body: JSON.stringify(body) });
                    if (resp.ok) {
                      onClose();
                      window.location.href = '/agent/advanced/schedules';
                    }
                  } catch {}
                }}
              >Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


