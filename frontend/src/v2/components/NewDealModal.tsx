/**
 * v2 — NewDealModal
 *
 * Quick "new deal" form. Replaces the toastSoon on Deals.tsx "New deal"
 * button. POSTs to /api/opportunities (existing endpoint).
 */

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import V2Modal, { ModalCancel, ModalPrimary } from './V2Modal';
import { toastSuccess } from './V2Toast';

interface Form {
  title: string;
  value: string;
  stage: string;
  forecast_date: string;
  tag: string;
}

const STAGES = ['Pipeline', 'Best Case', 'Commit', 'Close Won', 'Closed Lost'];

const EMPTY: Form = {
  title: '',
  value: '',
  stage: 'Pipeline',
  forecast_date: '',
  tag: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (deal: { id: string }) => void;
}

const inputCls = 'w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary';

export default function NewDealModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const canSubmit = form.title.trim().length > 1;

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
        title: form.title.trim(),
        stage: form.stage,
        tag: form.tag.trim() || null,
      };
      if (form.value) {
        const n = Number(form.value.replace(/[$,]/g, ''));
        if (!isNaN(n)) payload.value = n;
      }
      if (form.forecast_date) {
        payload.forecast_date = form.forecast_date.slice(0, 10);
      }
      const resp = await apiPost('/api/opportunities', payload);
      const id = resp?.id || resp?.opportunity?.id;
      toastSuccess(`Created deal "${form.title}"`);
      onCreated?.({ id });
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to create deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <V2Modal
      open={open}
      onClose={handleClose}
      title="New deal"
      subtitle="Add an opportunity to your pipeline."
      icon="handshake"
      footer={
        <>
          <ModalCancel onClick={handleClose} />
          <ModalPrimary
            onClick={submit}
            disabled={!canSubmit}
            loading={submitting}
            label={submitting ? 'Creating…' : 'Create deal'}
            icon="plus"
          />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Deal title" required>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Acme Corp — Q2 Senior Engineer search"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Value (USD)">
            <input
              value={form.value}
              onChange={(e) => setField('value', e.target.value)}
              placeholder="84,000"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          <Field label="Forecast date">
            <input
              type="date"
              value={form.forecast_date}
              onChange={(e) => setField('forecast_date', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Stage">
          <div className="flex gap-1.5 flex-wrap">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setField('stage', s)}
                className={`btn-outline !px-3 !text-[11.5px] ${
                  form.stage === s ? 'border-primary text-primary bg-primary/8 font-semibold' : ''
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tag" hint="Optional — e.g. retainer, contingency, RPO.">
          <input
            value={form.tag}
            onChange={(e) => setField('tag', e.target.value)}
            placeholder="retainer"
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

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-semibold mb-1.5 flex items-center gap-1">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && <div className="text-[10.5px] text-text-muted mt-1.5">{hint}</div>}
    </div>
  );
}
