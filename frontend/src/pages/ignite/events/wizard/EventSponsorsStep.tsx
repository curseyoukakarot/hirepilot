import React from 'react';
import { SponsorKind, SponsorStatus, formatMoney } from '../types';
import { EventWizardState, WizardSponsor } from './types';

type Props = {
  state: EventWizardState;
  onChange: (patch: Partial<EventWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
};

const STATUS_OPTIONS: SponsorStatus[] = ['prospect', 'committed', 'invoiced', 'paid'];

const STATUS_BADGE: Record<SponsorStatus, string> = {
  prospect: 'bg-white/5 text-gray-300 border-white/10',
  committed: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  invoiced: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const INPUT_BARE =
  'rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';
const INPUT_BASE =
  'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:bg-white/10 focus:outline-none';

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
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Sponsors &amp; Revenue</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Add cash sponsorships and in-kind contributions. We'll roll them into the margin model.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addSponsor('cash')}
              className="inline-flex items-center rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20"
            >
              <i className="fa-solid fa-plus mr-2" /> Cash sponsor
            </button>
            <button
              type="button"
              onClick={() => addSponsor('in_kind')}
              className="inline-flex items-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              <i className="fa-solid fa-handshake mr-2" /> In-kind sponsor
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryStat label="Cash committed/paid" value={formatMoney(cashTotal)} accent="emerald" />
          <SummaryStat label="In-kind value" value={formatMoney(inKindTotal)} accent="cyan" />
          <SummaryStat label="Sponsors total" value={String(state.sponsors.length)} accent="purple" />
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Sponsor</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.sponsors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    No sponsors yet. Add your first one above.
                  </td>
                </tr>
              )}
              {state.sponsors.map((sponsor) => (
                <tr key={sponsor.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={sponsor.name}
                      onChange={(e) => updateSponsor(sponsor.id, { name: e.target.value })}
                      placeholder="e.g. AMD + SMC"
                      className={`w-44 ${INPUT_BARE}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={sponsor.kind}
                      onChange={(e) =>
                        updateSponsor(sponsor.id, { kind: e.target.value as SponsorKind })
                      }
                      className={INPUT_BASE}
                    >
                      <option value="cash" className="bg-slate-900 text-white">Cash</option>
                      <option value="in_kind" className="bg-slate-900 text-white">In-kind</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={sponsor.amount}
                      onChange={(e) => updateSponsor(sponsor.id, { amount: e.target.value })}
                      placeholder="0"
                      className={`w-28 text-right ${INPUT_BASE}`}
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
                        <option key={option} value={option} className="bg-slate-900 text-white">
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
                      className={`w-56 ${INPUT_BARE}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeSponsor(sponsor.id)}
                      className="text-gray-500 hover:text-rose-400"
                      title="Remove"
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
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/10"
        >
          <i className="fa-solid fa-arrow-left mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500"
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
  accent: 'emerald' | 'cyan' | 'purple';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5'
      : accent === 'cyan'
      ? 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5'
      : 'text-purple-300 border-purple-500/20 bg-purple-500/5';
  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
