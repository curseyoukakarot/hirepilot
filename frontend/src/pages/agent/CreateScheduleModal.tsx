import React, { useMemo, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultPersonaId?: string;
};

export default function CreateScheduleModal({ open, onClose, defaultPersonaId }: Props) {
  const personas = useMemo(() => ([
    { id: 'p-recruiter', name: 'Recruiter Pro' },
    { id: 'p-sourcer', name: 'Sourcing Specialist' },
    { id: 'p-sales', name: 'Sales SDR' }
  ]), []);
  const campaigns = useMemo(() => ([
    { id: 'camp-1', name: 'AE NYC • Fall' },
    { id: 'camp-2', name: 'React Devs • Q4' }
  ]), []);

  const [step, setStep] = useState<number>(1);
  const [actionType, setActionType] = useState<'source_persona' | 'launch_campaign'>('source_persona');
  const [personaId, setPersonaId] = useState<string>(defaultPersonaId || 'p-recruiter');
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
              <button className={`p-4 rounded-lg border ${actionType==='source_persona'?'border-primary text-primary bg-primary/10':'border-slate-700 text-slate-300 bg-slate-800'}`} onClick={()=>setActionType('source_persona')}>
                <div className="font-medium mb-1">Source Leads via Persona</div>
                <div className="text-xs text-slate-400">Automate sourcing using saved persona filters</div>
              </button>
              <button className={`p-4 rounded-lg border ${actionType==='launch_campaign'?'border-primary text-primary bg-primary/10':'border-slate-700 text-slate-300 bg-slate-800'}`} onClick={()=>setActionType('launch_campaign')}>
                <div className="font-medium mb-1">Launch Campaign / Send Sequence</div>
                <div className="text-xs text-slate-400">Start sending a campaign at a scheduled time</div>
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
              <button className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white" onClick={onClose}>Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


