import React from 'react';
import { apiGet, apiPost } from '../../../lib/api';

type ExportStepProps = {
  onBack: () => void;
  proposalId?: string | null;
};

type IgniteExportRow = {
  id: string;
  proposal_id: string;
  export_type: 'pdf' | 'xlsx' | string;
  status: 'queued' | 'completed' | 'failed' | string;
  created_at: string;
  file_url: string | null;
};

type IgniteVersionRow = {
  id: string;
  version_number: number;
  label: string | null;
  created_at: string;
};

export default function ExportStep({ onBack, proposalId }: ExportStepProps) {
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [xlsxBusy, setXlsxBusy] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const [exportsHistory, setExportsHistory] = React.useState<IgniteExportRow[]>([]);
  const [versions, setVersions] = React.useState<IgniteVersionRow[]>([]);
  const [shareUrl, setShareUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    if (!proposalId) return;
    setLoadingMeta(true);
    setError(null);
    try {
      const [proposalRes, exportsRes] = await Promise.all([
        apiGet(`/api/ignite/proposals/${proposalId}`),
        apiGet('/api/ignite/exports'),
      ]);
      const allExports = Array.isArray(exportsRes?.exports) ? exportsRes.exports : [];
      setExportsHistory(allExports.filter((row: IgniteExportRow) => row.proposal_id === proposalId));
      setVersions(Array.isArray(proposalRes?.versions) ? proposalRes.versions : []);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load export history'));
    } finally {
      setLoadingMeta(false);
    }
  }, [proposalId]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const ensureShareUrl = async () => {
    if (!proposalId) throw new Error('Save this proposal first to create share links.');
    if (shareUrl) return shareUrl;
    const response = await apiPost(`/api/ignite/proposals/${proposalId}/share`, {});
    const token = response?.share?.token ? String(response.share.token) : '';
    if (!token) throw new Error('Share token was not returned.');
    const url = `${window.location.origin}/share/${token}`;
    setShareUrl(url);
    return url;
  };

  const runPdf = async () => {
    try {
      if (!proposalId) throw new Error('Save this proposal before exporting.');
      setError(null);
      setPdfBusy(true);
      const response = await apiPost(`/api/ignite/proposals/${proposalId}/export/pdf`, {
        export_view: 'client',
      });
      const fileUrl = response?.export?.file_url ? String(response.export.file_url) : '';
      if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to generate PDF.'));
    } finally {
      setPdfBusy(false);
    }
  };

  const runXlsx = async () => {
    try {
      if (!proposalId) throw new Error('Save this proposal before exporting.');
      setError(null);
      setXlsxBusy(true);
      await apiPost(`/api/ignite/proposals/${proposalId}/export/xlsx`, { export_view: 'internal' });
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to export XLSX.'));
    } finally {
      setXlsxBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      setError(null);
      const url = await ensureShareUrl();
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to copy link.'));
    }
  };

  const createVersion = async () => {
    try {
      if (!proposalId) throw new Error('Save this proposal before creating a version.');
      setError(null);
      await apiPost(`/api/ignite/proposals/${proposalId}/version`, {});
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to create version.'));
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900">Step 5: Export</h2>
        <p className="mt-1 text-gray-600">Generate deliverables and share your proposal</p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-3 gap-6">
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-6">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600">
                <i className="fa-solid fa-file-pdf text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">PDF Proposal</h3>
                <p className="text-sm text-gray-600">Professional client presentation</p>
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-red-600" />
                <span className="text-sm text-gray-700">Include item-level detail</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-red-600" />
                <span className="text-sm text-gray-700">Show headcount + date header</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-300 text-red-600" />
                <span className="text-sm text-gray-700">Add signature block</span>
              </label>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={runPdf}
                disabled={pdfBusy}
                className="w-full rounded-lg bg-red-600 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-70"
              >
                <i className={`fa-solid ${pdfBusy ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />
                {pdfBusy ? 'Generating...' : 'Generate PDF'}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="w-full rounded-lg border border-red-300 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                <i className="fa-solid fa-link mr-2" />
                {linkCopied ? 'Link Copied' : 'Copy Share Link'}
              </button>
            </div>
            <div className="mt-4 rounded bg-white/50 p-2 text-xs text-gray-500">
              <i className="fa-solid fa-info-circle mr-1" />
              PDF uses the same format as Client Preview
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600">
                <i className="fa-solid fa-file-excel text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Spreadsheet Export</h3>
                <p className="text-sm text-gray-600">Raw data for analysis</p>
              </div>
            </div>
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-gray-700">Export Format:</p>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="radio" name="excel-format" defaultChecked className="text-green-600" />
                <span className="text-sm text-gray-700">Internal (shows raw cost logic)</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="radio" name="excel-format" className="text-green-600" />
                <span className="text-sm text-gray-700">Client View (clean)</span>
              </label>
            </div>
            <button
              type="button"
              onClick={runXlsx}
              disabled={xlsxBusy}
              className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-70"
            >
              <i className={`fa-solid ${xlsxBusy ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />
              {xlsxBusy ? 'Exporting...' : 'Export XLSX'}
            </button>
            <div className="mt-4 rounded bg-white/50 p-2 text-xs text-gray-500">
              <i className="fa-solid fa-table mr-1" />
              Includes all line items, calculations, and formulas
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                <i className="fa-solid fa-share text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Share & Send</h3>
                <p className="text-sm text-gray-600">Quick sharing options</p>
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <button type="button" className="w-full rounded-lg border border-blue-300 py-2.5 font-medium text-blue-700 hover:bg-blue-50">
                <i className="fa-solid fa-copy mr-2" />
                Copy Client Summary
              </button>
              <button type="button" className="w-full rounded-lg border border-blue-300 py-2 text-blue-700 hover:bg-blue-50">
                <i className="fa-solid fa-envelope mr-2" />
                Email to Client
              </button>
              <button type="button" onClick={copyLink} className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">
                <i className="fa-solid fa-link mr-2" />
                Create Proposal Link
              </button>
            </div>
            <div className="mt-4 rounded bg-white/50 p-2 text-xs text-gray-500">
              <i className="fa-solid fa-shield-alt mr-1" />
              Links are read-only and tokenized for security
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 font-medium text-gray-900">Export History</h4>
          <div className="space-y-2 text-sm">
            {loadingMeta && <div className="py-2 text-gray-500">Loading history...</div>}
            {!loadingMeta && exportsHistory.length === 0 && (
              <div className="py-2 text-gray-500">No exports yet.</div>
            )}
            {exportsHistory.slice(0, 6).map((row, idx) => (
              <div
                key={row.id}
                className={`flex items-center justify-between py-2 ${
                  idx < exportsHistory.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <i
                    className={`fa-solid ${
                      row.export_type === 'pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-excel text-green-600'
                    }`}
                  />
                  <span className="text-gray-700">
                    {String(row.export_type).toUpperCase()} export ({row.status})
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-gray-500">
                  <span>{new Date(row.created_at).toLocaleString()}</span>
                  {row.file_url ? (
                    <a href={row.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
                      <i className="fa-solid fa-download" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Version Control</h4>
            <button type="button" onClick={createVersion} className="text-sm text-blue-600 hover:text-blue-700">
              <i className="fa-solid fa-plus mr-1" />
              Create New Version
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {versions.length === 0 ? (
              <span className="text-gray-500">No versions yet.</span>
            ) : (
              versions.slice(0, 6).map((version, idx) => (
                <React.Fragment key={version.id}>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-gray-700">
                      v{version.version_number} {version.label ? `- ${version.label}` : ''}
                    </span>
                  </div>
                  {idx < Math.min(versions.length, 6) - 1 && <div className="text-gray-400">|</div>}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-6 py-2 text-gray-600 hover:bg-gray-50"
        >
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Review
        </button>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-green-600">
            <i className="fa-solid fa-check-circle mr-1" />
            Proposal ready for delivery
          </div>
          <button type="button" className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700">
            <i className="fa-solid fa-check mr-2" />
            Mark as Final
          </button>
        </div>
      </div>
    </div>
  );
}

