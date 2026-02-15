import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '../../lib/api';

type ClientDetail = {
  id: string;
  name: string;
  legal_name: string | null;
  status: string;
  metadata_json: Record<string, any> | null;
  updated_at: string;
};

type ProposalRow = {
  id: string;
  name: string | null;
  status: string;
  pricing_mode: string | null;
  updated_at: string;
  assumptions_json?: Record<string, any> | null;
  computed_json?: Record<string, any> | null;
};

export default function IgniteClientViewerPage() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [notes, setNotes] = useState<Array<{ id: string; author: string; text: string; at: string }>>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    legal_name: '',
    website: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    billing_address: '',
    tax_id: '',
    model_type: 'cost_plus',
  });

  async function loadData() {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const [clientRes, proposalRes] = await Promise.all([
        apiGet(`/api/ignite/clients/${clientId}`),
        apiGet('/api/ignite/proposals'),
      ]);
      const row = clientRes?.client as ClientDetail | undefined;
      if (!row) throw new Error('Client not found');
      setClient(row);
      const metadata = (row.metadata_json || {}) as Record<string, any>;
      setForm({
        name: String(row.name || ''),
        legal_name: String(row.legal_name || ''),
        website: String(metadata.website || ''),
        contact_name: String(metadata.contact_name || ''),
        contact_email: String(metadata.contact_email || ''),
        contact_phone: String(metadata.contact_phone || ''),
        billing_address: String(metadata.billing_address || ''),
        tax_id: String(metadata.tax_id || ''),
        model_type: String(metadata.model_type || 'cost_plus'),
      });
      setNotes(Array.isArray(metadata.notes) ? metadata.notes : []);

      const allProposals = Array.isArray(proposalRes?.proposals) ? proposalRes.proposals : [];
      setProposals(allProposals.filter((proposal: any) => String(proposal.client_id || '') === String(clientId)));
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load client'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [clientId]);

  const modelLabel = useMemo(
    () => (form.model_type === 'turnkey' ? 'Turnkey' : 'Cost+'),
    [form.model_type]
  );

  async function onSave() {
    if (!clientId) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/ignite/clients/${clientId}`, {
        name: form.name,
        legal_name: form.legal_name || null,
        metadata_json: {
          website: form.website || null,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          billing_address: form.billing_address || null,
          tax_id: form.tax_id || null,
          model_type: form.model_type || 'cost_plus',
          notes,
        },
      });
      setEditing(false);
      await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to save client'));
    } finally {
      setSaving(false);
    }
  }

  async function onDuplicate() {
    if (!clientId) return;
    try {
      const res = await apiPost(`/api/ignite/clients/${clientId}/duplicate`, {});
      const duplicatedId = String(res?.client?.id || '');
      if (duplicatedId) navigate(`/ignite/clients/${duplicatedId}`);
      else await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to duplicate client'));
    }
  }

  async function onArchive() {
    if (!clientId) return;
    const confirmed = window.confirm('Archive this client?');
    if (!confirmed) return;
    try {
      await apiPatch(`/api/ignite/clients/${clientId}`, { status: 'inactive' });
      await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to archive client'));
    }
  }

  const onAddNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        author: 'Ignite Team',
        text,
        at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNoteDraft('');
  };

  if (loading) return <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-slate-200">Loading client...</div>;
  if (!client) return <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200">Client not found.</div>;

  const updated = new Date(client.updated_at).toLocaleDateString();

  return (
    <div className="space-y-8 rounded-2xl bg-gray-900 text-white">
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 px-8 py-10">
        <div className="flex flex-col items-start justify-between gap-5 xl:flex-row">
          <div className="flex-1">
            <h1 className="text-4xl font-bold">{form.name || client.name}</h1>
            <p className="mt-2 text-xl text-gray-200">{form.legal_name || client.legal_name || 'No legal entity set'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm">{modelLabel}</span>
              {!!form.website && (
                <span className="flex items-center gap-2 text-sm text-gray-100">
                  <i className="fa-solid fa-globe" />
                  {form.website}
                </span>
              )}
              <span className="rounded-full bg-green-500/80 px-3 py-1 text-sm font-medium">{client.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/ignite/proposals/new?clientId=${client.id}`)}
              className="rounded-lg bg-indigo-500 px-6 py-3 font-medium hover:bg-indigo-400"
            >
              <i className="fa-solid fa-plus mr-2" />
              Create Proposal
            </button>
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="rounded-lg border border-white/30 px-6 py-3 font-medium hover:bg-white/10"
            >
              <i className="fa-solid fa-edit mr-2" />
              {editing ? 'Stop Editing' : 'Edit Client Info'}
            </button>
            <button type="button" onClick={onArchive} className="px-3 py-2 text-red-200 hover:text-red-100">
              <i className="fa-solid fa-archive mr-2" />
              Archive Client
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Client Details</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onDuplicate} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
              Duplicate
            </button>
            <button
              type="button"
              disabled={!editing || saving}
              onClick={onSave}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-12 xl:grid-cols-2">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Contact Name</span>
              <input disabled={!editing} value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Contact Email</span>
              <input disabled={!editing} value={form.contact_email} onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Contact Phone</span>
              <input disabled={!editing} value={form.contact_phone} onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Website</span>
              <input disabled={!editing} value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
          </div>
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Client Name</span>
              <input disabled={!editing} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Legal Entity Name</span>
              <input disabled={!editing} value={form.legal_name} onChange={(e) => setForm((p) => ({ ...p, legal_name: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Billing Address</span>
              <textarea disabled={!editing} value={form.billing_address} onChange={(e) => setForm((p) => ({ ...p, billing_address: e.target.value }))} rows={3} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-400">Tax ID</span>
              <input disabled={!editing} value={form.tax_id} onChange={(e) => setForm((p) => ({ ...p, tax_id: e.target.value }))} className="w-full rounded-lg border border-white/15 bg-slate-900/80 px-4 py-3 text-white disabled:opacity-80" />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h2 className="mb-6 text-2xl font-semibold">Proposal Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="py-3 text-left font-medium">Proposal Name</th>
                <th className="py-3 text-left font-medium">Event Date</th>
                <th className="py-3 text-left font-medium">Model Type</th>
                <th className="py-3 text-left font-medium">Status</th>
                <th className="py-3 text-left font-medium">Total Investment</th>
                <th className="py-3 text-left font-medium">Last Updated</th>
                <th className="py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {proposals.map((proposal) => {
                const event = (proposal.assumptions_json?.event || {}) as Record<string, any>;
                const total = Number(proposal.computed_json?.per_option?.[0]?.total_investment || 0);
                return (
                  <tr key={proposal.id} className="hover:bg-white/5">
                    <td className="py-4 text-white">{proposal.name || 'Untitled Proposal'}</td>
                    <td className="py-4 text-gray-300">{event.eventDate || 'TBD'}</td>
                    <td className="py-4 text-gray-300">{proposal.pricing_mode || 'cost_plus'}</td>
                    <td className="py-4 text-gray-300">{proposal.status}</td>
                    <td className="py-4 text-white">${total.toLocaleString()}</td>
                    <td className="py-4 text-gray-300">{new Date(proposal.updated_at).toLocaleString()}</td>
                    <td className="py-4">
                      <button onClick={() => navigate(`/ignite/proposals/${proposal.id}`)} className="text-blue-400 hover:text-blue-300">
                        <i className="fa-solid fa-eye" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!proposals.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-gray-300">No proposals for this client yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h2 className="mb-6 text-2xl font-semibold">Notes & Relationship Log</h2>
        <div className="mb-8 rounded-xl bg-slate-900/70 p-6">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a private note about this client..."
            className="h-24 w-full resize-none rounded-lg border border-gray-600 bg-transparent p-4 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
          />
          <div className="mt-4 flex justify-end">
            <button onClick={onAddNote} className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2 font-medium hover:opacity-90">
              Add Note
            </button>
          </div>
        </div>
        <div className="max-h-96 space-y-6 overflow-y-auto">
          {notes.map((note, idx) => (
            <div key={note.id} className={`border-l-4 pl-6 py-4 ${idx % 3 === 0 ? 'border-blue-500' : idx % 3 === 1 ? 'border-green-500' : 'border-purple-500'}`}>
              <div className="mb-2 flex items-start justify-between">
                <span className="font-medium text-slate-200">{note.author}</span>
                <span className="text-sm text-gray-400">{new Date(note.at).toLocaleString()}</span>
              </div>
              <p className="text-gray-300">{note.text}</p>
            </div>
          ))}
          {!notes.length && <div className="text-sm text-gray-300">No notes yet. Add one above.</div>}
        </div>
      </section>

      <div className="text-xs text-gray-500">Last updated: {updated}</div>
    </div>
  );
}

