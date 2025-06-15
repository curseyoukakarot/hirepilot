import React, { useState, useEffect } from 'react';
import { useWizard } from '../../context/WizardContext';
// @ts-ignore
import Papa from 'papaparse';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailStatus: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  location?: string;
  isGdprLocked: boolean;
}

interface CsvStepProps {
  onLeadsSelected: (leads: Lead[]) => void;
}

const REQUIRED_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'title', label: 'Title' },
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'Location' },
];

function guessMapping(headers: string[], fieldKey: string) {
  // Try to find a header that matches the fieldKey or is similar
  const lowerKey = fieldKey.toLowerCase();
  const match = headers.find(h => h.toLowerCase() === lowerKey || h.toLowerCase().replace(/\s|_/g, '') === lowerKey.replace(/\s|_/g, ''));
  if (match) return match;
  // Fallbacks for common variations
  if (fieldKey === 'firstName') return headers.find(h => h.toLowerCase().includes('first'));
  if (fieldKey === 'lastName') return headers.find(h => h.toLowerCase().includes('last'));
  if (fieldKey === 'company') return headers.find(h => h.toLowerCase().includes('org') || h.toLowerCase().includes('company'));
  return '';
}

export default function CsvStep({ onLeadsSelected }: CsvStepProps) {
  const { wizard, setWizard } = useWizard();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(wizard.selectedLeads || []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawRows(results.data);
        // Guess initial mapping
        const initialMapping = {};
        REQUIRED_FIELDS.forEach(f => {
          initialMapping[f.key] = guessMapping(headers, f.key) || '';
        });
        setFieldMapping(initialMapping);
        setShowMappingModal(true);
        setLoading(false);
      },
      error: (err: any) => {
        setError(err.message || 'Failed to parse CSV');
        setLoading(false);
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedIds = checked ? leads.map(lead => lead.id) : [];
    setSelectedIds(newSelectedIds);
  };

  const handleSelectLead = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // Handle save button click
  const handleSaveClick = async () => {
    try {
      if (selectedIds.length === 0) {
        setError('Please select at least one lead before proceeding.');
        return;
      }

      // Get selected lead objects
      const selectedLeadObjects = leads.filter(lead => selectedIds.includes(lead.id));
      
      // Update wizard state once
      await new Promise<void>((resolve) => {
        setWizard(prev => {
          const newState = {
            ...prev,
            selectedLeads: selectedIds,
            leads: selectedLeadObjects,
            numLeads: selectedLeadObjects.length,
            step: 5 // Explicitly set the step to move to step 5
          };
          resolve();
          return newState;
        });
      });

      // Call parent handler
      onLeadsSelected(selectedLeadObjects);
    } catch (err) {
      console.error('[CsvStep] Error saving leads:', err);
      setError('Failed to save selected leads. Please try again.');
    }
  };

  const applyMapping = (mapping, rows) => {
    return rows.map((row, idx) => {
      const mapped = { id: row.id || String(idx) };
      REQUIRED_FIELDS.forEach(f => {
        mapped[f.key] = row[mapping[f.key]] || '';
      });
      return mapped;
    });
  };

  const handleMappingConfirm = () => {
    const mappedLeads = applyMapping(fieldMapping, rawRows);
    setLeads(mappedLeads);
    setShowMappingModal(false);
  };

  // Modal component
  const MappingModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8 relative animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-center">Map Your CSV Columns</h2>
        <p className="mb-6 text-gray-600 text-center">Match your CSV columns to the required fields below. This ensures your leads are imported correctly.</p>
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
          <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold" onClick={() => setShowMappingModal(false)}>Cancel</button>
          <button className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow" onClick={handleMappingConfirm}>Confirm Mapping</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold mb-1">Upload CSV File</label>
      <input type="file" accept=".csv" onChange={handleFile} className="mb-2" />
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      {loading && <div className="text-blue-600 text-sm mb-2">Parsing CSV...</div>}
      {showMappingModal && <MappingModal />}
      {leads.length > 0 && (
        <div className="mt-4">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h3 className="text-lg font-semibold text-gray-900">Leads Preview</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select the leads you want to add to your campaign.
              </p>
            </div>
            <div className="sm:flex-none">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedIds.length === leads.length && leads.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-700">Select All</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={selectedIds.length === 0}
                  className={`
                    inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
                    ${selectedIds.length === 0 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                    }
                  `}
                >
                  Save Selected Leads
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th scope="col" className="relative py-3.5 pl-4 pr-3 sm:pl-6">
                        <input
                          type="checkbox"
                          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.length === leads.length && leads.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </th>
                      {REQUIRED_FIELDS.map(field => (
                        <th
                          key={field.key}
                          scope="col"
                          className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                        >
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedIds.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                          />
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                          {lead.firstName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.lastName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.company}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.location}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 