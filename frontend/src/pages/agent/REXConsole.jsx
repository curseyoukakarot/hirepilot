import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CreateScheduleModal from './CreateScheduleModal';

function usePersona(personaId) {
  const [persona, setPersona] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(`/api/personas/${personaId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data) => { if (!cancelled) setPersona(data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);
  return { persona, isLoading, error };
}

export default function REXConsole() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const personaId = params.get('persona');
  const { persona, isLoading } = usePersona(personaId);
  const [showSchedule, setShowSchedule] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  const banner = useMemo(() => {
    if (!persona) return null;
    const titles = (persona.titles || []).slice(0, 3).join(', ');
    const locs = (persona.locations || []).slice(0, 3).join(', ');
    return (
      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Persona loaded: {persona.name}</div>
            <div className="text-slate-400 text-sm">{titles || '—'}{locs ? ` • ${locs}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
              onClick={async () => {
                try {
                  let credit_mode = enhanced ? 'enhanced' : 'base';
                  if (enhanced) {
                    const ok = window.confirm('Enhanced Enrichment may consume additional credits per lead. Continue?');
                    if (!ok) credit_mode = 'base';
                  }
                  const resp = await fetch('/api/agent/run-persona', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ persona_id: persona.id, batch_size: 50, credit_mode })
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data?.error || 'Run failed');
                  alert(`Sourced ${data?.added_count || 0} new leads (${data?.skipped_duplicates || 0} duplicates skipped).`);
                } catch (e) {
                  alert(`Run failed: ${e?.message || e}`);
                }
              }}
            >Run Now – Source Leads</button>
            <button
              className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
              onClick={() => setShowSchedule(true)}
            >Schedule This…</button>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enhanced} onChange={(e)=>setEnhanced(e.target.checked)} />
            Enhanced Enrichment
          </label>
        </div>
      </div>
    );
  }, [persona, enhanced]);

  return (
    <div className="space-y-4">
      {isLoading && <div className="text-slate-400">Loading persona…</div>}
      {persona && banner}
      {/* Placeholder chat panel */}
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 min-h-[320px]">
        <div className="text-slate-400">REX Console coming soon. Persona context is preloaded for sourcing.</div>
      </div>
      {showSchedule && persona && (
        <CreateScheduleModal
          open={showSchedule}
          onClose={()=>setShowSchedule(false)}
          defaultPersonaId={persona.id}
          defaultActionTool="sourcing.run_persona"
          defaultToolPayload={{ persona_id: persona.id, batch_size: 50 }}
        />
      )}
    </div>
  );
}

export { usePersona };


