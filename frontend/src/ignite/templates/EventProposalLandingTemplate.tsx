import React, { useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/format';
import { IgniteProposalComputed } from '../types/proposals';

type EventProposalLandingTemplateProps = {
  proposal: IgniteProposalComputed;
  onDownloadPdf?: (optionId: string) => void;
  onDownloadXlsx?: (optionId: string) => void;
  onCopySummary?: (optionId: string) => void;
  onApproveSelectedOption?: (optionId: string) => void;
};

export default function EventProposalLandingTemplate({
  proposal,
  onDownloadPdf,
  onDownloadXlsx,
  onCopySummary,
  onApproveSelectedOption,
}: EventProposalLandingTemplateProps) {
  const recommendedOptionId = proposal.options.find((item) => item.isRecommended)?.id || proposal.options[0]?.id;
  const [selectedOptionId, setSelectedOptionId] = useState<string>(recommendedOptionId || '');
  const selectedOption =
    proposal.options.find((item) => item.id === selectedOptionId) || proposal.options[0];

  const modelLabel = proposal.modelType === 'turnkey' ? 'Turnkey' : 'Cost+ (Transparent)';

  const summaryText = useMemo(() => {
    if (proposal.overview.objective) return proposal.overview.objective;
    if (proposal.modelType === 'turnkey') {
      return 'This turnkey proposal presents curated experience options with clear package investment framing.';
    }
    return 'This proposal outlines event options with transparent investment details and IgniteGTM program management.';
  }, [proposal.modelType, proposal.overview.objective]);

  if (!selectedOption) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Proposal options are unavailable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style>{`
        .fade-enter { opacity: 0; transform: translateY(6px); }
        .fade-enter-active { opacity: 1; transform: translateY(0); transition: all 220ms ease; }
        .grad-border {
          position: relative;
          border-radius: 1.25rem;
          background: rgba(15, 23, 42, .6);
          overflow: hidden;
        }
        .grad-border:before {
          content: "";
          position: absolute;
          inset: -2px;
          background: conic-gradient(from 180deg,
            rgba(99,102,241,.75),
            rgba(34,197,94,.65),
            rgba(168,85,247,.65),
            rgba(99,102,241,.75)
          );
          filter: blur(10px);
          opacity: .35;
          animation: spin 10s linear infinite;
        }
        .grad-border > * { position: relative; z-index: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148,163,184,.18) 1px, transparent 0)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-slate-950 to-slate-950" />
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute right-[-6rem] top-52 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2c2.2 4.2-1 6-1 9 0 1.7 1.2 3 3 3 2.2 0 4-2 4-5 3 3 5 6 5 9a11 11 0 1 1-22 0c0-3.5 2-6.5 5-9 0 3 1.8 5 4 5 1.8 0 3-1.3 3-3 0-3-3.2-4.8-1-9Z"
                  fill="rgba(99,102,241,.9)"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">IgniteGTM</div>
              <div className="text-xs text-slate-400">Event Proposal</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadPdf?.(selectedOption.id)}
              className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,.25),0_0_40px_rgba(99,102,241,.15)] hover:bg-indigo-400"
            >
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10">
        <section className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Proposal ready for review
              <span className="text-slate-500">-</span>
              Updated {formatDate(proposal.updatedAt)}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              {proposal.eventName}
              <span className="block text-slate-300">{selectedOption.description || 'Event proposal details'}</span>
            </h1>

            <p className="mt-4 max-w-2xl text-slate-300">{summaryText}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                Client: {proposal.clientName}
              </span>
              <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                Headcount: {proposal.headcount}
              </span>
              <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                Venue: {proposal.location}
              </span>
              {(proposal.eventSnapshot.startTime || proposal.eventSnapshot.endTime) && (
                <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                  Time: {proposal.eventSnapshot.startTime || 'TBD'} - {proposal.eventSnapshot.endTime || 'TBD'}
                </span>
              )}
              {!!proposal.eventSnapshot.city && (
                <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                  City: {proposal.eventSnapshot.city}
                </span>
              )}
              {!!proposal.eventSnapshot.primarySponsor && (
                <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                  Sponsor: {proposal.eventSnapshot.primarySponsor}
                </span>
              )}
              {proposal.eventSnapshot.coSponsors.length > 0 && (
                <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                  Co-Sponsors: {proposal.eventSnapshot.coSponsors.join(', ')}
                </span>
              )}
              <span className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
                Model: {modelLabel}
              </span>
            </div>
            {proposal.overview.successCriteria.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Success Criteria</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {proposal.overview.successCriteria.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="md:col-span-4">
            <div className="grad-border p-[1px] shadow-[0_10px_40px_rgba(0,0,0,.35)]">
              <div className="rounded-[1.18rem] bg-slate-950/70 p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Selected Option</div>
                    <div className="mt-1 text-lg font-semibold">{selectedOption.name}</div>
                  </div>
                  {selectedOption.isRecommended && (
                    <div className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-200 ring-1 ring-indigo-400/20">
                      Recommended
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Total Event Investment</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">
                    {formatCurrency(selectedOption.totals.total)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Includes Ignite management fee and contingency where configured
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-slate-400">Costs Subtotal</div>
                    <div className="mt-1 font-semibold">{formatCurrency(selectedOption.totals.subtotal)}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-slate-400">Ignite Fee</div>
                    <div className="mt-1 font-semibold text-emerald-200">
                      {formatCurrency(selectedOption.totals.fee)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href="#options"
                    className="flex-1 rounded-xl bg-indigo-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,.25),0_0_40px_rgba(99,102,241,.15)] hover:bg-indigo-400"
                  >
                    View Options
                  </a>
                  <a
                    href="#next"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold hover:bg-white/10"
                  >
                    Next Steps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="options" className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Choose an Option</h2>
              <p className="mt-1 text-sm text-slate-400">
                Switch options to update totals and the cost breakdown below.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
              {proposal.options.map((option, index) => {
                const active = option.id === selectedOption.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedOptionId(option.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      active ? 'bg-indigo-500 text-white' : 'text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {option.name || `Option ${index + 1}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {proposal.options.map((option, index) => (
              <div key={option.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Option {index + 1}</div>
                    <div className="mt-1 text-lg font-semibold">{option.name}</div>
                  </div>
                  {option.isRecommended && (
                    <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs text-indigo-200 ring-1 ring-indigo-400/20">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {option.description || 'Configured event option'}
                </p>
                <div className="mt-4 text-2xl font-semibold">{formatCurrency(option.totals.total)}</div>
                <div className="mt-1 text-xs text-slate-400">Total event investment</div>
              </div>
            ))}
          </div>
        </section>

        <section id="breakdown" className="mt-12 grid gap-6 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Investment Breakdown</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Transparent category breakdown for the selected option.
                  </p>
                </div>
              </div>

              <div className="fade-enter-active mt-5 space-y-2">
                {selectedOption.breakdown.map((row) => (
                  <div
                    key={row.categoryName}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-indigo-400/70" />
                      <span className="text-sm font-semibold">{row.categoryName}</span>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(row.amount)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Costs Subtotal</span>
                  <span className="font-semibold">{formatCurrency(selectedOption.totals.subtotal)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Ignite Management Fee</span>
                  <span className="font-semibold text-emerald-200">
                    {formatCurrency(selectedOption.totals.fee)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Contingency</span>
                  <span className="font-semibold text-violet-200">
                    {formatCurrency(selectedOption.totals.contingency)}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-indigo-500/10 p-4 ring-1 ring-indigo-400/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-100">Total Event Investment</span>
                    <span className="text-xl font-semibold tracking-tight">
                      {formatCurrency(selectedOption.totals.total)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    This is the total investment for the selected option.
                  </div>
                </div>
              </div>

              {proposal.visibilityRules.showLineItems && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-200">Line Item View</h4>
                  <div className="mt-3 space-y-2">
                    {selectedOption.lineItems.map((item) => (
                      <div
                        key={`${item.id || item.name}-${item.amount}`}
                        className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-300">
                            {item.category}
                            {proposal.visibilityRules.showVendors && item.vendor ? ` • ${item.vendor}` : ''}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{formatCurrency(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
              <h3 className="text-lg font-semibold">What's Included</h3>
              <p className="mt-1 text-sm text-slate-400">
                Ignite delivers a polished end-to-end event experience.
              </p>
              <div className="mt-5 space-y-3">
                {proposal.included.sections.map((section, index) => (
                  <div key={section.title} className="flex gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                    <div
                      className={`mt-0.5 h-9 w-9 shrink-0 rounded-xl ${
                        index % 3 === 0
                          ? 'bg-emerald-500/15 ring-1 ring-emerald-400/20'
                          : index % 3 === 1
                          ? 'bg-indigo-500/15 ring-1 ring-indigo-400/20'
                          : 'bg-violet-500/15 ring-1 ring-violet-400/20'
                      }`}
                    />
                    <div>
                      <div className="font-semibold">{section.title}</div>
                      <div className="text-sm text-slate-300">{section.bullets[0] || ''}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-sm font-semibold">Deliverables</div>
                <ul className="mt-2 space-y-2 text-sm text-slate-300">
                  {proposal.included.sections.flatMap((section) => section.bullets).slice(0, 4).map((bullet, idx) => (
                    <li key={`${bullet}-${idx}`}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="next" className="mt-12">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-500/10 via-white/5 to-emerald-500/10 p-6 shadow-[0_10px_40px_rgba(0,0,0,.35)]">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-semibold tracking-tight">Next Steps</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">
                  Reply with your preferred option and we'll finalize venue availability and the event run-of-show.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {proposal.nextSteps.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Agreement Terms</p>
                  <div className="mt-2 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                    <div>Deposit: {proposal.agreementTerms.depositPercent}%</div>
                    <div>Cancellation Window: {proposal.agreementTerms.cancellationWindowDays} days</div>
                    <div className="sm:col-span-2">
                      Deposit Due: {proposal.agreementTerms.depositDueRule || 'Per agreement'}
                    </div>
                    <div className="sm:col-span-2">
                      Balance Due: {proposal.agreementTerms.balanceDueRule || 'Per agreement'}
                    </div>
                    {proposal.agreementTerms.costSplitNotes && (
                      <div className="sm:col-span-2">Cost Split: {proposal.agreementTerms.costSplitNotes}</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onApproveSelectedOption?.(selectedOption.id)}
                  className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(99,102,241,.25),0_0_40px_rgba(99,102,241,.15)] hover:bg-indigo-400"
                >
                  Approve Selected Option
                </button>
                <button className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10">
                  Request Revisions
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 pt-8 text-sm text-slate-400">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="font-semibold text-slate-200">IgniteGTM</div>
              <div className="mt-1">
                This proposal is confidential and intended for the named recipient.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onDownloadXlsx?.(selectedOption.id)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
              >
                Download XLSX
              </button>
              <button
                type="button"
                onClick={() => onCopySummary?.(selectedOption.id)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
              >
                Copy Summary
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
