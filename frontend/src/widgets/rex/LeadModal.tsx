import React, { useMemo, useState } from 'react';
import type { RexLeadInterest, RexLeadPayload } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RexLeadPayload) => Promise<any> | void;
};

export const LeadModal: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const rb2b = (typeof window !== 'undefined' ? (window as any).rb2b : null) ?? null;
  const prefillCompany = rb2b?.company?.name || '';
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [company, setCompany] = useState(prefillCompany);
  const [interest, setInterest] = useState<RexLeadInterest | ''>('');
  const [notes, setNotes] = useState('');
  const [consentEmail, setConsentEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = fullName.trim() && workEmail.trim();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">Share your details</div>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Full name<span className="text-red-500">*</span></label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Work email<span className="text-red-500">*</span></label>
            <input value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="jane@company.com" />
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
              I consent to prefill my email if detected on this device.
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Acme Inc." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Interest</label>
            <select value={interest} onChange={(e) => setInterest(e.target.value as any)} className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">Select…</option>
              <option value="Recruiting">Recruiting</option>
              <option value="Sourcing">Sourcing</option>
              <option value="Pricing">Pricing</option>
              <option value="Demo">Demo</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none" rows={3} placeholder="Anything specific we should know?" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-gray-50 px-4 py-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100">Cancel</button>
          <button
            onClick={async () => {
              if (!canSubmit || submitting) return;
              setSubmitting(true);
              try {
                await onSubmit({ full_name: fullName, work_email: workEmail, company, interest: (interest || undefined) as any, notes: notes || undefined, consentEmail });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadModal;


