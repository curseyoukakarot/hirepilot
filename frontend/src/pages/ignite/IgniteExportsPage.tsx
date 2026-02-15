import React, { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../../lib/api';

type IgniteExport = {
  id: string;
  proposal_id: string;
  proposal_name: string | null;
  export_type: 'pdf' | 'xlsx' | string;
  export_view: 'internal' | 'client' | string;
  status: 'queued' | 'completed' | 'failed' | string;
  created_at: string;
  file_url: string | null;
  metadata_json: Record<string, any> | null;
};

export default function IgniteExportsPage() {
  const [exportsData, setExportsData] = useState<IgniteExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet('/api/ignite/exports');
      setExportsData(Array.isArray(response?.exports) ? response.exports : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load exports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const counts = useMemo(() => {
    return {
      completed: exportsData.filter((row) => row.status === 'completed').length,
      queued: exportsData.filter((row) => row.status === 'queued').length,
      failed: exportsData.filter((row) => row.status === 'failed').length,
    };
  }, [exportsData]);

  function statusClass(status: string): string {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
    if (status === 'queued') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
    if (status === 'failed') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Export Center</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Generate, monitor, and distribute PDF/XLSX proposal outputs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{counts.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Queued</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{counts.queued}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Failed</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{counts.failed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Jobs</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{exportsData.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <table className="w-full min-w-[760px] text-sm text-slate-700 dark:text-slate-200">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Proposal</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">View</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {!loading && exportsData.length === 0 && (
              <tr>
                <td className="px-4 py-5 text-slate-600 dark:text-slate-300" colSpan={6}>
                  No exports yet. Generate one from a proposal export step first.
                </td>
              </tr>
            )}
            {exportsData.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{row.proposal_name || 'Untitled Proposal'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{row.proposal_id}</p>
                </td>
                <td className="px-4 py-4">{String(row.export_type).toUpperCase()}</td>
                <td className="px-4 py-4">{row.export_view}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-4">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-4 py-4 text-right">
                  {row.file_url ? (
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">No file URL yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
