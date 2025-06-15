import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

const REQUIRED_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'tags', label: 'Tags (comma separated)' },
  { key: 'location', label: 'Location' },
  { key: 'source', label: 'Source' },
  { key: 'linkedin_url', label: 'LinkedIn Profile' },
];

function guessMapping(headers, fieldKey) {
  const lowerKey = fieldKey.toLowerCase();
  const match = headers.find(h => h.toLowerCase() === lowerKey || h.toLowerCase().replace(/\s|_/g, '') === lowerKey.replace(/\s|_/g, ''));
  if (match) return match;
  if (fieldKey === 'first_name') return headers.find(h => h.toLowerCase().includes('first'));
  if (fieldKey === 'last_name') return headers.find(h => h.toLowerCase().includes('last'));
  if (fieldKey === 'company') return headers.find(h => h.toLowerCase().includes('org') || h.toLowerCase().includes('company'));
  return '';
}

export default function CsvImportButton({ onImportComplete }) {
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawRows(results.data);
        const initialMapping = {};
        REQUIRED_FIELDS.forEach(f => {
          initialMapping[f.key] = guessMapping(headers, f.key) || '';
        });
        setFieldMapping(initialMapping);
        setShowMappingModal(true);
        setLoading(false);
      },
      error: (err) => {
        setError(err.message || 'Failed to parse CSV');
        setLoading(false);
      }
    });
  };

  const applyMapping = (mapping, rows) => {
    const allowedStatuses = ['completed', 'New', 'Messaged'];
    return rows.map((row) => {
      const mapped = {};
      REQUIRED_FIELDS.forEach(f => {
        if (f.key === 'tags') {
          mapped.tags = row[mapping[f.key]]
            ? row[mapping[f.key]].split(',').map(t => t.trim()).filter(Boolean)
            : [];
        } else if (['location', 'source'].includes(f.key)) {
          // Do not set as top-level, will go in enrichment_data
        } else if (f.key === 'linkedin_url') {
          mapped.linkedin_url = row[mapping[f.key]] || '';
        } else {
          mapped[f.key] = row[mapping[f.key]] || '';
        }
      });
      mapped.name = `${mapped.first_name} ${mapped.last_name}`.trim();
      if (row.id && /^[0-9a-fA-F-]{36}$/.test(row.id)) {
        mapped.id = row.id;
      }
      const status = row.status || '';
      mapped.status = allowedStatuses.includes(status) ? status : 'New';
      // Build enrichment_data
      mapped.enrichment_data = JSON.stringify({
        location: row[mapping['location']] || '',
        source: row[mapping['source']] || 'CSV Import',
      });
      return mapped;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const mappedLeads = applyMapping(fieldMapping, rawRows);
      
      // Insert leads into the leads table
      const { error } = await supabase
        .from('leads')
        .insert(mappedLeads.map(lead => ({
          ...lead,
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));

      if (error) throw error;
      
      toast.success(`Successfully imported ${mappedLeads.length} leads!`);
      setShowMappingModal(false);
      onImportComplete?.(); // Trigger refresh of leads list
    } catch (err) {
      toast.error(err.message || 'Failed to import leads');
      setError(err.message || 'Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  // Modal component
  const MappingModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8 relative animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-center">Import Leads from CSV</h2>
        <p className="mb-6 text-gray-600 text-center">Map your CSV columns to the required fields below. This ensures your leads are imported correctly.</p>
        <div className="space-y-4 mb-6">
          {REQUIRED_FIELDS.map(field => (
            <div key={field.key} className="flex items-center gap-4">
              <label className="w-32 font-semibold text-gray-700">{field.label}</label>
              <select
                className="flex-1 rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fieldMapping[field.key] || ''}
                onChange={e => setFieldMapping(m => ({ ...m, [field.key]: e.target.value }))}
              >
                <option value="">-- Not Mapped --</option>
                {csvHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Preview</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-slate-100">
                  {REQUIRED_FIELDS.map(f => (
                    <th key={f.key} className="px-2 py-1">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {applyMapping(fieldMapping, rawRows).slice(0, 8).map((lead, idx) => (
                  <tr key={idx}>
                    {REQUIRED_FIELDS.map(f => (
                      <td key={f.key} className="px-2 py-1">{lead[f.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button 
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold" 
            onClick={() => setShowMappingModal(false)}
            disabled={importing}
          >
            Cancel
          </button>
          <button 
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow disabled:opacity-50" 
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Leads'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
        id="csv-upload"
      />
      <button
        onClick={() => document.getElementById('csv-upload')?.click()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Import CSV
      </button>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      {loading && <div className="text-blue-600 text-sm mt-2">Parsing CSV...</div>}
      {showMappingModal && <MappingModal />}
    </div>
  );
} 