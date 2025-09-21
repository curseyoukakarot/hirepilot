import React, { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';

interface AddOpportunityModalProps {
  open: boolean;
  clients: Array<{ id: string; name?: string; domain?: string }>;
  onClose: () => void;
  onCreated: () => void;
}

function AddOpportunityModal({ open, clients, onClose, onCreated }: AddOpportunityModalProps) {
  const [title, setTitle] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [billingType, setBillingType] = useState<string>('');
  const [stage, setStage] = useState<string>('Pipeline');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = useCallback(async () => {
    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title, client_id: clientId, value: Number(value)||0, billing_type: billingType, stage })
      });
      if (resp.ok) {
        toast.success('Opportunity created');
        try {
          const amount = Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/sendSlackNotification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'opportunity_created',
              details: { title, amount, billing_type: billingType, stage },
            })
          });
        } catch {}
        onCreated();
      } else {
        toast.error('Failed to create opportunity');
      }
      onClose();
      setTitle(''); setClientId(''); setValue(''); setBillingType(''); setStage('Pipeline');
    } finally {
      setSubmitting(false);
    }
  }, [title, clientId, value, billingType, stage, onCreated, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Add Opportunity</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Opportunity Name</label>
            <input className="w-full border rounded-md px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. VP of Sales Search" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Client</label>
            <select className="w-full border rounded-md px-3 py-2" value={clientId} onChange={e=>setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.domain || c.id.slice(0,6)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Value (USD)</label>
              <input className="w-full border rounded-md px-3 py-2" value={value} onChange={e=>setValue(e.target.value)} placeholder="e.g. 50000" />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Revenue Type</label>
              <select className="w-full border rounded-md px-3 py-2" value={billingType} onChange={e=>setBillingType(e.target.value)}>
                <option value="">Select…</option>
                <option value="contingency">Contingency</option>
                <option value="retainer">Retained Search</option>
                <option value="rpo">RPO (Monthly)</option>
                <option value="staffing">Staffing (Hourly)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Starting Stage</label>
            <select className="w-full border rounded-md px-3 py-2" value={stage} onChange={e=>setStage(e.target.value)}>
              <option>Pipeline</option>
              <option>Best Case</option>
              <option>Commit</option>
              <option>Close Won</option>
              <option>Closed Lost</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-md border" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60" disabled={submitting || !title || !clientId} onClick={handleCreate}>{submitting ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(AddOpportunityModal);


