import React, { useState } from 'react';
import { useWizard } from '../../context/WizardContext';
import Papa from 'papaparse';

const REQUIRED_FIELDS = [
  { key: 'firstName', label: 'First Name', required: true },
  { key: 'lastName', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'title', label: 'Job Title', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'linkedinUrl', label: 'LinkedIn URL', required: false },
  { key: 'location', label: 'Location', required: false },
];

function guessMapping(headers, fieldKey) {
  const mapping = {
    firstName: ['first name', 'firstname', 'first_name', 'fname', 'name'],
    lastName: ['last name', 'lastname', 'last_name', 'lname', 'surname'],
    email: ['email', 'email address', 'e-mail', 'mail'],
    title: ['title', 'job title', 'position', 'role', 'job_title'],
    company: ['company', 'organization', 'employer', 'company name'],
    linkedinUrl: ['linkedin', 'linkedin url', 'linkedin_url', 'profile'],
    location: ['location', 'city', 'address', 'country', 'region']
  };

  const candidates = mapping[fieldKey] || [];
  return headers.find(header => 
    candidates.some(candidate => 
      header.toLowerCase().includes(candidate.toLowerCase())
    )
  );
}

export default function CsvStep({ onLeadsSelected }) {
  const { wizard, setWizard } = useWizard();
  const [leads, setLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState(wizard.selectedLeads || []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});

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
        // Guess initial mapping
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

  const handleSelectAll = (checked) => {
    const newSelectedIds = checked ? leads.map(lead => lead.id) : [];
    setSelectedIds(newSelectedIds);
  };

  const handleSelectLead = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleConfirmMapping = () => {
    // Validate required fields are mapped
    const missingRequired = REQUIRED_FIELDS
      .filter(f => f.required && !fieldMapping[f.key])
      .map(f => f.label);
    
    if (missingRequired.length > 0) {
      setError(`Please map required fields: ${missingRequired.join(', ')}`);
      return;
    }

    // Transform raw data to lead objects
    const transformedLeads = rawRows.map((row, index) => {
      const lead = { id: `csv-${index}` };
      Object.entries(fieldMapping).forEach(([fieldKey, csvHeader]) => {
        if (csvHeader && row[csvHeader]) {
          lead[fieldKey] = row[csvHeader];
        }
      });
      
      // Set default values
      lead.emailStatus = 'unknown';
      lead.isGdprLocked = false;
      
      return lead;
    }).filter(lead => lead.firstName && lead.lastName && lead.email);

    setLeads(transformedLeads);
    setSelectedIds(transformedLeads.map(lead => lead.id));
    setShowMappingModal(false);
  };

  const handleProceed = async () => {
    const selectedLeadObjects = leads.filter(lead => selectedIds.includes(lead.id));
    
    if (selectedLeadObjects.length === 0) {
      setError('Please select at least one lead');
      return;
    }

    try {
      // Update wizard state
      await new Promise(resolve => {
        setWizard(prev => {
          const newState = {
            ...prev,
            leads: selectedLeadObjects,
            selectedLeads: selectedIds,
            numLeads: selectedLeadObjects.length
          };
          resolve();
          return newState;
        });
      });

      // Call parent callback
      onLeadsSelected(selectedLeadObjects);
    } catch (err) {
      console.error('Error updating wizard state:', err);
      setError('Failed to save selected leads');
    }
  };

  const allSelected = selectedIds.length === leads.length && leads.length > 0;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upload CSV File</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-1 text-sm text-gray-500">
            Upload a CSV file with lead information. Required fields: First Name, Last Name, Email
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {loading && (
          <div className="text-blue-600 text-sm">Processing CSV file...</div>
        )}
      </div>

      {/* Results Table */}
      {leads.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Imported Leads ({leads.length})</h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 mr-2"
                />
                Select All
              </label>
              <button
                onClick={handleProceed}
                disabled={selectedIds.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Use Selected Leads ({selectedIds.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {lead.firstName} {lead.lastName}
                    </td>
                    <td className="px-4 py-3">{lead.email}</td>
                    <td className="px-4 py-3">{lead.title || '-'}</td>
                    <td className="px-4 py-3">{lead.company || '-'}</td>
                    <td className="px-4 py-3">{lead.location || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Field Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Map CSV Fields</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please map your CSV columns to the corresponding lead fields:
            </p>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {REQUIRED_FIELDS.map(field => (
                <div key={field.key} className="flex items-center space-x-4">
                  <label className="w-32 text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={fieldMapping[field.key] || ''}
                    onChange={e => setFieldMapping(prev => ({
                      ...prev,
                      [field.key]: e.target.value
                    }))}
                    className="flex-1 rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">-- Select Column --</option>
                    {csvHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMapping}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Import Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 