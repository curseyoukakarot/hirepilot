import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/**
 * BulkAddToTableModal
 * - Lists existing custom tables
 * - If none exist, prompts user to create one
 * - Appends selected records into chosen table via backend endpoint
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - entity: 'leads'|'candidates'|'opportunities'|'clients'|'contacts'
 * - ids: string[]
 * - onSuccess?: (result) => void
 */
export default function BulkAddToTableModal({ open, onClose, entity, ids, onSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');

  const backendBase = (import.meta?.env && import.meta.env.VITE_BACKEND_URL) || 'https://api.thehirepilot.com';

  const normalizedEntity = useMemo(() => {
    const v = String(entity || '').toLowerCase();
    if (v === 'deals' || v === 'deal' || v === 'opportunity') return 'opportunities';
    return v;
  }, [entity]);

  const canUseTableForEntity = (t) => {
    const src = Array.isArray(t?.import_sources) ? t.import_sources.map(s => String(s || '').toLowerCase()).filter(Boolean) : [];
    if (!src.length) return true; // untyped table
    return src.includes(normalizedEntity);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setTablesLoading(true);
        const { data, error } = await supabase
          .from('custom_tables')
          .select('id,name,import_sources,updated_at')
          .order('updated_at', { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        setTables(data || []);
        // Default selection: first compatible table
        const firstOk = (data || []).find(canUseTableForEntity);
        setSelectedTableId(firstOk?.id || (data?.[0]?.id || ''));
      } catch (e) {
        if (!cancelled) {
          console.error('[BulkAddToTableModal] failed to load tables', e);
          setTables([]);
          setSelectedTableId('');
        }
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, normalizedEntity]);

  const close = () => {
    if (loading) return;
    onClose?.();
  };

  const createTable = () => {
    // Tables.jsx supports ?create=1 which auto-creates and opens the editor
    navigate('/tables?create=1');
    onClose?.();
  };

  const submit = async () => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        toast.error('Select at least one item first.');
        return;
      }
      if (!selectedTableId) {
        toast.error('Pick a table first.');
        return;
      }
      const chosen = tables.find(t => String(t.id) === String(selectedTableId));
      if (chosen && !canUseTableForEntity(chosen)) {
        toast.error('That table is set up for a different record type.');
        return;
      }

      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const resp = await fetch(`${backendBase}/api/tables/${selectedTableId}/bulk-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ entity: normalizedEntity, ids }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = json?.error || `Failed (${resp.status})`;
        if (resp.status === 409 && json?.error === 'table_source_mismatch') {
          toast.error('That table is for a different record type. Create a new table or pick a matching one.');
          return;
        }
        throw new Error(msg);
      }
      toast.success(`Added ${json?.added ?? 0} (skipped ${json?.skipped ?? 0})`);
      onSuccess?.(json);
      onClose?.();
    } catch (e) {
      console.error('[BulkAddToTableModal] submit failed', e);
      toast.error(e?.message || 'Failed to add to table');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const hasTables = (tables || []).length > 0;
  const selectedCount = Array.isArray(ids) ? ids.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={close}>
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add to table</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} selected • {String(normalizedEntity || '').replace(/^\w/, (c) => c.toUpperCase())}
            </div>
          </div>
          <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={close} disabled={loading}>✕</button>
        </div>

        <div className="p-5">
          {tablesLoading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading your tables…</div>
          ) : !hasTables ? (
            <div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                You don’t have any tables yet. Create a table first, then you can bulk-add your selected records into it.
              </div>
              <div className="mt-4 flex gap-2">
                <button className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700" onClick={createTable}>
                  Create a table
                </button>
                <button className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10" onClick={close}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Choose a table</label>
              <select
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-950 dark:text-gray-100 dark:border-white/10"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                disabled={loading}
              >
                {(tables || []).map((t) => {
                  const src = Array.isArray(t?.import_sources) ? t.import_sources.map(s => String(s || '').toLowerCase()).filter(Boolean) : [];
                  const ok = canUseTableForEntity(t);
                  const suffix = !src.length ? '' : (ok ? '' : ` (for ${src.join(', ')})`);
                  return (
                    <option key={t.id} value={t.id} disabled={!ok}>
                      {t.name || 'Untitled Table'}{suffix}
                    </option>
                  );
                })}
              </select>

              <div className="mt-4 flex items-center justify-between">
                <button className="text-sm text-purple-700 hover:underline" onClick={createTable} disabled={loading}>
                  Create a new table instead
                </button>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10" onClick={close} disabled={loading}>
                    Cancel
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" onClick={submit} disabled={loading || !selectedTableId || selectedCount === 0}>
                    {loading ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Tip: if the table is empty, we’ll auto-create sensible columns for this record type.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


