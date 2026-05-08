/**
 * v2 / Templates — message template library
 *
 * Wave 2 — fresh v2 page using the existing templatesService (legacy
 * doesn't have a list view). Reads `templates` table directly via
 * supabase, supports search + delete + jump-to-edit (TemplateSelector
 * is the legacy editor, opened via legacy /campaigns flow for now).
 *
 * Future (Wave 5): port the performance-rings visual + REX-suggested
 * variants carousel from mockups/templates.html, and add inline create/
 * edit modals.
 */

import React, { useEffect, useMemo, useState } from 'react';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';
import { supabase } from '../../lib/supabaseClient';
import { toastSuccess, toastSoon } from '../components/V2Toast';

interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
}

const VAR_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function previewText(content: string, max = 180): string {
  const stripped = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > max ? stripped.slice(0, max) + '…' : stripped;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function V2TemplatesPage() {
  useV2Theme();
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRows([]);
        return;
      }
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      setRows((data || []) as TemplateRow[]);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[v2/templates] load failed:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleDelete = async (id: string) => {
    if (busyId) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    setBusyId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('templates').delete().eq('id', id).eq('user_id', user.id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toastSuccess('Template deleted');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <WorkspaceShell autopilot>
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-layer-group text-primary text-xs" />
          Templates
        </div>
        <div className="status-pill ml-3">
          <i className="fa-solid fa-bolt text-warn text-[10px]" />
          <span>{rows.length} saved</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="bg-surface border border-gray-200 rounded-lg pl-7 pr-2.5 py-1.5 text-[12px] w-[220px] focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => toastSoon('New template — coming soon to v2 (use Campaigns builder for now)')}
            className="btn-solid"
          >
            <i className="fa-solid fa-plus text-[10px]" />
            New template
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-6 max-w-[1280px] mx-auto">
        {loading ? (
          <div className="px-8 py-12 text-center text-text-muted">
            <i className="fa-solid fa-spinner fa-spin text-primary text-[20px] mb-2" />
            <div>Loading templates…</div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState searching={!!search.trim()} totalCount={rows.length} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filtered.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                busy={busyId === tpl.id}
                onDelete={() => handleDelete(tpl.id)}
              />
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

/* -------------------------- Sub-components -------------------------- */

function TemplateCard({
  tpl,
  busy,
  onDelete,
}: {
  tpl: TemplateRow;
  busy: boolean;
  onDelete: () => void;
}) {
  const vars = useMemo(() => {
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(VAR_RE);
    while ((m = re.exec(tpl.content)) !== null) {
      set.add(m[1]);
    }
    return Array.from(set).slice(0, 4);
  }, [tpl.content]);

  return (
    <div
      className="bg-white rounded-xl overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ border: '1px solid #ECECEC' }}
    >
      <div className="px-4 pt-4 pb-2 flex items-start gap-2.5">
        <span className="w-2 h-2 rounded-full bg-secondary mt-1.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13.5px] truncate">{tpl.name || 'Untitled template'}</div>
          <div className="text-[10.5px] text-text-muted">
            edited {timeAgo(tpl.updated_at || tpl.created_at)}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 text-[12px] text-text-secondary leading-snug min-h-[68px]">
        {previewText(tpl.content) || <span className="italic text-text-muted">No content yet.</span>}
      </div>

      {vars.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {vars.map((v) => (
            <span
              key={v}
              className="font-mono text-[10.5px] bg-primary/8 text-primary px-1.5 py-0.5 rounded"
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-1.5 text-[11px] mt-auto">
        <a href={`/campaigns?template=${encodeURIComponent(tpl.id)}`} className="btn-outline !text-[11px]">
          <i className="fa-solid fa-pen text-[9px]" />
          Edit in Campaigns
        </a>
        <button
          onClick={onDelete}
          disabled={busy}
          title="Delete template"
          className="ghost-btn !text-[11px] ml-auto disabled:opacity-50"
          style={{ color: '#DC2626' }}
        >
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash'} text-[10px]`} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ searching, totalCount }: { searching: boolean; totalCount: number }) {
  if (searching) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center" style={{ border: '1px solid #ECECEC' }}>
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-text-muted mx-auto mb-3">
          <i className="fa-solid fa-magnifying-glass text-[18px]" />
        </div>
        <div className="text-[15px] font-bold mb-1">No matches</div>
        <div className="text-[12.5px] text-text-muted max-w-md mx-auto">
          Try a different search term.
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl p-12 text-center"
      style={{
        background: 'linear-gradient(135deg,rgba(107,70,193,.05),rgba(12,92,244,.03) 60%,transparent)',
        border: '1px solid rgba(107,70,193,.15)',
      }}
    >
      <div className="w-14 h-14 rounded-2xl grad-icon flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
        <i className="fa-solid fa-layer-group text-[20px]" />
      </div>
      <div className="text-[18px] font-extrabold tracking-tight mb-1">
        {totalCount === 0 ? 'No templates yet' : 'No templates in this view'}
      </div>
      <div className="text-[13px] text-text-muted max-w-md mx-auto mb-5">
        Save your best outbound, reply, and submittal copy here. Variables like
        <span className="font-mono text-primary mx-1">{'{{first_name}}'}</span>
        get filled in automatically.
      </div>
      <a href="/campaigns" className="btn-solid mx-auto">
        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
        Create in Campaigns
      </a>
    </div>
  );
}
