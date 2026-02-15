import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../../lib/api';

type ProposalRow = {
  id: string;
  name: string | null;
  client_id: string | null;
  status: string | null;
  pricing_mode: string | null;
  updated_at: string;
  assumptions_json?: Record<string, any> | null;
  computed_json?: Record<string, any> | null;
};

type ClientRow = {
  id: string;
  name: string;
};

function money(value: any): string {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function IgniteProposalSelectorPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [computedTotalsByProposalId, setComputedTotalsByProposalId] = useState<Record<string, number>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [proposalRes, clientRes] = await Promise.all([
        apiGet('/api/ignite/proposals'),
        apiGet('/api/ignite/clients'),
      ]);
      setProposals(Array.isArray(proposalRes?.proposals) ? proposalRes.proposals : []);
      setClients(Array.isArray(clientRes?.clients) ? clientRes.clients : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load proposals'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!proposals.length) {
      setComputedTotalsByProposalId({});
      return;
    }

    let cancelled = false;
    const loadComputedTotals = async () => {
      const entries = await Promise.all(
        proposals.map(async (proposal) => {
          try {
            const response = await apiGet(`/api/ignite/proposals/${proposal.id}/computed`);
            const computed = response?.proposal || {};
            const options = Array.isArray(computed?.options) ? computed.options : [];
            const selected = options.find((option: any) => option?.isRecommended) || options[0] || null;
            const total = Number(selected?.totals?.total || 0);
            return [proposal.id, Number.isFinite(total) ? total : 0] as const;
          } catch {
            return [proposal.id, 0] as const;
          }
        })
      );
      if (cancelled) return;
      setComputedTotalsByProposalId(Object.fromEntries(entries));
    };

    void loadComputedTotals();
    return () => {
      cancelled = true;
    };
  }, [proposals]);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) map.set(String(client.id), client.name);
    return map;
  }, [clients]);

  const draftProposals = useMemo(
    () =>
      proposals.filter((proposal) => {
        const status = String(proposal.status || '').toLowerCase();
        return status === 'draft';
      }),
    [proposals]
  );
  const completedProposals = useMemo(
    () =>
      proposals.filter((proposal) => {
        const status = String(proposal.status || '').toLowerCase();
        return status !== 'draft' && status !== 'archived';
      }),
    [proposals]
  );

  const onCreate = () => navigate('/ignite/proposals/new');

  async function duplicateProposal(proposalId: string) {
    try {
      await apiPost(`/api/ignite/proposals/${proposalId}/duplicate`, {});
      await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to duplicate proposal'));
    } finally {
      setOpenMenuId(null);
    }
  }

  async function deleteProposal(proposalId: string) {
    const confirmed = window.confirm('Archive this proposal?');
    if (!confirmed) return;
    try {
      await apiDelete(`/api/ignite/proposals/${proposalId}`);
      await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to archive proposal'));
    } finally {
      setOpenMenuId(null);
    }
  }

  const renderCard = (proposal: ProposalRow, minWidth = false) => {
    const assumptions = (proposal.assumptions_json || {}) as Record<string, any>;
    const event = (assumptions.event || {}) as Record<string, any>;
    const fallbackTotal = Number(proposal.computed_json?.per_option?.[0]?.total_investment || 0);
    const total = Number(computedTotalsByProposalId[proposal.id] || fallbackTotal || 0);
    const status = String(proposal.status || 'draft').toLowerCase();
    const statusClass =
      status === 'approved'
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : status === 'sent'
        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        : status === 'final' || status === 'shared'
        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
    const statusLabel = status === 'shared' ? 'final' : status;

    return (
      <article
        key={proposal.id}
        onClick={() => navigate(`/ignite/proposals/${proposal.id}`)}
        className={`${minWidth ? 'min-w-[380px]' : ''} group relative cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all hover:border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/10`}
      >
        <div className="mb-4 flex items-start justify-between">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass}`}>
            {statusLabel}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId((current) => (current === proposal.id ? null : proposal.id));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
            >
              <i className="fa-solid fa-ellipsis" />
            </button>
            {openMenuId === proposal.id && (
              <div className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void duplicateProposal(proposal.id);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteProposal(proposal.id);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/15"
                >
                  Archive
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="mb-2 text-xl font-bold transition-colors group-hover:text-purple-400">
          {proposal.name || 'Untitled Proposal'}
        </h3>
        <p className="mb-4 text-sm font-medium text-purple-400">{clientMap.get(String(proposal.client_id || '')) || 'Unknown client'}</p>

        <div className="mb-6 space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <i className="fa-solid fa-calendar w-4" />
            <span>{event.eventDate || 'Date TBD'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <i className="fa-solid fa-location-dot w-4" />
            <span>{event.city || event.location || 'Location TBD'}</span>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs text-gray-400">Total Investment</p>
              <p className="text-2xl font-bold">{money(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Updated {new Date(proposal.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-full rounded-2xl bg-gradient-to-br from-[#060609] via-[#0a0a0f] to-[#060609] text-white">
      <header className="sticky top-0 z-10 rounded-t-2xl border-b border-white/10 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-blue-900/20 px-8 py-6 backdrop-blur-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-3xl font-bold text-transparent">
              Proposals
            </h1>
            <p className="text-gray-400">Browse, manage, export, and deliver Ignite proposals.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-gray-300 transition-all hover:border-white/20 hover:bg-white/10"
            >
              <i className="fa-solid fa-rotate-right mr-2" />
              Refresh
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold shadow-lg shadow-purple-500/25 transition-all hover:from-purple-500 hover:to-pink-500"
            >
              <i className="fa-solid fa-plus mr-2" />
              Create Proposal
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-10 p-8">
        {error && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        )}
        {loading && <div className="text-sm text-gray-300">Loading proposals...</div>}

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Drafts in Progress</h2>
              <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
                {draftProposals.length}
              </span>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {draftProposals.length ? (
              draftProposals.map((proposal) => renderCard(proposal, true))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-gray-300">
                No draft proposals right now.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Completed Proposals</h2>
              <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400">
                {completedProposals.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {completedProposals.length ? (
              completedProposals.map((proposal) => renderCard(proposal))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-gray-300 xl:col-span-3">
                No completed proposals yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

