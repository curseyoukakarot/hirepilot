import React from 'react';
import { apiGet, apiPatch, apiPost } from '../../../lib/api';

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

type IgniteDocusignEnvelope = {
  id: string;
  envelope_id: string;
  status: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_title: string | null;
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
  const [signerName, setSignerName] = React.useState('');
  const [signerEmail, setSignerEmail] = React.useState('');
  const [signerTitle, setSignerTitle] = React.useState('');
  const [signerCompany, setSignerCompany] = React.useState('');
  const [docusignBusy, setDocusignBusy] = React.useState(false);
  const [docusignEnvelope, setDocusignEnvelope] = React.useState<IgniteDocusignEnvelope | null>(null);
  const [proposalStatus, setProposalStatus] = React.useState('');
  const [finalizeBusy, setFinalizeBusy] = React.useState(false);

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
      setProposalStatus(String(proposalRes?.proposal?.status || ''));
      const agreement = proposalRes?.proposal?.assumptions_json?.agreement || {};
      if (agreement && typeof agreement === 'object') {
        setSignerName((prev) => prev || String(agreement.signerName || ''));
        setSignerEmail((prev) => prev || String(agreement.signerEmail || ''));
        setSignerTitle((prev) => prev || String(agreement.signerTitle || ''));
        setSignerCompany((prev) => prev || String(agreement.signerCompany || ''));
      }
    } catch (e: any) {
      setError(String(e?.message || 'Failed to load export history'));
    } finally {
      setLoadingMeta(false);
    }
  }, [proposalId]);

  const loadSignatureStatus = React.useCallback(async () => {
    if (!proposalId) return;
    try {
      const response = await apiGet(`/api/ignite/proposals/${proposalId}/docusign/status`);
      setDocusignEnvelope((response?.envelope as IgniteDocusignEnvelope) || null);
    } catch {
      // Non-blocking for export UX.
    }
  }, [proposalId]);

  React.useEffect(() => {
    void loadHistory();
    void loadSignatureStatus();
  }, [loadHistory, loadSignatureStatus]);

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

  const sendForSignature = async () => {
    try {
      if (!proposalId) throw new Error('Save this proposal before sending for signature.');
      if (!signerName.trim()) throw new Error('Signer name is required.');
      if (!signerEmail.trim()) throw new Error('Signer email is required.');
      setError(null);
      setDocusignBusy(true);
      const response = await apiPost(`/api/ignite/proposals/${proposalId}/docusign/send`, {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim(),
        signer_title: signerTitle.trim() || null,
        signer_company: signerCompany.trim() || null,
      });
      setDocusignEnvelope((response?.envelope as IgniteDocusignEnvelope) || null);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to send agreement for signature.'));
    } finally {
      setDocusignBusy(false);
    }
  };

  const markAsFinal = async () => {
    try {
      if (!proposalId) throw new Error('Save this proposal before marking final.');
      if (String(proposalStatus || '').toLowerCase() === 'final') return;
      setError(null);
      setFinalizeBusy(true);
      await apiPatch(`/api/ignite/proposals/${proposalId}`, { status: 'final' });
      await loadHistory();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to mark proposal as final.'));
    } finally {
      setFinalizeBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/45 shadow-lg shadow-black/20">
      <div className="border-b border-slate-700/70 p-6">
        <h2 className="text-xl font-semibold text-slate-100">Step 5: Export</h2>
        <p className="mt-1 text-slate-300">Generate deliverables and share your proposal</p>
      </div>

      <div className="p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-xl border border-rose-500/35 bg-gradient-to-br from-rose-500/15 to-red-500/10 p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/90">
                <i className="fa-solid fa-file-pdf text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-rose-100">PDF Proposal</h3>
                <p className="text-sm text-rose-200/85">Professional client presentation</p>
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded border-rose-300/40 bg-slate-950 text-rose-400 focus:ring-rose-400/40" />
                <span className="text-sm text-rose-100">Include item-level detail</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" defaultChecked className="rounded border-rose-300/40 bg-slate-950 text-rose-400 focus:ring-rose-400/40" />
                <span className="text-sm text-rose-100">Show headcount + date header</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="checkbox" className="rounded border-rose-300/40 bg-slate-950 text-rose-400 focus:ring-rose-400/40" />
                <span className="text-sm text-rose-100">Add signature block</span>
              </label>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={runPdf}
                disabled={pdfBusy}
                className="w-full rounded-lg bg-rose-500 py-2.5 font-medium text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <i className={`fa-solid ${pdfBusy ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />
                {pdfBusy ? 'Generating...' : 'Generate PDF'}
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="w-full rounded-lg border border-rose-300/40 bg-rose-500/10 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
              >
                <i className="fa-solid fa-link mr-2" />
                {linkCopied ? 'Link Copied' : 'Copy Share Link'}
              </button>
            </div>
            <div className="mt-4 rounded border border-rose-400/25 bg-slate-950/40 p-2 text-xs text-rose-100/80">
              <i className="fa-solid fa-info-circle mr-1" />
              PDF uses the same format as Client Preview
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-green-500/10 p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/90">
                <i className="fa-solid fa-file-excel text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-100">Spreadsheet Export</h3>
                <p className="text-sm text-emerald-200/85">Raw data for analysis</p>
              </div>
            </div>
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-emerald-100">Export Format:</p>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="radio" name="excel-format" defaultChecked className="text-emerald-400 focus:ring-emerald-400/40" />
                <span className="text-sm text-emerald-100">Internal (shows raw cost logic)</span>
              </label>
              <label className="flex cursor-pointer items-center space-x-2">
                <input type="radio" name="excel-format" className="text-emerald-400 focus:ring-emerald-400/40" />
                <span className="text-sm text-emerald-100">Client View (clean)</span>
              </label>
            </div>
            <button
              type="button"
              onClick={runXlsx}
              disabled={xlsxBusy}
              className="w-full rounded-lg bg-emerald-500 py-2.5 font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <i className={`fa-solid ${xlsxBusy ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />
              {xlsxBusy ? 'Exporting...' : 'Export XLSX'}
            </button>
            <div className="mt-4 rounded border border-emerald-400/25 bg-slate-950/40 p-2 text-xs text-emerald-100/80">
              <i className="fa-solid fa-table mr-1" />
              Includes all line items, calculations, and formulas
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/35 bg-gradient-to-br from-indigo-500/15 to-blue-500/10 p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/90">
                <i className="fa-solid fa-share text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-indigo-100">Share & Send</h3>
                <p className="text-sm text-indigo-200/85">Quick sharing options</p>
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <button type="button" className="w-full rounded-lg border border-indigo-300/40 bg-indigo-500/10 py-2.5 font-medium text-indigo-100 hover:bg-indigo-500/20">
                <i className="fa-solid fa-copy mr-2" />
                Copy Client Summary
              </button>
              <button type="button" className="w-full rounded-lg border border-indigo-300/40 bg-indigo-500/10 py-2 text-indigo-100 hover:bg-indigo-500/20">
                <i className="fa-solid fa-envelope mr-2" />
                Email to Client
              </button>
              <button type="button" onClick={copyLink} className="w-full rounded-lg bg-indigo-500 py-2 text-white hover:bg-indigo-400">
                <i className="fa-solid fa-link mr-2" />
                Create Proposal Link
              </button>
            </div>
            <div className="mt-4 rounded border border-indigo-400/25 bg-slate-950/40 p-2 text-xs text-indigo-100/80">
              <i className="fa-solid fa-shield-alt mr-1" />
              Links are read-only and tokenized for security
            </div>
          </div>

          <div className="rounded-xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500/90">
                <i className="fa-solid fa-signature text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-fuchsia-100">Send for Signature</h3>
                <p className="text-sm text-fuchsia-200/85">Zapier to DocuSign workflow</p>
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Signer full name"
                className="w-full rounded-lg border border-fuchsia-300/40 bg-slate-950/40 px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-200/50 focus:border-fuchsia-300 focus:outline-none"
              />
              <input
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="Signer email"
                className="w-full rounded-lg border border-fuchsia-300/40 bg-slate-950/40 px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-200/50 focus:border-fuchsia-300 focus:outline-none"
              />
              <input
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="Signer title (optional)"
                className="w-full rounded-lg border border-fuchsia-300/40 bg-slate-950/40 px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-200/50 focus:border-fuchsia-300 focus:outline-none"
              />
              <input
                value={signerCompany}
                onChange={(e) => setSignerCompany(e.target.value)}
                placeholder="Legal entity (optional)"
                className="w-full rounded-lg border border-fuchsia-300/40 bg-slate-950/40 px-3 py-2 text-sm text-fuchsia-100 placeholder-fuchsia-200/50 focus:border-fuchsia-300 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={sendForSignature}
              disabled={docusignBusy}
              className="w-full rounded-lg bg-fuchsia-500 py-2.5 font-medium text-white hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <i className={`fa-solid ${docusignBusy ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-2`} />
              {docusignBusy ? 'Sending...' : 'Send via Zapier'}
            </button>
            <div className="mt-4 rounded border border-fuchsia-400/25 bg-slate-950/40 p-2 text-xs text-fuchsia-100/80">
              <i className="fa-solid fa-circle-info mr-1" />
              Status: {docusignEnvelope?.status || 'Not sent yet'}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-slate-700/70 bg-slate-900/55 p-4">
          <h4 className="mb-3 font-medium text-slate-100">Export History</h4>
          <div className="space-y-2 text-sm">
            {loadingMeta && <div className="py-2 text-slate-400">Loading history...</div>}
            {!loadingMeta && exportsHistory.length === 0 && (
              <div className="py-2 text-slate-400">No exports yet.</div>
            )}
            {exportsHistory.slice(0, 6).map((row, idx) => (
              <div
                key={row.id}
                className={`flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between ${
                  idx < exportsHistory.length - 1 ? 'border-b border-slate-700/60' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <i
                    className={`fa-solid ${
                      row.export_type === 'pdf' ? 'fa-file-pdf text-rose-300' : 'fa-file-excel text-emerald-300'
                    }`}
                  />
                  <span className="text-slate-200">
                    {String(row.export_type).toUpperCase()} export ({row.status})
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-slate-400">
                  <span>{new Date(row.created_at).toLocaleString()}</span>
                  {row.file_url ? (
                    <a href={row.file_url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
                      <i className="fa-solid fa-download" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-700/70 bg-slate-900/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-slate-100">Version Control</h4>
            <button type="button" onClick={createVersion} className="text-sm text-indigo-300 hover:text-indigo-200">
              <i className="fa-solid fa-plus mr-1" />
              Create New Version
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {versions.length === 0 ? (
              <span className="text-slate-400">No versions yet.</span>
            ) : (
              versions.slice(0, 6).map((version, idx) => (
                <React.Fragment key={version.id}>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-200">
                      v{version.version_number} {version.label ? `- ${version.label}` : ''}
                    </span>
                  </div>
                  {idx < Math.min(versions.length, 6) - 1 && <div className="text-slate-500">|</div>}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-700/70 bg-slate-900/45 p-4 sm:flex-row sm:items-center sm:p-6">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-600/80 px-6 py-2 text-slate-300 hover:bg-slate-800/70"
        >
          <i className="fa-solid fa-arrow-left mr-2" />
          Back to Review
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-emerald-300">
            <i className="fa-solid fa-check-circle mr-1" />
            Proposal ready for delivery
          </div>
          <button
            type="button"
            onClick={markAsFinal}
            disabled={finalizeBusy || String(proposalStatus || '').toLowerCase() === 'final'}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-check mr-2" />
            {String(proposalStatus || '').toLowerCase() === 'final'
              ? 'Already Final'
              : finalizeBusy
              ? 'Marking...'
              : 'Mark as Final'}
          </button>
        </div>
      </div>
    </div>
  );
}

