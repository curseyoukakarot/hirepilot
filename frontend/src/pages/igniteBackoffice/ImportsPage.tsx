import React, { useRef, useState } from 'react';
import IgniteBackofficeLayout from './components/IgniteBackofficeLayout';
import './igniteBackoffice.css';
import { apiGet, apiPost, apiPostForm } from '../../lib/api';

type ImportBatch = {
  id: string;
  filename: string;
  created_at: string;
  rows_total: number;
  rows_imported: number;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  created_by?: string | null;
};

type Step = 1 | 2 | 3 | 4;

type ColumnMapping = {
  date: string;
  description: string;
  type: string;
  status: string;
  inbound: string;
  outbound: string;
  notes: string;
};

function formatDateTime(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusBadge(status: ImportBatch['status']) {
  if (status === 'completed') return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-800';
  if (status === 'pending') return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-400 border border-blue-800';
  if (status === 'failed') return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-800';
  return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600';
}

export default function ImportsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadedBatch, setUploadedBatch] = useState<ImportBatch | null>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, any>>>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: 'date',
    description: 'description',
    type: 'type',
    status: 'status',
    inbound: 'inbound',
    outbound: 'outbound',
    notes: 'notes',
  });

  const loadHistory = async () => {
    try {
      setError(null);
      setLoadingHistory(true);
      const response = await apiGet('/api/ignite/backoffice/imports');
      setHistory(((response as any)?.batches || []) as ImportBatch[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load import history');
    } finally {
      setLoadingHistory(false);
    }
  };

  React.useEffect(() => {
    void loadHistory();
  }, []);

  const onDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    setSelectedFileName(file?.name || '');
    setUploadedBatch(null);
    setPreviewRows([]);
    setCurrentStep(1);
  };

  const uploadSelectedFile = async () => {
    if (!selectedFile) return;
    try {
      setSaving(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await apiPostForm('/api/ignite/backoffice/imports/upload', formData);
      setUploadedBatch(((response as any)?.batch || null) as ImportBatch | null);
      setPreviewRows(Array.isArray((response as any)?.preview) ? ((response as any).preview as Array<Record<string, any>>) : []);
      setCurrentStep(2);
      await loadHistory();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const commitUploadedBatch = async () => {
    if (!uploadedBatch?.id) return;
    try {
      setSaving(true);
      setError(null);
      await apiPost(`/api/ignite/backoffice/imports/${uploadedBatch.id}/commit`, {});
      setUploadedBatch(null);
      setSelectedFile(null);
      setSelectedFileName('');
      setPreviewRows([]);
      setCurrentStep(1);
      await loadHistory();
    } catch (e: any) {
      setError(e?.message || 'Commit failed');
    } finally {
      setSaving(false);
    }
  };

  const rollbackBatch = async (batchId: string) => {
    try {
      setSaving(true);
      setError(null);
      await apiPost(`/api/ignite/backoffice/imports/${batchId}/rollback`, {});
      await loadHistory();
    } catch (e: any) {
      setError(e?.message || 'Rollback failed');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'date,description,type,account,inbound,outbound,status,event,notes\n2026-02-17,Sample Row,invoice,Operating,1000,0,paid,Event A,Imported template';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ignite_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewColumns = React.useMemo(() => {
    if (!previewRows.length) return [];
    const first = previewRows[0] || {};
    return Object.keys(first);
  }, [previewRows]);

  const stepDotClass = (step: Step) =>
    currentStep === step
      ? 'w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-semibold text-sm'
      : currentStep > step
        ? 'w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold text-sm'
        : 'w-10 h-10 bg-gray-700 text-gray-400 rounded-full flex items-center justify-center font-semibold text-sm';

  const stepLabelClass = (step: Step) =>
    currentStep === step ? 'text-xs font-medium text-primary mt-2' : 'text-xs font-medium text-gray-400 mt-2';

  const validationSummary = React.useMemo(() => {
    const total = previewRows.length;
    const missingDate = previewRows.filter((row) => !String(row[columnMapping.date] || '').trim()).length;
    const missingDescription = previewRows.filter((row) => !String(row[columnMapping.description] || '').trim()).length;
    return {
      total,
      valid: Math.max(0, total - missingDate - missingDescription),
      warnings: missingDate + missingDescription,
    };
  }, [previewRows, columnMapping.date, columnMapping.description]);

  return (
    <IgniteBackofficeLayout>
      <div className="ignite-backoffice-scrollbar-hide bg-gray-900 font-sans min-h-screen">
        <main id="main-content" className="flex-1 overflow-y-auto">
          <header id="header" className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
            <div className="px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">Imports</h1>
                  <p className="text-sm text-gray-400 mt-1">Upload ledger data and map columns to Ignite fields</p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition"
                >
                  <i className="fa-solid fa-download mr-2" />
                  Download Template
                </button>
              </div>
            </div>
          </header>

          <div id="import-wizard-section" className="px-8 py-6">
            <div id="stepper" className="mb-8">
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                <div className="flex flex-col items-center flex-1">
                  <div className={stepDotClass(1)}>1</div>
                  <span className={stepLabelClass(1)}>Upload File</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700 mx-4 -mt-6" />
                <div className="flex flex-col items-center flex-1">
                  <div className={stepDotClass(2)}>2</div>
                  <span className={stepLabelClass(2)}>Map Columns</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700 mx-4 -mt-6" />
                <div className="flex flex-col items-center flex-1">
                  <div className={stepDotClass(3)}>3</div>
                  <span className={stepLabelClass(3)}>Validation</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-700 mx-4 -mt-6" />
                <div className="flex flex-col items-center flex-1">
                  <div className={stepDotClass(4)}>4</div>
                  <span className={stepLabelClass(4)}>Summary</span>
                </div>
              </div>
            </div>

            {currentStep === 1 ? (
              <div id="step-1-upload" className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8 max-w-4xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white">Upload Your Ledger File</h2>
                  <p className="text-sm text-gray-400 mt-1">Drag and drop your file or click to browse</p>
                </div>
                {error ? <p className="text-center text-xs text-red-400 mb-4">{error}</p> : null}

                <div
                  id="dropzone"
                  onClick={onDropzoneClick}
                  className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center hover:border-primary transition cursor-pointer bg-gray-900"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                      <i className="fa-solid fa-cloud-arrow-up text-primary text-2xl" />
                    </div>
                    <p className="text-base font-medium text-white mb-1">Drop your file here</p>
                    <p className="text-sm text-gray-400 mb-4">or click to browse from your computer</p>
                    <p className="text-xs text-gray-500">Supports XLSX and CSV files up to 10MB</p>
                    {selectedFileName ? <p className="text-xs text-primary mt-3">Selected: {selectedFileName}</p> : null}
                  </div>
                </div>

                <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onFileChange} />

                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => void uploadSelectedFile()}
                    disabled={!selectedFileName || saving}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <i className="fa-solid fa-arrow-right ml-2" />
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div id="step-2-map" className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8 max-w-4xl mx-auto">
                <h2 className="text-xl font-bold text-white">Map Columns</h2>
                <p className="text-sm text-gray-400 mt-1">Confirm how your file columns map to Ignite ledger fields.</p>
                {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'description', label: 'Description' },
                    { key: 'type', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    { key: 'inbound', label: 'Inbound Amount' },
                    { key: 'outbound', label: 'Outbound Amount' },
                    { key: 'notes', label: 'Notes' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm text-gray-300 mb-2">{field.label}</label>
                      <select
                        value={columnMapping[field.key as keyof ColumnMapping]}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                      >
                        {previewColumns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                        {!previewColumns.length ? <option value="">No columns found</option> : null}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div id="step-3-validation" className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8 max-w-4xl mx-auto">
                <h2 className="text-xl font-bold text-white">Validation</h2>
                <p className="text-sm text-gray-400 mt-1">Preview quick import checks before summary.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-400">Rows Scanned</p>
                    <p className="text-2xl font-bold text-white">{validationSummary.total.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                    <p className="text-xs text-green-300">Valid Rows</p>
                    <p className="text-2xl font-bold text-green-300">{validationSummary.valid.toLocaleString()}</p>
                  </div>
                  <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                    <p className="text-xs text-yellow-300">Warnings</p>
                    <p className="text-2xl font-bold text-yellow-300">{validationSummary.warnings.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-300">
                    Validation is MVP-level. Required fields are `date` and `description`. You can proceed and review results in history.
                  </p>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div id="step-4-summary" className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-8 max-w-4xl mx-auto">
                <h2 className="text-xl font-bold text-white">Summary</h2>
                <p className="text-sm text-gray-400 mt-1">Confirm and commit your import batch.</p>

                <div className="mt-6 bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">File:</span> {selectedFileName || uploadedBatch?.filename || '-'}
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Batch ID:</span> {uploadedBatch?.id || '-'}
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Rows staged:</span>{' '}
                    {uploadedBatch?.rows_total?.toLocaleString() || previewRows.length.toLocaleString()}
                  </p>
                </div>

                {error ? <p className="text-xs text-red-400 mt-4">{error}</p> : null}

                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void commitUploadedBatch()}
                    disabled={!uploadedBatch?.id || saving}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Committing...' : 'Commit Import'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div id="import-history-section" className="px-8 py-6">
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700">
              <div className="px-6 py-5 border-b border-gray-700">
                <h2 className="text-lg font-bold text-white">Import History</h2>
                <p className="text-sm text-gray-400 mt-1">View and manage your previous imports</p>
              </div>

              <div id="history-table" className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date Imported</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rows Imported</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                          Loading history...
                        </td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                          No imports yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-700 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <i className={`${row.filename.toLowerCase().endsWith('.csv') ? 'fa-solid fa-file-csv text-blue-500' : 'fa-solid fa-file-excel text-green-500'} mr-3`} />
                              <span className="text-sm font-medium text-white">{row.filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">{formatDateTime(row.created_at)}</td>
                          <td className="px-6 py-4 text-sm text-white font-medium">{(row.rows_imported || row.rows_total || 0).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span className="text-sm text-gray-400">{row.created_by || 'Ignite User'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={statusBadge(row.status)}>{row.status.replace('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => void rollbackBatch(row.id)}
                              disabled={saving || row.status !== 'completed'}
                              className={`text-sm font-medium ${row.status === 'completed' ? 'text-red-400 hover:text-red-300' : 'text-gray-500 cursor-not-allowed'}`}
                            >
                              <i className="fa-solid fa-rotate-left mr-1" />
                              Undo
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </IgniteBackofficeLayout>
  );
}
