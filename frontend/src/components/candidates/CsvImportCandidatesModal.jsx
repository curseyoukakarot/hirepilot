import React, { useState } from 'react';
import Papa from 'papaparse';

const FIELDS = [
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

function guess(headers, key) {
  const norm = (s) => (s||'').toLowerCase().replace(/\s|_/g,'');
  const hk = norm(key);
  const exact = headers.find(h => norm(h)===hk);
  if (exact) return exact;
  if (key==='first_name') return headers.find(h=>/first/.test(norm(h)));
  if (key==='last_name') return headers.find(h=>/last/.test(norm(h)));
  if (key==='company') return headers.find(h=>/company|org/.test(norm(h)));
  if (key==='linkedin_url') return headers.find(h=>/linkedin/.test(norm(h)));
  return '';
}

export default function CsvImportCandidatesModal({ open, onClose, onSubmit }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields || [];
        setHeaders(hs);
        setRows(res.data||[]);
        const init = {};
        FIELDS.forEach(f => { init[f.key] = guess(hs, f.key) || ''; });
        setMapping(init);
        setLoading(false);
      },
      error: () => setLoading(false)
    });
  };

  const apply = () => {
    const out = rows.map(r => {
      const obj = {};
      FIELDS.forEach(f => {
        if (f.key==='tags') obj.tags = (r[mapping[f.key]]||'').split(',').map(t=>t.trim()).filter(Boolean);
        else obj[f.key] = r[mapping[f.key]] || '';
      });
      // carry through location/source into enrichment_data shape used elsewhere
      obj.enrichment_data = JSON.stringify({ location: r[mapping['location']]||'', source: r[mapping['source']]||'CSV Import' });
      return obj;
    });
    onSubmit?.(out);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 mt-10 mb-10 relative max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-center">Import Candidates from CSV</h2>
        <p className="mb-4 text-gray-600 text-center">Map your CSV columns to the required fields below. This ensures your candidates are imported correctly.</p>
        <div className="mb-4">
          <input type="file" accept=".csv" onChange={handleFile} />
          {loading && <div className="text-sm text-blue-600 mt-2">Parsing CSV...</div>}
        </div>
        <div className="space-y-3 mb-4">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-4">
              <label className="w-40 font-semibold text-gray-700">{f.label}</label>
              <select className="flex-1 rounded border border-gray-300 px-3 py-2" value={mapping[f.key]||''} onChange={e=>setMapping(m=>({ ...m, [f.key]: e.target.value }))}>
                <option value="">-- Not Mapped --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Preview</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead>
                <tr className="bg-slate-100">
                  {FIELDS.map(f => <th key={f.key} className="px-2 py-1">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0,8).map((r, idx) => {
                  const mapped = FIELDS.map(f => f.key==='tags' ? (r[mapping[f.key]]||'') : (r[mapping[f.key]]||''));
                  return (
                    <tr key={idx}>
                      {mapped.map((v,i)=>(<td key={i} className="px-2 py-1">{v}</td>))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 sticky bottom-0 bg-white pt-3">
          <button className="px-4 py-2 rounded bg-gray-100" onClick={onClose}>Cancel</button>
          <button className="px-6 py-2 rounded bg-blue-600 text-white" onClick={apply}>Import Candidates</button>
        </div>
      </div>
    </div>
  );
}
