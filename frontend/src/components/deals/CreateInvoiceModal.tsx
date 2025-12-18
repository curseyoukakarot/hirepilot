import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface InvoiceOppLite {
  id: string;
  title: string;
  client?: { id?: string; name?: string };
}

export interface CreateInvoiceModalProps {
  open: boolean;
  opportunities: InvoiceOppLite[];
  defaultOpportunityId?: string;
  defaultBillingType?: 'contingency' | 'retainer' | 'down_payment' | 'rpo' | 'staffing';
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ open, opportunities, defaultOpportunityId, defaultBillingType = 'contingency', onClose, onCreated }) => {
  const [opportunityId, setOpportunityId] = useState<string>('');
  const [billingType, setBillingType] = useState<'contingency'|'retainer'|'down_payment'|'rpo'|'staffing'>(defaultBillingType);
  const [recipient, setRecipient] = useState('');
  const [fields, setFields] = useState<any>({ salary: '', percent: '20', flat_fee: '', monthly: '', hours: '', hourly_rate: '' });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setOpportunityId(defaultOpportunityId || '');
      setBillingType(defaultBillingType);
      setRecipient('');
      setFields({ salary: '', percent: '20', flat_fee: '', monthly: '', hours: '', hourly_rate: '' });
      setNotes('');
      setSubmitting(false);
    }
  }, [open, defaultOpportunityId, defaultBillingType]);

  const total = useMemo(() => {
    if (billingType === 'contingency') {
      const salary = Number(String(fields.salary || '').replace(/[^0-9.]/g,'')) || 0;
      const pct = Number(fields.percent || 20);
      return Math.max(0, Math.round(salary * (pct/100)));
    }
    if (billingType === 'retainer') {
      return Math.max(0, Number(String(fields.flat_fee || '').replace(/[^0-9.]/g,'')) || 0);
    }
    if (billingType === 'down_payment') {
      return Math.max(0, Number(String(fields.flat_fee || '').replace(/[^0-9.]/g,'')) || 0);
    }
    if (billingType === 'rpo') {
      return Math.max(0, Number(String(fields.monthly || '').replace(/[^0-9.]/g,'')) || 0);
    }
    if (billingType === 'staffing') {
      const hrs = Number(String(fields.hours || '').replace(/[^0-9.]/g,'')) || 0;
      const rate = Number(String(fields.hourly_rate || '').replace(/[^0-9.]/g,'')) || 0;
      return Math.max(0, Math.round(hrs * rate));
    }
    return 0;
  }, [billingType, fields]);

  const handleCreate = async () => {
    if (!opportunityId || submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          billing_type: billingType,
          fields,
          recipient_email: recipient || undefined,
          notes: notes || undefined,
        })
      });
      if (!resp.ok) {
        try { console.warn('invoice create failed', await resp.json()); } catch {}
        throw new Error('Failed');
      }
      await onCreated();
      onClose();
    } finally { setSubmitting(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Create Invoice</h2>
          <button className="text-gray-500" onClick={onClose}>✕</button>
        </div>
        <div className="p-6 space-y-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Opportunity</label>
              <select className="w-full border rounded-md p-2 text-sm" value={opportunityId} onChange={e=>setOpportunityId(e.target.value)}>
                <option value="">Select opportunity…</option>
                {opportunities.map(o => (<option key={o.id} value={o.id}>{o.title}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Billing Type</label>
              <select className="w-full border rounded-md p-2 text-sm" value={billingType} onChange={e=>setBillingType(e.target.value as any)}>
                <option value="contingency">Contingency</option>
                <option value="retainer">Retained Search</option>
                <option value="down_payment">Down Payment</option>
                <option value="rpo">RPO (Monthly)</option>
                <option value="staffing">Staffing (Hourly)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Recipient Email</label>
              <input className="w-full border rounded-md p-2 text-sm" placeholder="billing@client.com" value={recipient} onChange={e=>setRecipient(e.target.value)} />
            </div>
          </div>

          {billingType === 'contingency' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placement Salary</label>
                <input className="pl-3 pr-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.salary} onChange={e=>setFields((p:any)=>({ ...p, salary: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee Percentage</label>
                <input type="number" className="pr-3 pl-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.percent} onChange={e=>setFields((p:any)=>({ ...p, percent: e.target.value }))} />
              </div>
            </div>
          )}

          {billingType === 'retainer' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retainer Amount</label>
                <input className="pl-3 pr-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.flat_fee} onChange={e=>setFields((p:any)=>({ ...p, flat_fee: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className="p-2 text-sm bg-white border rounded-md w-full" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>
          )}

          {billingType === 'down_payment' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment Amount</label>
                <input className="pl-3 pr-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.flat_fee} onChange={e=>setFields((p:any)=>({ ...p, flat_fee: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className="p-2 text-sm bg-white border rounded-md w-full" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>
          )}

          {billingType === 'rpo' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee</label>
                <input className="pl-3 pr-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.monthly} onChange={e=>setFields((p:any)=>({ ...p, monthly: e.target.value }))} />
              </div>
            </div>
          )}

          {billingType === 'staffing' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Bill Rate</label>
                <input type="number" className="pl-3 pr-3 py-2 text-sm bg-white border rounded-md w-full" value={fields.hourly_rate} onChange={e=>setFields((p:any)=>({ ...p, hourly_rate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
                <input type="number" className="p-2 text-sm bg-white border rounded-md w-full" value={fields.hours} onChange={e=>setFields((p:any)=>({ ...p, hours: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-4 flex justify-between items-center border">
            <div>
              <p className="text-sm text-gray-600">Invoice Total</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-gray-100 border-t rounded-b-xl flex justify-end gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-md" onClick={onClose}>Cancel</button>
          <button className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md disabled:opacity-60" disabled={!opportunityId || submitting} onClick={handleCreate}>
            {submitting ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CreateInvoiceModal);


