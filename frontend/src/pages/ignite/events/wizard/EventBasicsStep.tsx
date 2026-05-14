import React from 'react';
import { EventWizardState } from './types';

type Props = {
  state: EventWizardState;
  onChange: (patch: Partial<EventWizardState>) => void;
  onNext: () => void;
};

export default function EventBasicsStep({ state, onChange, onNext }: Props) {
  return (
    <div className="space-y-6">
      <Card title="Event type">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <KindCard
            active={state.kind === 'internal'}
            title="Internal Event"
            description="We host. We bring in sponsors to fund it. Track sponsor revenue vs cost to compute net margin."
            icon="fa-building-flag"
            onClick={() => onChange({ kind: 'internal' })}
          />
          <KindCard
            active={state.kind === 'external'}
            title="Client / External Event"
            description="A client pays us to produce. Track scope, billable + pass-through costs, and your gross margin."
            icon="fa-handshake-angle"
            onClick={() => onChange({ kind: 'external' })}
          />
        </div>
      </Card>

      <Card title="Event basics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Event name" required>
            <input
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. AI Infra Summit 5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          {state.kind === 'external' && (
            <Field label="Client name" required>
              <input
                type="text"
                value={state.clientName}
                onChange={(e) => onChange({ clientName: e.target.value })}
                placeholder="e.g. ACME Cloud"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </Field>
          )}
          <Field label="Event owner">
            <input
              type="text"
              value={state.ownerName}
              onChange={(e) => onChange({ ownerName: e.target.value })}
              placeholder="Internal lead at Ignite"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Primary contact">
            <input
              type="text"
              value={state.primaryContact}
              onChange={(e) => onChange({ primaryContact: e.target.value })}
              placeholder="External or internal main POC"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Start date" required>
            <input
              type="date"
              value={state.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={state.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="City" required>
            <input
              type="text"
              value={state.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="e.g. Sunnyvale, CA"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Venue" required>
            <input
              type="text"
              value={state.venue}
              onChange={(e) => onChange({ venue: e.target.value })}
              placeholder="e.g. Plug and Play Tech Center"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Headcount">
            <input
              type="number"
              value={state.headcount}
              onChange={(e) => onChange({ headcount: e.target.value })}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Target margin %">
            <input
              type="number"
              value={state.targetMarginPct}
              onChange={(e) => onChange({ targetMarginPct: e.target.value })}
              placeholder="20"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                value={state.description}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={3}
                placeholder="Internal notes, anchor sponsor, audience..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Next: Sponsors &amp; Revenue
          <i className="fa-solid fa-arrow-right ml-2" />
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function KindCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition-all ${
        active
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <i className={`fa-solid ${icon}`} />
        </div>
        <p className="text-base font-semibold text-gray-900">{title}</p>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}
