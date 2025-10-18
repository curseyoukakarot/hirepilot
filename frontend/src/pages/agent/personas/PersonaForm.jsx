import React, { useEffect, useState } from 'react';
import { createPersona, updatePersona } from '../../../lib/api/personas';

function TagInput({ label, values, onChange, placeholder, inputId }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...(values || []), v]);
    setInput('');
  };
  const remove = (idx) => {
    const next = [...(values || [])];
    next.splice(idx, 1);
    onChange(next);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {(values || []).map((v, idx) => (
          <span key={idx} className="inline-flex items-center bg-slate-700 text-slate-200 px-2 py-1 rounded-full text-xs">
            {v}
            <button className="ml-2 text-slate-300 hover:text-white" onClick={() => remove(idx)}>×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input id={inputId} className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500" value={input} onChange={(e)=>setInput(e.target.value)} placeholder={placeholder} onKeyDown={(e)=>{ if (e.key==='Enter'){ e.preventDefault(); add(); } }} />
        <button type="button" className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export default function PersonaForm({ open, onClose, initial }) {
  const [name, setName] = useState('');
  const [titles, setTitles] = useState([]);
  const [includeKeywords, setIncludeKeywords] = useState([]);
  const [excludeKeywords, setExcludeKeywords] = useState([]);
  const [locations, setLocations] = useState([]);
  const [channels, setChannels] = useState(['email']);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name || '');
      setTitles(initial.titles || []);
      setIncludeKeywords(initial.include_keywords || []);
      setExcludeKeywords(initial.exclude_keywords || []);
      setLocations(initial.locations || []);
      setChannels(initial.channels || []);
      setGoal(initial.goal_total_leads || '');
    } else {
      setName(''); setTitles([]); setIncludeKeywords([]); setExcludeKeywords([]); setLocations([]); setChannels(['email']); setGoal('');
    }
  }, [open, initial]);

  if (!open) return null;

  const onSubmit = async (e) => {
    e.preventDefault();
    // Autoflush pending input in Titles if user typed but didn't press Add/Enter
    const pendingTitleEl = document.getElementById('persona-titles-input');
    const pendingTitle = pendingTitleEl && typeof pendingTitleEl.value === 'string' ? pendingTitleEl.value.trim() : '';
    const finalTitles = (titles && titles.length > 0) ? titles : (pendingTitle ? [pendingTitle] : []);
    if (!name.trim() || finalTitles.length === 0) {
      alert('Name and at least one title are required');
      return;
    }
    const body = {
      name: name.trim(),
      titles: finalTitles,
      include_keywords: includeKeywords,
      exclude_keywords: excludeKeywords,
      locations,
      channels,
      goal_total_leads: goal ? Number(goal) : null
    };
    try {
      setSaving(true);
      if (initial?.id) await updatePersona(initial.id, body); else await createPersona(body);
      alert('Persona saved successfully.');
      onClose(true);
    } catch (err) {
      alert('Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={()=>onClose(false)} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{initial ? 'Edit Persona' : 'Create Persona'}</h3>
          <button className="text-slate-300 hover:text-white" onClick={()=>onClose(false)}>✕</button>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Persona Name</label>
            <input className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500" value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Senior AE Persona" />
          </div>
          <TagInput label="Titles / Roles" values={titles} onChange={setTitles} placeholder="Add a title then press Enter" inputId="persona-titles-input" />
          <TagInput label="Include Keywords" values={includeKeywords} onChange={setIncludeKeywords} placeholder="Add a keyword then press Enter" />
          <TagInput label="Exclude Keywords" values={excludeKeywords} onChange={setExcludeKeywords} placeholder="Add a keyword then press Enter" />
          <TagInput label="Locations" values={locations} onChange={setLocations} placeholder="Add a location then press Enter" />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Channels</label>
            <div className="flex gap-4 text-slate-200">
              {['email','linkedin'].map((c) => (
                <label key={c} className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={channels.includes(c)} onChange={(e)=>{ const on = e.target.checked; setChannels(on ? Array.from(new Set([...(channels||[]), c])) : (channels||[]).filter(x=>x!==c)); }} /> {c}</label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Goal Number (optional)</label>
            <input type="number" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500" value={goal} onChange={(e)=>setGoal(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white" onClick={()=>onClose(false)}>Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


