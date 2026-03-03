import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../lib/api';
import { useCampaignOptions } from '../../hooks/useCampaignOptions';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ToastT = { show: boolean; message: string; type: 'success' | 'error' | 'info' };

function Toast({ show, message, type }: ToastT) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[99999]">
      <div
        className={cx(
          'rounded-xl border px-4 py-3 shadow-xl backdrop-blur',
          'bg-white/90 border-slate-200 text-slate-900 dark:bg-slate-950/90 dark:border-slate-800 dark:text-slate-100',
          type === 'success' && 'border-emerald-300 dark:border-emerald-700/60',
          type === 'error' && 'border-rose-300 dark:border-rose-700/60',
          type === 'info' && 'border-sky-300 dark:border-sky-700/60',
        )}
      >
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}

function formatDate(ts: string | undefined | null) {
  if (!ts) return '\u2014';
  try { return new Date(ts).toLocaleString(); } catch { return '\u2014'; }
}

type Job = {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  items_total?: number;
  items_completed?: number;
};

type JobItem = {
  id: string;
  action_type: string;
  profile_url: string;
  status: string;
  error_message?: string;
  result_json?: Record<string, unknown>;
};

/* ------------------------------------------------------------------ */
/*  Status pill for jobs                                               */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: string }) {
  const s = status || '\u2014';
  const cls =
    s === 'success' || s === 'completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-200'
      : s === 'failed' || s === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-200'
        : s === 'running' || s === 'in_progress'
          ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-950/30 dark:text-sky-200'
          : s === 'queued' || s === 'pending'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300';
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', cls)}>
      {s}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Job type labels                                                    */
/* ------------------------------------------------------------------ */

const JOB_TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  prospect_post_engagers: { emoji: '\uD83D\uDD25', label: 'Post Engagement' },
  people_search: { emoji: '\uD83D\uDD0D', label: 'People Search' },
  jobs_intent: { emoji: '\uD83D\uDCBC', label: 'Jobs Intent' },
  send_connect_requests: { emoji: '\uD83E\uDD1D', label: 'Connect Requests' },
  send_messages: { emoji: '\uD83D\uDCAC', label: 'Send Message' },
};

