import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface DealLogActivityModalProps {
  entityType: 'client' | 'decision_maker' | 'opportunity';
  entityId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DealLogActivityModal({ entityType, entityId, onClose, onSaved }: DealLogActivityModalProps) {
  const [type, setType] = useState<'call'|'email'|'meeting'|'note'|'task'|'update'>('note');
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0,16));
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const types = ['call','email','meeting','note','task','update'] as const;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      // Mirror existing leads activity API to avoid CORS nuances on new route
      let url = '';
      let payload: any = {};
      if (entityType === 'client') {
        // For client, log against its primary decision maker lead if present; otherwise, create a client note via lead activities isn't possible.
        // Expect caller to pass decision_maker id when available; fallback to note-only not supported here.
      }
      if (entityType === 'decision_maker') {
        url = `${import.meta.env.VITE_BACKEND_URL}/api/lead-activities`;
        payload = { lead_id: entityId, activity_type: type === 'note' ? 'Note' : type[0].toUpperCase()+type.slice(1), tags: [], notes: body || title || null, activity_timestamp: new Date(occurredAt).toISOString() };
      } else if (entityType === 'opportunity') {
        // keep using deals route for opportunities
        url = `${import.meta.env.VITE_BACKEND_URL}/api/deals/activity`;
        payload = { links: [{ entityType, entityId }], type, title: title || undefined, body: body || undefined, occurredAt: new Date(occurredAt).toISOString() };
      } else {
        // default to deals route
        url = `${import.meta.env.VITE_BACKEND_URL}/api/deals/activity`;
        payload = { links: [{ entityType, entityId }], type, title: title || undefined, body: body || undefined, occurredAt: new Date(occurredAt).toISOString() };
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Cache-Control': 'no-store', ...(token?{ Authorization: `Bearer ${token}` }:{}) },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(()=> '');
        throw new Error(text || `Failed to save (${resp.status})`);
      }
      onSaved && onSaved();
      onClose();
    } catch (e) {
      // Minimal inline alert; unify later with toast system
      alert(String(e instanceof Error ? e.message : e));
    } finally { setSaving(false); }
  };

  const stop = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={stop}>
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Log Activity</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Activity Type</label>
            <select className="w-full border rounded px-3 py-2" value={type} onChange={e=>setType(e.target.value as any)} disabled={saving}>
              {types.map(t=> (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Date & Time</label>
            <input type="datetime-local" className="w-full border rounded px-3 py-2" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm mb-1">Title (optional)</label>
            <input className="w-full border rounded px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea rows={4} className="w-full border rounded px-3 py-2" value={body} onChange={e=>setBody(e.target.value)} disabled={saving} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-2 border rounded" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white" disabled={saving}>{saving?'Saving…':'Save Log'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


