import React, { useEffect, useMemo, useState } from 'react';
import { FaPlus, FaTrash, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function SequenceBuilderModal({ isOpen, onClose, initialSequence, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stopOnReply, setStopOnReply] = useState(true);
  const [sendWindowStart, setSendWindowStart] = useState('');
  const [sendWindowEnd, setSendWindowEnd] = useState('');
  const [throttlePerHour, setThrottlePerHour] = useState('');
  const [steps, setSteps] = useState([{ step_order: 1, subject: '', body: '', delay_days: 0, delay_hours: 0, send_only_business_days: false }]);
  const [previewStart, setPreviewStart] = useState(new Date());
  const [timezone, setTimezone] = useState('America/Chicago');

  useEffect(() => {
    if (initialSequence) {
      setName(initialSequence.sequence?.name || initialSequence.name || '');
      setDescription(initialSequence.sequence?.description || initialSequence.description || '');
      setStopOnReply(Boolean(initialSequence.sequence?.stop_on_reply ?? initialSequence.stop_on_reply ?? true));
      setSendWindowStart(initialSequence.sequence?.send_window_start || initialSequence.send_window_start || '');
      setSendWindowEnd(initialSequence.sequence?.send_window_end || initialSequence.send_window_end || '');
      setThrottlePerHour(String(initialSequence.sequence?.throttle_per_hour ?? initialSequence.throttle_per_hour ?? ''));
      const loadedSteps = (initialSequence.steps || initialSequence.sequence?.steps || []).slice().sort((a,b) => a.step_order - b.step_order);
      if (loadedSteps.length) setSteps(loadedSteps.map(s => ({
        id: s.id,
        step_order: s.step_order,
        subject: s.subject || '',
        body: s.body || '',
        delay_days: s.delay_days || 0,
        delay_hours: s.delay_hours || 0,
        send_only_business_days: !!s.send_only_business_days
      })));
    }
  }, [initialSequence]);

  const addStep = () => {
    setSteps(prev => {
      const nextOrder = (prev[prev.length - 1]?.step_order || prev.length) + 1;
      return [...prev, { step_order: nextOrder, subject: '', body: '', delay_days: 0, delay_hours: 0, send_only_business_days: false }];
    });
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i2) => ({ ...s, step_order: i2 + 1 })));
  };

  const moveStep = (index, dir) => {
    setSteps(prev => {
      const arr = prev.slice();
      const swapWith = dir === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= arr.length) return prev;
      [arr[index], arr[swapWith]] = [arr[swapWith], arr[index]];
      return arr.map((s, i2) => ({ ...s, step_order: i2 + 1 }));
    });
  };

  const projectedTimes = useMemo(() => {
    try {
      const times = [];
      let base = new Date(previewStart);
      for (const s of steps) {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + Number(s.delay_days || 0));
        dt.setHours(dt.getHours() + Number(s.delay_hours || 0));
        // Basic business day adjust (Mon-Fri)
        if (s.send_only_business_days) {
          let wd = dt.getDay(); // 0=Sun..6=Sat
          if (wd === 0) dt.setDate(dt.getDate() + 1);
          if (wd === 6) dt.setDate(dt.getDate() + 2);
        }
        // Window clamp (local display only)
        if (sendWindowStart || sendWindowEnd) {
          const [sh, sm] = (sendWindowStart || '00:00').split(':').map(Number);
          const [eh, em] = (sendWindowEnd || '23:59').split(':').map(Number);
          const startClone = new Date(dt); startClone.setHours(sh || 0, sm || 0, 0, 0);
          const endClone = new Date(dt); endClone.setHours(eh || 23, em || 59, 59, 0);
          if (dt < startClone) dt.setTime(startClone.getTime());
          if (dt > endClone) { const nx = new Date(dt); nx.setDate(nx.getDate() + 1); nx.setHours(sh || 0, sm || 0, 0, 0); dt.setTime(nx.getTime()); }
        }
        times.push(dt);
        base = dt;
      }
      return times;
    } catch { return []; }
  }, [steps, previewStart, sendWindowStart, sendWindowEnd]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const payload = {
        name: name.trim(),
        description,
        stop_on_reply: stopOnReply,
        send_window_start: sendWindowStart || null,
        send_window_end: sendWindowEnd || null,
        throttle_per_hour: throttlePerHour ? Number(throttlePerHour) : null,
        steps
      };
      const method = initialSequence?.sequence?.id || initialSequence?.id ? 'PUT' : 'POST';
      const id = initialSequence?.sequence?.id || initialSequence?.id;
      const url = method === 'POST' ? `${API_BASE_URL}/sequences` : `${API_BASE_URL}/sequences/${id}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to save sequence');
      const data = await res.json();
      onSaved?.(data);
      toast.success(method === 'POST' ? 'Tiered Template created' : 'Tiered Template updated');
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Failed to save Tiered Template');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{initialSequence ? 'Edit Tiered Template' : 'New Tiered Template'}</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>×</button>
        </div>

        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Name</label>
            <input className="w-full border rounded-lg px-3 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. First touch + 2 follow-ups" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Throttle / hour (optional)</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2" value={throttlePerHour} onChange={e => setThrottlePerHour(e.target.value)} placeholder="e.g. 50" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Description</label>
            <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Internal notes" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Send Window Start (optional)</label>
            <input className="w-full border rounded-lg px-3 py-2" placeholder="HH:MM" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Send Window End (optional)</label>
            <input className="w-full border rounded-lg px-3 py-2" placeholder="HH:MM" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input id="stop-reply" type="checkbox" className="h-4 w-4" checked={stopOnReply} onChange={e => setStopOnReply(e.target.checked)} />
            <label htmlFor="stop-reply" className="text-sm text-gray-700">Stop on reply</label>
          </div>
        </div>

        {/* Steps editor */}
        <div className="space-y-3 mb-6">
          {steps.map((s, idx) => (
            <div key={idx} className="border rounded-xl p-4 shadow-sm bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Step {idx + 1}</div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => moveStep(idx, 'up')}><FaArrowUp /></button>
                  <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => moveStep(idx, 'down')}><FaArrowDown /></button>
                  <button className="px-2 py-1 border rounded text-red-600 hover:bg-red-50" onClick={() => removeStep(idx)}><FaTrash /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Subject (email)</label>
                  <input className="w-full border rounded-lg px-3 py-2" value={s.subject} onChange={e => setSteps(prev => prev.map((p,i) => i===idx ? { ...p, subject: e.target.value } : p))} placeholder="Optional subject" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Delay days</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={s.delay_days} onChange={e => setSteps(prev => prev.map((p,i) => i===idx ? { ...p, delay_days: Number(e.target.value||0) } : p))} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Delay hours</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2" value={s.delay_hours} onChange={e => setSteps(prev => prev.map((p,i) => i===idx ? { ...p, delay_hours: Number(e.target.value||0) } : p))} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">Body</label>
                  <textarea className="w-full border rounded-lg px-3 py-2" rows={4} value={s.body} onChange={e => setSteps(prev => prev.map((p,i) => i===idx ? { ...p, body: e.target.value } : p))} placeholder="Use {{first_name}}, {{company}}, etc." />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input id={`biz-${idx}`} type="checkbox" className="h-4 w-4" checked={s.send_only_business_days} onChange={e => setSteps(prev => prev.map((p,i) => i===idx ? { ...p, send_only_business_days: e.target.checked } : p))} />
                  <label htmlFor={`biz-${idx}`} className="text-sm text-gray-700">Business days only</label>
                </div>
              </div>
            </div>
          ))}
          <button className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50" onClick={addStep}><FaPlus /> Add Step</button>
        </div>

        {/* Preview */}
        <div className="mb-6 border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Start date/time</label>
              <DatePicker selected={previewStart} onChange={setPreviewStart} showTimeSelect timeIntervals={15} dateFormat="MMM d, yyyy h:mm aa" className="border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Timezone</label>
              <select className="border rounded px-3 py-2" value={timezone} onChange={e => setTimezone(e.target.value)}>
                <option value="America/Chicago">America/Chicago</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {projectedTimes.map((dt, i) => (
              <div key={i} className="text-sm text-gray-700">Step {i+1}: {dt.toLocaleString()} ({timezone})</div>
            ))}
            {projectedTimes.length === 0 && (<div className="text-sm text-gray-500">Add steps to see the preview</div>)}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}


