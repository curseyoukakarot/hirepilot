import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPost } from '../../lib/api';

type ProposalBundle = {
  proposal: any;
  options: any[];
  line_items: any[];
  versions: any[];
};

type ExportRow = {
  id: string;
  proposal_id: string;
  export_type: string;
  export_view: string;
  status: string;
  created_at: string;
  file_url: string | null;
};

function money(value: any): string {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function IgniteProposalViewerPage() {
  const navigate = useNavigate();
  const { proposalId } = useParams();
  const [bundle, setBundle] = useState<ProposalBundle | null>(null);
  const [computed, setComputed] = useState<any>(null);
  const [exportsRows, setExportsRows] = useState<ExportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const proposal = bundle?.proposal || null;
  const assumptions = (proposal?.assumptions_json || {}) as Record<string, any>;
  const event = (assumptions.event || {}) as Record<string, any>;
  const status = String(proposal?.status || 'draft').toLowerCase();
  const lastStep = Number(assumptions?.workflow?.lastStep || 1);

  async function loadData() {
    if (!proposalId) return;
    setError(null);
    try {
      const [proposalRes, computedRes] = await Promise.all([
        apiGet(`/api/ignite/proposals/${proposalId}`),
        apiGet(`/api/ignite/proposals/${proposalId}/computed`).catch(() => null),
      ]);
      setBundle(proposalRes);
      setComputed(computedRes?.proposal || null);
      const exportsRes = await apiGet('/api/ignite/exports').catch(() => ({ exports: [] }));
      const allExports = Array.isArray(exportsRes?.exports) ? exportsRes.exports : [];
      setExportsRows(
        allExports.filter((row: any) => String(row?.proposal_id || '') === String(proposalId))
      );
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load proposal'));
    }
  }

  useEffect(() => {
    void loadData();
  }, [proposalId]);

  useEffect(() => {
    if (!proposalId || !proposal) return;
    if (status !== 'draft') return;
    const step = Math.min(5, Math.max(1, Number.isFinite(lastStep) ? lastStep : 1));
    navigate(`/ignite/proposals/new?proposalId=${proposalId}&step=${step}`, { replace: true });
  }, [proposalId, proposal, status, lastStep, navigate]);

  const selected = useMemo(() => {
    const options = Array.isArray(computed?.options) ? computed.options : [];
    return options.find((item: any) => item?.isRecommended) || options[0] || null;
  }, [computed]);

  const total = Number(selected?.totals?.total || 0);
  const subtotal = Number(selected?.totals?.subtotal || 0);
  const fee = Number(selected?.totals?.fee || 0);
  const contingency = Number(selected?.totals?.contingency || 0);

  async function withBusy(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      await loadData();
    } catch (e: any) {
      setError(String(e?.message || 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  const onDuplicate = () =>
    withBusy(async () => {
      const res = await apiPost(`/api/ignite/proposals/${proposalId}/duplicate`, {});
      const id = String(res?.proposal?.id || '');
      if (id) navigate(`/ignite/proposals/${id}`);
    });

  const onArchive = () =>
    withBusy(async () => {
      const confirmed = window.confirm('Archive this proposal?');
      if (!confirmed) return;
      await apiDelete(`/api/ignite/proposals/${proposalId}`);
      navigate('/ignite/proposals');
    });

  const onDownloadPdf = () =>
    withBusy(async () => {
      const res = await apiPost(`/api/ignite/proposals/${proposalId}/export/pdf`, {
        export_view: 'client',
        option_id: selected?.id || null,
      });
      const url = res?.export?.file_url ? String(res.export.file_url) : null;
      if (url) window.open(url, '_blank');
    });

  const onDownloadXlsx = () =>
    withBusy(async () => {
      const res = await apiPost(`/api/ignite/proposals/${proposalId}/export/xlsx`, { export_view: 'internal' });
      const url = res?.export?.file_url ? String(res.export.file_url) : null;
      if (url) window.open(url, '_blank');
    });

  const onShareLink = () =>
    withBusy(async () => {
      const res = await apiPost(`/api/ignite/proposals/${proposalId}/share-link`, {});
      const token = String(res?.share?.token || '');
      if (token) {
        const link = `${window.location.origin}/share/${token}`;
        setShareUrl(link);
        await navigator.clipboard.writeText(link);
      }
    });

  const onSendEmail = () =>
    withBusy(async () => {
      await apiPost(`/api/ignite/proposals/${proposalId}/send-email`, {});
      alert('Email stub called successfully.');
    });

  const onSendSignature = () =>
    withBusy(async () => {
      await apiPost(`/api/ignite/proposals/${proposalId}/send-docusign`, {
        option_id: selected?.id || null,
      });
      alert('Signature request sent.');
    });

  if (!proposal) {
    return (
      <div className="rounded-xl border border-white/10 bg-gray-800 p-6 text-gray-200">
        {error || 'Loading proposal...'}
      </div>
    );
  }

  return (
    <div className="min-h-full rounded-2xl bg-gray-900 font-inter">
      <header className="rounded-t-2xl border-b border-gray-700 bg-gray-800 px-8 py-6">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{proposal.name || computed?.eventName || 'Proposal Viewer'}</h1>
              <span className="rounded-full border border-green-700 bg-green-900/50 px-3 py-1 text-sm font-medium text-green-400">
                {status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-6 text-gray-400">
              <span className="font-medium text-indigo-400">{computed?.clientName || 'Client'}</span>
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-calendar" />
                {event.eventDate || computed?.date || 'TBD'}
              </span>
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-star" />
                {selected?.name || 'Recommended Option'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => void onDuplicate()} disabled={busy} className="rounded-lg border border-gray-600 px-4 py-2 font-medium text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50">
              <i className="fa-solid fa-copy mr-2" />
              Duplicate
            </button>
            <button onClick={() => void onArchive()} disabled={busy} className="rounded-lg border border-red-900/50 px-4 py-2 font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 disabled:opacity-50">
              <i className="fa-solid fa-archive mr-2" />
              Archive
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8">
        {error && <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {shareUrl && <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">Share link copied: {shareUrl}</div>}

        <section className="mb-8 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 p-8 text-white">
          <div className="flex flex-col justify-between gap-6 xl:flex-row">
            <div className="grid flex-1 grid-cols-2 gap-6 xl:grid-cols-3">
              <div>
                <div className="mb-1 text-sm opacity-90">Total Investment</div>
                <div className="text-3xl font-bold">{money(total)}</div>
              </div>
              <div>
                <div className="mb-1 text-sm opacity-90">Cost Subtotal</div>
                <div className="text-xl font-semibold">{money(subtotal)}</div>
              </div>
              <div>
                <div className="mb-1 text-sm opacity-90">Ignite Fee</div>
                <div className="text-xl font-semibold">{money(fee)}</div>
              </div>
              <div>
                <div className="mb-1 text-sm opacity-90">Contingency</div>
                <div className="text-xl font-semibold">{money(contingency)}</div>
              </div>
              <div>
                <div className="mb-1 text-sm opacity-90">Recommended Option</div>
                <div className="text-xl font-semibold">{selected?.name || 'Option 1'}</div>
              </div>
              <div>
                <div className="mb-1 text-sm opacity-90">Version</div>
                <div className="text-xl font-semibold">v{proposal.current_version || 1}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate(`/ignite/proposals/${proposalId}/preview`)} className="rounded-lg bg-white px-6 py-3 font-semibold text-indigo-600 hover:bg-gray-50">
                <i className="fa-solid fa-external-link mr-2" />
                View Client Page
              </button>
              <button onClick={() => void onDownloadPdf()} disabled={busy} className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50">
                <i className="fa-solid fa-download mr-2" />
                Download PDF
              </button>
              <button onClick={() => void onShareLink()} disabled={busy} className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50">
                <i className="fa-solid fa-share mr-2" />
                Create Share Link
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-6 text-2xl font-bold text-white">Export Controls</h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-800 bg-red-900/50">
                  <i className="fa-solid fa-file-pdf text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">PDF Proposal</h3>
              </div>
              <button onClick={() => void onDownloadPdf()} disabled={busy} className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-medium text-white hover:bg-indigo-400 disabled:opacity-50">
                Generate PDF
              </button>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-green-800 bg-green-900/50">
                  <i className="fa-solid fa-file-excel text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Spreadsheet Export</h3>
              </div>
              <button onClick={() => void onDownloadXlsx()} disabled={busy} className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50">
                Export XLSX
              </button>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-800 bg-blue-900/50">
                  <i className="fa-solid fa-share text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Share & Send</h3>
              </div>
              <div className="mb-4 space-y-3">
                <button onClick={() => void onSendEmail()} className="w-full rounded border border-gray-600 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700">
                  <i className="fa-solid fa-envelope mr-2" />
                  Email client
                </button>
              </div>
              <button onClick={() => void onShareLink()} disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Create Link
              </button>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-800 bg-purple-900/50">
                  <i className="fa-solid fa-signature text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Send for Signature</h3>
              </div>
              <button onClick={() => void onSendSignature()} disabled={busy} className="w-full rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                Send for Signature
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-700 bg-gray-800">
            <div className="border-b border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white">Export History</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {exportsRows.length > 0 ? (
                  exportsRows.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center justify-between border-b border-gray-700 py-3">
                      <div className="flex items-center gap-3">
                        <i
                          className={`fa-solid ${
                            row.export_type === 'xlsx'
                              ? 'fa-file-excel text-green-400'
                              : 'fa-file-pdf text-red-400'
                          }`}
                        />
                        <div>
                          <div className="font-medium text-white">
                            {String(row.export_type).toUpperCase()} Export ({row.export_view})
                          </div>
                          <div className="text-sm text-gray-400">
                            {new Date(row.created_at).toLocaleString()} - {row.status}
                          </div>
                        </div>
                      </div>
                      {row.file_url ? (
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded px-3 py-1 text-indigo-400 hover:bg-indigo-500/10"
                        >
                          <i className="fa-solid fa-download" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">No file</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-300">No export/version history yet.</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-700 bg-gray-800">
            <div className="border-b border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white">Version Control</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {(bundle?.versions || []).map((version: any) => (
                  <div key={version.id} className="flex items-center justify-between border-b border-gray-700 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
                        v{version.version_number}
                      </div>
                      <div>
                        <div className="font-medium text-white">{version.label || `Version ${version.version_number}`}</div>
                        <div className="text-sm text-gray-400">{new Date(version.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!bundle?.versions?.length && <div className="text-sm text-gray-300">No saved versions yet.</div>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

