import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type IgniteClient = {
  id: string;
  name: string;
  legal_name: string | null;
  status: 'active' | 'inactive' | string;
  metadata_json: Record<string, any> | null;
  updated_at: string;
};

type IgniteProposal = {
  id: string;
  client_id: string;
  status: string;
  updated_at: string;
};

export default function IgniteClientsPage() {
  const [clients, setClients] = useState<IgniteClient[]>([]);
  const [proposals, setProposals] = useState<IgniteProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposalCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const proposal of proposals) {
      const key = String(proposal.client_id || '');
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [proposals]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [clientsRes, proposalsRes] = await Promise.all([
        apiGet('/api/ignite/clients'),
        apiGet('/api/ignite/proposals'),
      ]);
      setClients(Array.isArray(clientsRes?.clients) ? clientsRes.clients : []);
      setProposals(Array.isArray(proposalsRes?.proposals) ? proposalsRes.proposals : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function onCreateClient() {
    const name = window.prompt('Client name');
    if (!name || !name.trim()) return;
    const legalName = window.prompt('Legal name (optional)') || null;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/ignite/clients', {
        name: name.trim(),
        legal_name: legalName,
      });
      await loadData();
    } catch (e: any) {
      setError(e?.message || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
            <p className="mt-1 text-sm text-slate-600">
              Client organizations, defaults, access, and proposal activity.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateClient}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus mr-2" />
            {saving ? 'Creating...' : 'Add Client'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Clients</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {clients.filter((client) => client.status === 'active').length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Clients</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{clients.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open Proposals</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{proposals.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!loading && clients.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No clients yet. Add a client to start creating Ignite proposals.
          </div>
        )}

        {clients.map((client) => {
          const defaults = client.metadata_json || {};
          return (
            <article key={client.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{client.name}</h3>
                  <p className="text-sm text-slate-600">{client.legal_name || 'No legal name set'}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    client.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {client.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Open Proposals</p>
                  <p className="font-semibold text-slate-900">{proposalCounts.get(client.id) || 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Updated</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(client.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Default Model</p>
                  <p className="font-semibold text-slate-900">
                    {String(defaults.model_type || 'cost_plus')}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
