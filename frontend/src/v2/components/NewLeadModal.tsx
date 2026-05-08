/**
 * v2 — NewLeadModal
 *
 * Quick-add lead/candidate form. Replaces the bounce from Leads.tsx
 * "New lead" button to legacy /leads page. POSTs to existing
 * /api/leads/candidates endpoint.
 */

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import V2Modal, { ModalCancel, ModalPrimary } from './V2Modal';
import { toastSuccess } from './V2Toast';

interface Form {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  title: string;
  linkedin_url: string;
}

const EMPTY: Form = {
  first_name: '',
  last_name: '',
  email: '',
  company: '',
  title: '',
  linkedin_url: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (lead: { id: string }) => void;
}

const inputCls = 'w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary';

export default function NewLeadModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = !!(form.first_name.trim() || form.email.trim() || form.linkedin_url.trim());

  const reset = () => {
    setForm(EMPTY);
    setSubmitting(false);
    setError(null);
  };
  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        title: form.title.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
      };
      const resp = await apiPost('/api/leads/candidates', payload);
      const id = resp?.id || resp?.candidate?.id || resp?.lead?.id;
      toastSuccess('Lead added');
      onCreated?.({ id });
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <V2Modal
      open={open}
      onClose={handleClose}
      title="Add a lead"
      subtitle="Quick add — REX will enrich + score in the background."
      icon="user-plus"
      footer={
        <>
          <ModalCancel onClick={handleClose} />
          <ModalPrimary
            onClick={submit}
            disabled={!canSubmit}
            loading={submitting}
            label={submitting ? 'Adding…' : 'Add lead'}
            icon="plus"
          />
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              autoFocus
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              placeholder="Sarah"
              className={inputCls}
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              placeholder="Chen"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Email">
          <input
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            type="email"
            placeholder="sarah.chen@stripe.com"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <input
              value={form.company}
              onChange={(e) => setField('company', e.target.value)}
              placeholder="Stripe"
              className={inputCls}
            />
          </Field>
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Senior Backend Engineer"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="LinkedIn URL" hint="REX uses this to enrich + score the lead.">
          <input
            value={form.linkedin_url}
            onChange={(e) => setField('linkedin_url', e.target.value)}
            placeholder="https://linkedin.com/in/sarahchen"
            className={inputCls}
          />
        </Field>

        {error && (
          <p className="text-[12px] text-danger">
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {error}
          </p>
        )}
      </div>
    </V2Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-semibold mb-1.5 block">{label}</label>
      {children}
      {hint && <div className="text-[10.5px] text-text-muted mt-1.5">{hint}</div>}
    </div>
  );
}
