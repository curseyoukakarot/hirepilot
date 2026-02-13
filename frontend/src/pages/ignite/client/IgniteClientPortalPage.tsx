import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../../lib/api';
import { supabase } from '../../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

type Proposal = {
  id: string;
  name: string;
  status: string;
  current_version?: number;
  assumptions_json?: Record<string, any> | null;
  computed_json?: Record<string, any> | null;
  updated_at: string;
};

type ProposalBundle = {
  proposal: Proposal;
  options: Array<{ id: string; label?: string | null }>;
  line_items: Array<{
    id: string;
    option_id: string | null;
    category: string;
    line_name: string;
    description?: string | null;
  }>;
};

function formatMoney(value: any): string {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(value: any): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function IgniteClientPortalPage() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<ProposalBundle | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCount = proposals.length;

  const selectedComputedOption = useMemo(() => {
    if (!selected) return null;
    const computed = selected.proposal?.computed_json || {};
    const perOption = Array.isArray(computed?.per_option) ? computed.per_option : [];
    if (!perOption.length) return null;
    return perOption.find((item: any) => String(item.option_id) === String(selectedOptionId)) || perOption[0];
  }, [selected, selectedOptionId]);

  const currentLineItems = useMemo(() => {
    if (!selected) return [];
    if (!selectedOptionId) return selected.line_items || [];
    return (selected.line_items || []).filter(
      (item) => String(item.option_id || '') === String(selectedOptionId)
    );
  }, [selected, selectedOptionId]);

  const loadProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/ignite/proposals');
      setProposals(Array.isArray(response?.proposals) ? response.proposals : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProposals();
  }, []);

  const openProposal = async (proposalId: string) => {
    try {
      setError(null);
      const bundle = await apiGet(`/api/ignite/proposals/${proposalId}`);
      const data: ProposalBundle = {
        proposal: bundle?.proposal,
        options: Array.isArray(bundle?.options) ? bundle.options : [],
        line_items: Array.isArray(bundle?.line_items) ? bundle.line_items : [],
      };
      setSelected(data);
      setSelectedOptionId(data.options[0]?.id || '');
    } catch (e: any) {
      setError(e?.message || 'Failed to load proposal details');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed left-0 top-0 z-50 h-full w-64 border-r border-gray-200 bg-white">
        <div className="p-6">
          <div className="mb-8 flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <i className="fas fa-fire text-sm text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Ignite</span>
          </div>

          <nav className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center space-x-3 rounded-lg bg-blue-50 px-3 py-2.5 text-left font-medium text-blue-700"
            >
              <i className="fas fa-file-contract text-sm" />
              <span>Proposals</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <i className="fas fa-user text-sm" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            >
              <i className="fas fa-sign-out-alt text-sm" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="ml-64 p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!selected ? (
          <>
            <div className="mb-8">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-gray-600">You have {activeCount} active proposals.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {!loading && proposals.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                  No proposals have been shared with you yet.
                </div>
              )}
              {proposals.map((proposal) => {
                const assumptions = proposal.assumptions_json || {};
                const event = assumptions.event || {};
                const computed = proposal.computed_json || {};
                const total = computed.total_investment || 0;
                const hasNewVersion = Number(proposal.current_version || 1) > 1;
                const status = String(proposal.status || 'draft');
                const statusClass =
                  status === 'final'
                    ? 'bg-green-100 text-green-800'
                    : status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-slate-100 text-slate-800';

                return (
                  <div
                    key={proposal.id}
                    className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="mb-1 font-semibold text-gray-900">{proposal.name}</h3>
                        <p className="mb-1 text-sm text-gray-600">{String(event.location || 'Location TBA')}</p>
                        <p className="text-sm text-gray-500">{formatDate(event.eventDate || proposal.updated_at)}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                          {status}
                        </span>
                        {hasNewVersion && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            New Version
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="mb-1 text-2xl font-bold text-gray-900">{formatMoney(total)}</div>
                      <p className="text-sm text-gray-500">Total Investment</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Updated {new Date(proposal.updated_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/proposals/${proposal.id}`)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        View Proposal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center text-blue-600 hover:text-blue-700"
              >
                <i className="fas fa-arrow-left mr-2" />
                Back to Proposals
              </button>
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="mb-2 text-2xl font-bold text-gray-900">{selected.proposal.name}</h1>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <span className="flex items-center">
                      <i className="fas fa-map-marker-alt mr-2" />
                      {String(selected.proposal.assumptions_json?.event?.location || 'Location TBA')}
                    </span>
                    <span className="flex items-center">
                      <i className="fas fa-calendar mr-2" />
                      {formatDate(selected.proposal.assumptions_json?.event?.eventDate || selected.proposal.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    {String(selected.proposal.status || 'final')}
                  </span>
                  <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                    <i className="fas fa-download mr-2" />
                    Download PDF
                  </button>
                  <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
                    <i className="fas fa-file-excel mr-2" />
                    Download Spreadsheet
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Choose Your Option:</h3>
              <div className="flex space-x-3">
                {(selected.options || []).map((option, idx) => {
                  const active = String(selectedOptionId) === String(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedOptionId(String(option.id))}
                      className={
                        active
                          ? 'rounded-lg bg-blue-600 px-4 py-2 font-medium text-white'
                          : 'rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50'
                      }
                    >
                      {option.label || `Option ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-6 text-lg font-semibold text-gray-900">Proposal Details</h3>

              <div className="mb-6 space-y-4">
                {currentLineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-gray-100 py-3">
                    <div>
                      <div className="font-medium text-gray-900">{item.line_name}</div>
                      <div className="text-sm text-gray-500">{item.description || item.category}</div>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedComputedOption
                        ? formatMoney(
                            (selectedComputedOption.line_items || []).find(
                              (line: any) => String(line.line_item_id) === String(item.id)
                            )?.line_total || 0
                          )
                        : '$0'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-4 border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between py-2">
                  <div className="font-medium text-gray-900">Ignite Management Fee</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatMoney(selectedComputedOption?.ignite_fee || 0)}
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="font-medium text-gray-900">Contingency</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatMoney(selectedComputedOption?.contingency || 0)}
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-gray-900">TOTAL EVENT INVESTMENT</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {formatMoney(selectedComputedOption?.total_investment || 0)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
