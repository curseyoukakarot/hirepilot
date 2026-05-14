import React from 'react';
import { SponsorKind, SponsorStatus, formatMoney } from '../mockData';
import { EventWizardState, WizardSponsor } from './types';

type Props = {
  state: EventWizardState;
  onChange: (patch: Partial<EventWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
};

const STATUS_OPTIONS: SponsorStatus[] = ['prospect', 'committed', 'invoiced', 'paid'];

const STATUS_BADGE: Record<SponsorStatus, string> = {
  prospect: 'bg-gray-100 text-gray-700 border-gray-200',
  committed: 'bg-blue-50 text-blue-700 border-blue-200',
  invoiced: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function newSponsor(): WizardSponsor {
  return {
    id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    kind: 'cash',
    amount: '',
    status: 'prospect',
  };
}

export default function EventSponsorsStep({ state, onChange, onBack, onNext }: Props) {
  const updateSponsor = (id: string, patch: Partial<WizardSponsor>) => {
    onChange({
      sponsors: state.sponsors.map((sponsor) =>
        sponsor.id === id ? { ...sponsor, ...patch } : sponsor
      ),
    });
  };

  const removeSponsor = (id: string) => {
    onChange({ sponsors: state.sponsors.filter((sponsor) => sponsor.id !== id) });
  };

  const addSponsor = (kind: SponsorKind = 'cash') => {
    onChange({ sponsors: [...state.sponsors, { ...newSponsor(), kind }] });
  };

  const cashTotal = state.sponsors
    .filter((sponsor) => sponsor.kind === 'cash')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);
  const inKindTotal = state.sponsors
    .filter((sponsor) => sponsor.kind === 'in_kind')
    .reduce((sum, sponsor) => sum + Number(sponsor.amount || 0), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sponsors &amp; Revenue</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Add cash sponsorships and in-kind contributions. We'll roll them into the margin model.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addSponsor('cash')}
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <i className="fa-solid fa-plus mr-2" /> Cash sponsor
            </button>
            <button
              type="button"
              onClick={() => addSponsor('in_kind')}
              className="inline-flex items-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
            >
              <i className="fa-solid fa-handshake mr-2" /> In-kind sponsor
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryStat label="Cash committed/paid" value={formatMoney(cashTotal)} accent="emerald" />
          <SummaryStat label="In-kind value" value={formatMoney(inKindTotal)} accent="cyan" />
          <SummaryStat label="Sponsors total" value={String(state.sponsors.length)} accent="blue" />
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Sponsor</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {state.sponsors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    No sponsors yet. Add your first one above.
                  </td>
                </tr>
              )}
              {state.sponsors.map((sponsor) => (
                <tr key={sponsor.id} className="hover:bg-gray-50/60">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={sponsor.name}
                      onChange={(e) => updateSponsor(sponsor.id, { name: e.target.value })}
                      placeholder="e.g. AMD + SMC"
                      className="w-44 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={sponsor.kind}
                      onChange={(e) =>
                        updateSponsor(sponsor.id, { kind: e.target.value as SponsorKind })
                      }
                      className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="in_kind">In-kind</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={sponsor.amount}
                      onChange={(e) => updateSponsor(sponsor.id, { amount: e.target.value })}
                      placeholder="0"
                      className="w-28 rounded-md border border-gray-200 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={sponsor.status}
                      onChange={(e) =>
                        updateSponsor(sponsor.id, { status: e.target.value as SponsorStatus })
                      }
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${STATUS_BADGE[sponsor.status]}`}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={sponsor.notes || ''}
                      onChange={(e) => updateSponsor(sponsor.id, { notes: e.target.value })}
                      placeholder="Referral, payment terms..."
                      className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeSponsor(sponsor.id)}
                      className="text-gray-400 hover:text-rose-500"
                      title="Remove sponsor"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Next: Cost Plan <i className="fa-solid fa-arrow-right ml-2" />
        </button>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'emerald' | 'cyan' | 'blue';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : accent === 'cyan'
      ? 'text-cyan-700 bg-cyan-50 border-cyan-100'
      : 'text-blue-700 bg-blue-50 border-blue-100';
  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