function jobLabel(jobType: string) {
  return JOB_TYPE_LABELS[jobType] || { emoji: '\u2699\uFE0F', label: jobType };
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ActivityPanel() {
  const [toast, setToast] = useState<ToastT>({ show: false, message: '', type: 'info' });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const showToast = (message: string, type: ToastT['type'] = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, message, type });
    toastTimer.current = setTimeout(() => setToast((p) => ({ ...p, show: false })), 3500);
  };

  /* ---- Jobs ---- */
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(true);

  /* ---- Items ---- */
  const [items, setItems] = useState<JobItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  /* ---- Actions on selected ---- */
  const [connectNote, setConnectNote] = useState('');
  const [messageText, setMessageText] = useState('');
  const [importingLeads, setImportingLeads] = useState(false);

  /* ---- Campaign options ---- */
  const { options: campaignOptions, loading: campaignsLoading, error: campaignsError } = useCampaignOptions();
  const [selectedCampaignId, setSelectedCampaignId] = useState('');

  useEffect(() => {
    if (selectedCampaignId || campaignsLoading) return;
    if (campaignOptions.length > 0) setSelectedCampaignId(campaignOptions[0].id);
  }, [campaignOptions, campaignsLoading, selectedCampaignId]);

  /* ---- Load jobs ---- */
  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const resp = await apiGet('/api/sniper/jobs?limit=50');
      setJobs(Array.isArray(resp) ? resp as Job[] : ((resp as Record<string, unknown>)?.jobs as Job[] || []));
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to load activity', 'error');
    } finally {
      setLoadingJobs(false);
    }
  };

  /* ---- Load items ---- */
  const loadItems = async (jobId: string) => {
    setLoadingItems(true);
    try {
      const resp = await apiGet(`/api/sniper/jobs/${jobId}/items?limit=2000`);
      setItems(Array.isArray(resp) ? resp as JobItem[] : ((resp as Record<string, unknown>)?.items as JobItem[] || []));
      setSelectedUrls(new Set());
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to load job items', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (selectedJobId) loadItems(selectedJobId); }, [selectedJobId]);

  /* ---- Derived data ---- */
  const extractItems = useMemo(() => items.filter((i) => i.action_type === 'extract'), [items]);
  const connectItems = useMemo(() => items.filter((i) => i.action_type === 'connect'), [items]);
  const messageItems = useMemo(() => items.filter((i) => i.action_type === 'message'), [items]);
  const selectedList = useMemo(() => Array.from(selectedUrls), [selectedUrls]);

  const toggleUrl = (url: string) => {
    const next = new Set(selectedUrls);
    if (next.has(url)) next.delete(url); else next.add(url);
    setSelectedUrls(next);
  };

  const selectAll = () => {
    const urls = extractItems.map((i) => i.profile_url).filter(Boolean);
    setSelectedUrls(new Set(urls));
  };

  const clearSelection = () => setSelectedUrls(new Set());

  /* ---- Actions ---- */
  const queueConnect = async () => {
    if (!selectedList.length) return showToast('Select at least 1 profile', 'error');
    try {
      const resp = await apiPost('/api/sniper/actions/connect', { profile_urls: selectedList, note: connectNote || null }) as Record<string, unknown>;
      showToast('Queued connection requests', 'success');
      if (resp.job_id) { await loadJobs(); setSelectedJobId(String(resp.job_id)); }
    } catch (e: unknown) { showToast((e as Error)?.message || 'Failed to queue connects', 'error'); }
  };

  const queueMessage = async () => {
    if (!selectedList.length) return showToast('Select at least 1 profile', 'error');
    if (!messageText.trim()) return showToast('Message is required', 'error');
    try {
      const resp = await apiPost('/api/sniper/actions/message', { profile_urls: selectedList, message: messageText.trim() }) as Record<string, unknown>;
      showToast('Queued messages', 'success');
      if (resp.job_id) { await loadJobs(); setSelectedJobId(String(resp.job_id)); }
    } catch (e: unknown) { showToast((e as Error)?.message || 'Failed to queue messages', 'error'); }
  };

  const importToLeads = async () => {
    if (!selectedList.length) return showToast('Select at least 1 profile', 'error');
    setImportingLeads(true);
    try {
      const resp = await apiPost('/api/sniper/actions/import_to_leads', { profile_urls: selectedList, campaign_id: selectedCampaignId || null }) as Record<string, unknown>;
      const inserted = Number(resp?.inserted || 0);
      const updated = Number(resp?.updated || 0);
      showToast(`Added to leads: ${inserted} new${updated ? `, ${updated} updated` : ''}`, 'success');
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Failed to add to leads', 'error');
    } finally {
      setImportingLeads(false);
    }
  };

  /* ---- Input classes ---- */
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  const btnOutline = 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';

  /* ---- Render ---- */
  return (
    <div>
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Activity Log</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track every extraction, connection, and message your automation has executed.
          </p>
        </div>
        <button type="button" onClick={loadJobs} disabled={loadingJobs} className={btnOutline}>
          {loadingJobs ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Master-detail layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Job list */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            Jobs
          </div>
          {loadingJobs ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">
                {'\uD83D\uDCCA'}
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">No jobs yet</div>
              <div className="mt-1 text-xs text-slate-400">Run a mission to see activity here.</div>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((j) => {
                const meta = jobLabel(j.job_type);
                const active = selectedJobId === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setSelectedJobId(j.id)}
                    className={cx(
                      'w-full text-left px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      active && 'bg-indigo-50 dark:bg-indigo-950/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{meta.emoji}</span>
                        <span className="text-sm font-semibold truncate">{meta.label}</span>
                      </div>
                      <StatusPill status={j.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(j.created_at)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Job detail */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Job Items</span>
            {selectedJobId && !loadingItems && (
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Extract: {extractItems.length}</span>
                <span>Connect: {connectItems.length}</span>
                <span>Message: {messageItems.length}</span>
              </div>
            )}
          </div>

          {!selectedJobId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">
                {'\u2190'}
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Select a job</div>
              <div className="mt-1 text-xs text-slate-400">Click a job on the left to view details.</div>
            </div>
          ) : loadingItems ? (
            <div className="p-6 text-sm text-slate-500">Loading items...</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Extracted profiles */}
              {extractItems.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Extracted profiles ({extractItems.length})
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={selectAll} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                        Select all
                      </button>
                      <button type="button" onClick={clearSelection} className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-60 overflow-auto space-y-1">
                    {extractItems.slice(0, 2000).map((it) => (
                      <label key={it.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <input
                          type="checkbox"
                          checked={selectedUrls.has(it.profile_url)}
                          onChange={() => toggleUrl(it.profile_url)}
                          className="mt-1 accent-indigo-600"
                        />
                        <div className="min-w-0 flex-1">
                          <a
                            className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline truncate block text-xs"
                            href={it.profile_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {it.profile_url}
                          </a>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {it.status}
                            {(it.result_json as Record<string, unknown>)?.name ? ` \u00B7 ${String((it.result_json as Record<string, unknown>).name)}` : ''}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions on selected */}
              {extractItems.length > 0 && (
                <div className="p-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Actions on selected ({selectedList.length})
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Connect */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Connect request</div>
                      <textarea
                        className={cx(inputCls, 'mt-2')}
                        rows={3}
                        value={connectNote}
                        onChange={(e) => setConnectNote(e.target.value)}
                        placeholder="Optional note..."
                      />
                      <button
                        type="button"
                        onClick={queueConnect}
                        disabled={!selectedList.length}
                        className={cx(
                          'mt-2 w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500',
                          !selectedList.length && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        Queue Connect
                      </button>
                    </div>

                    {/* Message */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Message (1st-degree)</div>
                      <textarea
                        className={cx(inputCls, 'mt-2')}
                        rows={3}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Write the message to send..."
                      />
                      <button
                        type="button"
                        onClick={queueMessage}
                        disabled={!selectedList.length || !messageText.trim()}
                        className={cx(
                          'mt-2 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500',
                          (!selectedList.length || !messageText.trim()) && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        Queue Message
                      </button>
                    </div>

                    {/* Import to leads */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Add to Leads</div>
                      <div className="mt-1 text-xs text-slate-500">Saves profiles to your lead list.</div>
                      <select
                        className={cx(inputCls, 'mt-2')}
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        disabled={campaignsLoading || !campaignOptions.length}
                      >
                        {!campaignOptions.length ? (
                          <option value="">{campaignsLoading ? 'Loading...' : 'No campaigns'}</option>
                        ) : (
                          campaignOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        )}
                      </select>
                      {campaignsError && <div className="mt-1 text-xs text-rose-500">{campaignsError}</div>}
                      <button
                        type="button"
                        onClick={importToLeads}
                        disabled={!selectedList.length || importingLeads || !campaignOptions.length}
                        className={cx(
                          'mt-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600',
                          (!selectedList.length || importingLeads || !campaignOptions.length) && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        {importingLeads ? 'Adding...' : 'Add to Leads'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* No extract items */}
              {extractItems.length === 0 && connectItems.length === 0 && messageItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-sm text-slate-500 dark:text-slate-400">No items found for this job yet.</div>
                </div>
              )}

              {/* Execution log */}
              {(connectItems.length > 0 || messageItems.length > 0) && (
                <div className="p-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Execution log</div>
                  <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Profile</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Status</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[...connectItems, ...messageItems].map((it) => (
                          <tr key={it.id}>
                            <td className="px-3 py-2 text-xs">
                              <span className={cx(
                                'rounded-full px-2 py-0.5 font-semibold',
                                it.action_type === 'connect'
                                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200'
                                  : 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200',
                              )}>
                                {it.action_type}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <a
                                className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 underline truncate block max-w-[200px] text-xs"
                                href={it.profile_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {it.profile_url}
                              </a>
                            </td>
                            <td className="px-3 py-2"><StatusPill status={it.status} /></td>
                            <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{it.error_message || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
