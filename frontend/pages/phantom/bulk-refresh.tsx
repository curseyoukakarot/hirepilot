import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

// const mockAccounts = [
//   { id: 'acc1', email: 'user1@company.com', cookieAge: 5, lastUpdated: '2024-06-01T12:00:00Z', proxy: 'US Proxy 1' },
//   { id: 'acc2', email: 'user2@company.com', cookieAge: 31, lastUpdated: '2024-06-01T10:00:00Z', proxy: 'US Proxy 2' },
//   { id: 'acc3', email: 'testuser@company.com', cookieAge: 1, lastUpdated: '2024-06-02T09:00:00Z', proxy: 'US Proxy 3' },
// ];

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Retry utility function
const retry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};

export default function BulkCookieRefresh() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inputs, setInputs] = useState<any>({});
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const { data, error } = await retry(async () => {
          const result = await supabase.from('linkedin_accounts').select('*');
          if (result.error) throw result.error;
          return result;
        });
        
        setAccounts(data || []);
        toast.success('Accounts loaded successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch accounts';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleSelect = (id: string) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  };

  const handleInput = (id: string, field: string, value: string | boolean) => {
    setInputs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? accounts.map(a => a.id) : []);
  };

  const handleBulkUpdate = async () => {
    setLoading(true);
    setError('');
    try {
      const selectedAccounts = accounts.filter(acc => selectedIds.includes(acc.id));
      const payload = selectedAccounts.map(acc => ({
        id: acc.id,
        ...inputs[acc.id]
      }));
      
      const response = await retry(() => fetch('/api/phantom/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply bulk update');
      }
      
      setSuccess('Bulk update applied successfully!');
      toast.success('Bulk update applied successfully!');
      
      // Refresh the accounts list
      const { data, error } = await supabase.from('linkedin_accounts').select('*');
      if (!error) {
        setAccounts(data || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply bulk update';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const rows = text.split('\n').map(r => r.split(','));
      setCsvPreview(rows);
      setShowCsvModal(true);
      setLoading(true);
      
      try {
        const response = await retry(() => fetch('/api/phantom/csv-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: rows })
        }));
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload CSV');
        }
        
        setSuccess('CSV uploaded successfully!');
        toast.success('CSV uploaded successfully!');
        
        // Refresh the accounts list
        const { data, error } = await supabase.from('linkedin_accounts').select('*');
        if (!error) {
          setAccounts(data || []);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload CSV';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExtensionSync = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await retry(() => fetch('/api/phantom/extension-sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync with extension');
      }
      
      setSuccess('Extension sync completed successfully!');
      toast.success('Extension sync completed successfully!');
      
      // Refresh the accounts list
      const { data, error } = await supabase.from('linkedin_accounts').select('*');
      if (!error) {
        setAccounts(data || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync with extension';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = accounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(accounts.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">Bulk Cookie Refresh</h1>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded shadow mr-2" onClick={handleBulkUpdate} disabled={selectedIds.length === 0 || loading}>Apply Bulk Update</button>
            <button className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm px-4 py-2 rounded shadow" onClick={() => setShowCsvModal(true)} disabled={loading}>Upload CSV</button>
          </div>
          <button className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded shadow" onClick={handleExtensionSync} disabled={loading}>Auto-Fetch From Extension</button>
        </div>
        {success && <div className="text-green-600 text-sm mb-2">{success}</div>}
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {loading && <LoadingSpinner />}
        <div className="overflow-x-auto rounded-xl shadow bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2"><input type="checkbox" checked={selectedIds.length === accounts.length} onChange={e => handleSelectAll(e.target.checked)} /></th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">Email</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">Current Cookie Age</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">Last Updated</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">Proxy Location</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">New Cookie</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">New User Agent</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">Reset Cooldown?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.map(acc => (
                <tr key={acc.id} className={selectedIds.includes(acc.id) ? 'bg-blue-50' : ''}>
                  <td className="px-2 py-2 text-center"><input type="checkbox" checked={selectedIds.includes(acc.id)} onChange={() => handleSelect(acc.id)} /></td>
                  <td className="px-2 py-2 text-xs font-mono">{acc.email}</td>
                  <td className="px-2 py-2 text-xs text-center">{acc.cookieAge}</td>
                  <td className="px-2 py-2 text-xs">{new Date(acc.lastUpdated).toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs">{acc.proxy}</td>
                  <td className="px-2 py-2"><input className="w-full border rounded px-2 py-1 text-xs font-mono" type="password" placeholder="New li_at" value={inputs[acc.id]?.liat || ''} onChange={e => handleInput(acc.id, 'liat', e.target.value)} /></td>
                  <td className="px-2 py-2"><input className="w-full border rounded px-2 py-1 text-xs font-mono" placeholder="New user agent" value={inputs[acc.id]?.userAgent || ''} onChange={e => handleInput(acc.id, 'userAgent', e.target.value)} /></td>
                  <td className="px-2 py-2 text-center"><input type="checkbox" checked={!!inputs[acc.id]?.resetCooldown} onChange={e => handleInput(acc.id, 'resetCooldown', e.target.checked)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm px-4 py-2 rounded shadow" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
          <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
          <button className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm px-4 py-2 rounded shadow" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
        </div>
        {/* CSV Upload Modal (placeholder) */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full relative">
              <button className="absolute top-2 right-2 text-slate-400 hover:text-slate-600" onClick={() => setShowCsvModal(false)}>&times;</button>
              <h2 className="text-lg font-bold mb-2">Upload CSV</h2>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="mb-4" />
              {csvPreview.length > 0 && (
                <div className="overflow-x-auto max-h-48 mb-4">
                  <table className="min-w-full text-xs">
                    <thead><tr>{csvPreview[0].map((h: string, i: number) => <th key={i} className="px-2 py-1 bg-slate-100">{h}</th>)}</tr></thead>
                    <tbody>{csvPreview.slice(1).map((row, i) => <tr key={i}>{row.map((cell: string, j: number) => <td key={j} className="px-2 py-1">{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow" onClick={() => { setShowCsvModal(false); setSuccess('CSV uploaded! (mock)'); }}>Apply CSV (mock)</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 