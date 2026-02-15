import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';

type IgniteTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  client_id: string | null;
  updated_at: string;
};

type IgniteClient = {
  id: string;
  name: string;
};

export default function IgniteTemplatesPage() {
  const [templates, setTemplates] = useState<IgniteTemplate[]>([]);
  const [clients, setClients] = useState<IgniteClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) map.set(client.id, client.name);
    return map;
  }, [clients]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, clientsRes] = await Promise.all([
        apiGet('/api/ignite/templates'),
        apiGet('/api/ignite/clients'),
      ]);
      setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : []);
      setClients(Array.isArray(clientsRes?.clients) ? clientsRes.clients : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function onCreateTemplate() {
    const name = window.prompt('Template name');
    if (!name || !name.trim()) return;
    const description = window.prompt('Short description (optional)') || null;
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/ignite/templates', {
        name: name.trim(),
        description,
        is_default: false,
        data_json: {},
      });
      await loadData();
    } catch (e: any) {
      setError(e?.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Template Library</h1>
            <p className="mt-1 text-sm text-slate-600">
              Reusable structures for rapid proposal assembly.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateTemplate}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus mr-2" />
            {saving ? 'Creating...' : 'New Template'}
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
          <p className="text-xs uppercase tracking-wide text-slate-500">Templates</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{templates.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Published Defaults</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {templates.filter((item) => item.is_default).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Client Scoped</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {templates.filter((item) => Boolean(item.client_id)).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!loading && templates.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No templates yet. Click <strong>New Template</strong> to add your first one.
          </div>
        )}

        {templates.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {item.description || 'No description added yet.'}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  item.is_default
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.is_default ? 'Default' : 'Custom'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Client</p>
                <p className="font-semibold text-slate-900">
                  {item.client_id ? clientsById.get(item.client_id) || 'Assigned' : 'Global'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Updated</p>
                <p className="font-semibold text-slate-900">
                  {new Date(item.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
