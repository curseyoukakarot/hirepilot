import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type AgentStatus = 'active' | 'running' | 'idle';
type AgentProfile = {
  id: string;
  name: string;
  subtitle: string;
  status: AgentStatus;
  icon: string;
  iconBg: string;
  iconColor: string;
  links: string[];
  capabilities: string[];
  guides: string[];
  recipes: string[];
  instructions: string[];
};

type CatalogResponse = {
  agents: AgentProfile[];
  source?: 'default' | 'system_settings';
};

function normalizeCatalog(raw: any): { agents: AgentProfile[] } {
  if (Array.isArray(raw)) return { agents: raw as AgentProfile[] };
  if (raw && typeof raw === 'object' && Array.isArray(raw.agents)) return { agents: raw.agents as AgentProfile[] };
  throw new Error('catalog_must_be_array_or_object_with_agents');
}

function validateCatalog(catalog: { agents: AgentProfile[] }) {
  if (!Array.isArray(catalog.agents) || catalog.agents.length < 1) {
    throw new Error('agents must be a non-empty array');
  }
  for (const agent of catalog.agents) {
    if (!agent?.id || !agent?.name) throw new Error('each agent requires id and name');
    if (!['active', 'running', 'idle'].includes(String(agent.status || ''))) {
      throw new Error(`invalid status for ${agent.id}`);
    }
    const requiredArrays: Array<keyof AgentProfile> = ['links', 'capabilities', 'guides', 'recipes', 'instructions'];
    for (const key of requiredArrays) {
      if (!Array.isArray(agent[key])) throw new Error(`agent ${agent.id} field ${key} must be an array`);
    }
  }
}

export default function RexAgentsCatalogPage() {
  const backend = import.meta.env.VITE_BACKEND_URL || '';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<string>('default');
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [draft, setDraft] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const sortedAgents = useMemo(() => [...agents].sort((a, b) => a.name.localeCompare(b.name)), [agents]);

  async function authHeaders(includeJson = false) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }

  async function loadCatalog() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${backend}/api/rex2/agents`, {
        headers: await authHeaders(false)
      });
      const data: CatalogResponse & { error?: string } = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || 'failed_to_load_agents');
      const nextAgents = Array.isArray(data.agents) ? data.agents : [];
      setAgents(nextAgents);
      setSource(data.source || 'default');
      setDraft(JSON.stringify({ agents: nextAgents }, null, 2));
    } catch (e: any) {
      setError(e?.message || 'failed_to_load_agents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveCatalog() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const parsed = JSON.parse(draft);
      const normalized = normalizeCatalog(parsed);
      validateCatalog(normalized);

      const res = await fetch(`${backend}/api/rex2/agents`, {
        method: 'PUT',
        headers: await authHeaders(true),
        body: JSON.stringify({ agents: normalized.agents })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'failed_to_save_agents');

      setAgents(normalized.agents);
      setSource('system_settings');
      setMessage('REX Agent catalog saved.');
    } catch (e: any) {
      setError(e?.message || 'invalid_catalog');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">REX Agent Catalog</h1>
            <p className="text-sm text-gray-400 mt-1">
              Super Admin-only control for Agent Mode profiles used by `REXChat`.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
              onClick={loadCatalog}
              disabled={loading || saving}
            >
              Reload
            </button>
            <button
              className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-sm"
              onClick={saveCatalog}
              disabled={loading || saving}
            >
              {saving ? 'Saving...' : 'Save Catalog'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2 py-1 rounded bg-gray-700 text-xs">Source: {source}</span>
            <span className="px-2 py-1 rounded bg-gray-700 text-xs">Agents: {agents.length}</span>
            <span className="px-2 py-1 rounded bg-gray-700 text-xs">Endpoint: /api/rex2/agents</span>
          </div>
          {message && <p className="text-emerald-400 mt-3">{message}</p>}
          {error && <p className="text-rose-400 mt-3">{error}</p>}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-4">Current Agents</h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-sm text-gray-400">Loading catalog...</div>
              ) : sortedAgents.length === 0 ? (
                <div className="text-sm text-gray-400">No agents configured.</div>
              ) : (
                sortedAgents.map((agent) => (
                  <div key={agent.id} className="rounded-lg border border-gray-700 bg-gray-900/70 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-7 h-7 rounded-md flex items-center justify-center ${agent.iconBg || 'bg-gray-700'}`}>
                          <i className={`fa-solid ${agent.icon || 'fa-robot'} ${agent.iconColor || 'text-gray-200'} text-xs`} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{agent.name}</p>
                          <p className="text-xs text-gray-400 truncate">{agent.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded bg-gray-700 uppercase">{agent.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {agent.capabilities?.length || 0} capabilities • {agent.recipes?.length || 0} recipes • {agent.links?.length || 0} links
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-4">JSON Editor</h2>
            <textarea
              className="w-full min-h-[560px] bg-[#0b1220] border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

