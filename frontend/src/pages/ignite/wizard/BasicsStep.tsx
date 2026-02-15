import React from 'react';
import type { IgniteWizardState } from './types';

type BasicsStepProps = {
  state: IgniteWizardState;
  clients: Array<{ id: string; name: string }>;
  clientsLoading?: boolean;
  onChange: (patch: Partial<IgniteWizardState>) => void;
  onNext: () => void;
};

const QUICK_TEMPLATES = [
  { id: 'exec-dinner', icon: 'fa-utensils', label: 'Executive Dinner (100p)' },
  { id: 'summit', icon: 'fa-presentation-screen', label: 'Summit Half-Day' },
  { id: 'roadshow', icon: 'fa-route', label: 'Roadshow Stop' },
];

export default function BasicsStep({ state, clients, clientsLoading = false, onChange, onNext }: BasicsStepProps) {
  return (
    <div className="max-w-4xl">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Step 1: Event Basics</h2>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Client</label>
              <select
                value={state.clientId}
                onChange={(e) => onChange({ clientId: e.target.value })}
                disabled={clientsLoading}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{clientsLoading ? 'Loading clients...' : 'Select client...'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Event Name</label>
              <input
                type="text"
                value={state.eventName}
                onChange={(e) => onChange({ eventName: e.target.value })}
                placeholder="Executive Dinner Q1 2024"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={state.location}
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="Chase Center"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Venue Address</label>
              <input
                type="text"
                value={state.venueAddress}
                onChange={(e) => onChange({ venueAddress: e.target.value })}
                placeholder="1 Warriors Way, San Francisco, CA"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
              <input
                type="text"
                value={state.city}
                onChange={(e) => onChange({ city: e.target.value })}
                placeholder="San Francisco"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Event Date</label>
              <input
                type="date"
                value={state.eventDate}
                onChange={(e) => onChange({ eventDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Start Time</label>
                <input
                  type="time"
                  value={state.startTime}
                  onChange={(e) => onChange({ startTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">End Time</label>
                <input
                  type="time"
                  value={state.endTime}
                  onChange={(e) => onChange({ endTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Headcount</label>
              <input
                type="number"
                value={state.headcount}
                onChange={(e) => onChange({ headcount: e.target.value })}
                placeholder="100"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">Primary driver for cost calculations</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Primary Sponsor</label>
              <input
                type="text"
                value={state.primarySponsor}
                onChange={(e) => onChange({ primarySponsor: e.target.value })}
                placeholder="Supermicro"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Co-Sponsors (comma separated)</label>
              <input
                type="text"
                value={state.coSponsors}
                onChange={(e) => onChange({ coSponsors: e.target.value })}
                placeholder="AMD, WEKA"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Event Objective</label>
              <textarea
                value={state.eventObjective}
                onChange={(e) => onChange({ eventObjective: e.target.value })}
                rows={3}
                placeholder="Summarize event objective in 1-2 sentences."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Success Criteria (one per line)</label>
              <textarea
                value={state.successCriteria}
                onChange={(e) => onChange({ successCriteria: e.target.value })}
                rows={3}
                placeholder={'Generate qualified exec meetings\nDrive on-site engagement'}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Model Type</label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="model"
                    value="cost-plus"
                    checked={state.modelType === 'cost-plus'}
                    onChange={() => onChange({ modelType: 'cost-plus' })}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700">Cost+ (Transparent pricing)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="model"
                    value="turnkey"
                    checked={state.modelType === 'turnkey'}
                    onChange={() => onChange({ modelType: 'turnkey' })}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700">Turnkey (Package pricing)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Number of Options</label>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                {[1, 2, 3].map((count) => (
                  <label key={count} className="flex items-center">
                    <input
                      type="radio"
                      name="options"
                      value={count}
                      checked={state.optionsCount === count}
                      onChange={() => onChange({ optionsCount: count as 1 | 2 | 3 })}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-gray-700">{count} Option{count > 1 ? 's' : ''}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-blue-900">Quick Start Templates</h3>
              <div className="space-y-2">
                {QUICK_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onChange({ quickTemplate: template.id })}
                    className={`block w-full rounded px-3 py-2 text-left text-sm ${
                      state.quickTemplate === template.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <i className={`fa-solid ${template.icon} mr-2`} />
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled
            className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-arrow-left mr-2" />
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Continue to Assumptions
            <i className="fa-solid fa-arrow-right ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

