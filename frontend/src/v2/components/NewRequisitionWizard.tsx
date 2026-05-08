/**
 * v2 — NewRequisitionWizard
 *
 * 3-step wizard for creating a job requisition without leaving v2.
 * Replaces the bounce to legacy /jobs/create from Pipelines.
 *
 *   Step 1 · Role basics   — title, department, location, status
 *   Step 2 · Job details   — description (REX-assist hook later), salary range
 *   Step 3 · Confirm       — review + create
 *
 * Submits to POST /api/jobs/create (existing endpoint). On success,
 * fires onCreated with { id, title } so the parent can navigate or
 * refetch.
 */

import React, { useState } from 'react';
import { apiPost } from '../../lib/api';
import V2Modal, { ModalCancel, ModalPrimary } from './V2Modal';
import { toastSoon, toastSuccess } from './V2Toast';

type Step = 1 | 2 | 3;

interface Form {
  title: string;
  department: string;
  location: string;
  status: 'open' | 'on_hold' | 'closed';
  description: string;
  salary_min: string;
  salary_max: string;
}

const EMPTY: Form = {
  title: '',
  department: '',
  location: '',
  status: 'open',
  description: '',
  salary_min: '',
  salary_max: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (job: { id: string; title: string }) => void;
}

export default function NewRequisitionWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setForm(EMPTY);
    setSubmitting(false);
    setError(null);
  };
  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const setField = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const canStep1 = form.title.trim().length > 1;
  const canStep2 = true; // description optional

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        title: form.title.trim(),
        department: form.department.trim() || null,
        location: form.location.trim() || null,
        status: form.status,
        description: form.description.trim() || null,
      };
      if (form.salary_min || form.salary_max) {
        payload.salary_range = `${form.salary_min || '?'} – ${form.salary_max || '?'}`;
      }
      const resp = await apiPost('/api/jobs/create', payload);
      const id = resp?.jobId || resp?.job?.id;
      const title = resp?.job?.title || form.title;
      toastSuccess(`Created "${title}"`);
      onCreated?.({ id, title });
      reset();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to create requisition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <V2Modal
      open={open}
      onClose={handleClose}
      title="New requisition"
      subtitle={`Step ${step} of 3 — ${step === 1 ? 'Role basics' : step === 2 ? 'Job details' : 'Review & create'}`}
      icon="briefcase"
      size="lg"
      footer={
        <>
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              className="btn-outline"
              disabled={submitting}
            >
              <i className="fa-solid fa-arrow-left text-[10px]" />
              Back
            </button>
          ) : (
            <ModalCancel onClick={handleClose} />
          )}
          {step < 3 && (
            <ModalPrimary
              onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : s))}
              disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2)}
              label="Next"
              icon="arrow-right"
            />
          )}
          {step === 3 && (
            <ModalPrimary
              onClick={submit}
              loading={submitting}
              disabled={!canStep1}
              label={submitting ? 'Creating…' : 'Create requisition'}
              icon="check"
            />
          )}
        </>
      }
    >
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-5 text-[11.5px]">
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
                step === n
                  ? 'bg-primary/10 text-primary'
                  : step > n
                  ? 'bg-success/10 text-success'
                  : 'bg-surface text-text-muted'
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                style={{
                  background: step >= n ? (step === n ? '#6B46C1' : '#10B981') : '#9CA3AF',
                }}
              >
                {step > n ? <i className="fa-solid fa-check text-[8px]" /> : n}
              </span>
              {n === 1 ? 'Basics' : n === 2 ? 'Details' : 'Review'}
            </div>
            {n < 3 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step bodies */}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="Job title" required>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Senior Backend Engineer"
              className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <input
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
                placeholder="Engineering"
                className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
              />
            </Field>
            <Field label="Location">
              <input
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="Remote · US"
                className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
              />
            </Field>
          </div>
          <Field label="Status">
            <div className="flex gap-1.5">
              {([
                { v: 'open', label: 'Open' },
                { v: 'on_hold', label: 'On hold' },
                { v: 'closed', label: 'Closed' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setField('status', opt.v)}
                  className={`btn-outline !px-3 ${form.status === opt.v ? 'border-primary text-primary bg-primary/8 font-semibold' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Field
            label="Job description"
            hint="Paste your JD or write a quick brief. REX uses this when drafting outreach."
            action={
              <button
                onClick={() => toastSoon('REX-assist JD writer')}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[9px] mr-0.5" />
                Draft with REX
              </button>
            }
          >
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={6}
              placeholder="What you're looking for, the team, must-haves, comp range, etc."
              className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Salary range (USD)">
            <div className="flex items-center gap-2">
              <input
                value={form.salary_min}
                onChange={(e) => setField('salary_min', e.target.value)}
                placeholder="Min"
                inputMode="numeric"
                className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
              />
              <span className="text-text-muted text-[12px]">to</span>
              <input
                value={form.salary_max}
                onChange={(e) => setField('salary_max', e.target.value)}
                placeholder="Max"
                inputMode="numeric"
                className="w-full bg-surface border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-primary"
              />
            </div>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 text-[13px]">
          <div className="rounded-xl bg-surface/60 p-4 space-y-2.5">
            <ReviewRow label="Title" value={form.title} />
            <ReviewRow label="Department" value={form.department || '—'} />
            <ReviewRow label="Location" value={form.location || '—'} />
            <ReviewRow label="Status" value={form.status === 'on_hold' ? 'On hold' : form.status === 'closed' ? 'Closed' : 'Open'} />
            <ReviewRow
              label="Salary range"
              value={form.salary_min || form.salary_max ? `${form.salary_min || '?'} – ${form.salary_max || '?'}` : '—'}
            />
            <ReviewRow
              label="Description"
              value={form.description ? `${form.description.slice(0, 120)}${form.description.length > 120 ? '…' : ''}` : '—'}
            />
          </div>
          <div
            className="rounded-xl p-3 flex items-start gap-3 text-[12.5px]"
            style={{
              background: 'linear-gradient(90deg, rgba(107,70,193,.05), rgba(12,92,244,.03))',
              border: '1px solid rgba(107,70,193,.12)',
            }}
          >
            <i className="fa-solid fa-wand-magic-sparkles text-primary mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">Pipeline + default stages will be created.</div>
              <p className="text-text-secondary">
                We'll spin up the pipeline with the default stages (New → Phone Screen →
                Onsite → Offer) so you can start adding candidates immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-danger mt-3">
          <i className="fa-solid fa-circle-exclamation mr-1" />
          {error}
        </p>
      )}
    </V2Modal>
  );
}

/* -- Tiny field helpers ---------------------------------------------- */
function Field({
  label,
  hint,
  required,
  action,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold flex items-center gap-1">
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
        {action}
      </div>
      {children}
      {hint && <div className="text-[10.5px] text-text-muted mt-1.5">{hint}</div>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-text-muted text-[11.5px] uppercase tracking-wider font-bold w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="flex-1 text-text-main break-words">{value}</span>
    </div>
  );
}
