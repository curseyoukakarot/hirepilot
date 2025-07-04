console.log("!!! THIS IS THE ACTIVE LEADS.JSX FILE !!!");
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CsvImportButton from '../components/leads/CsvImportButton';
import { supabase } from '../lib/supabase';
import { Toaster } from 'react-hot-toast';
import { FaPlus, FaSearch, FaFilter, FaDownload } from 'react-icons/fa';
import { downloadCSV } from '../utils/csvExport';

export default function Leads() {
  console.log('Leads component rendered');
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched leads:', data);
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleMessageAgain = (lead) => {
    localStorage.setItem('selectedLead', JSON.stringify(lead));
    navigate('/messaging');
  };

  const handleSelectLead = (leadId) => {
    console.log('Selecting lead:', leadId);
    setSelectedLeads(prev => {
      const newSelection = prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId];
      console.log('New selection:', newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    console.log('Select all clicked, current state:', selectAll);
    if (selectAll) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(lead => lead.id));
    }
    setSelectAll(!selectAll);
  };

  const handleExportLeads = () => {
    console.log('Exporting leads, selected:', selectedLeads);
    if (selectedLeads.length === 0) {
      console.log('No leads selected for export');
      return;
    }
    // Get only the selected leads
    const selectedLeadData = leads.filter(lead => selectedLeads.includes(lead.id));
    console.log('Selected lead data for export:', selectedLeadData);
    // Format leads data for export
    const exportData = selectedLeadData.map(lead => ({
      'First Name': lead.first_name || '',
      'Last Name': lead.last_name || '',
      'Email': lead.email || '',
      'Phone': lead.phone || '',
      'Company': lead.company_name || '',
      'Title': lead.title || lead.headline || '',
      'LinkedIn URL': lead.linkedin_url || '',
      'Status': lead.status || '',
      'Source': lead.source_type || '',
      'Created At': new Date(lead.created_at).toLocaleDateString(),
      'Last Updated': new Date(lead.updated_at).toLocaleDateString()
    }));
    console.log('Formatted export data:', exportData);
    downloadCSV(exportData, `leads-export-${new Date().toISOString().split('T')[0]}`);
    setShowExportModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-16">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Leads</h1>
          <p className="text-gray-500 mb-4 md:mb-0">Manage and track your candidate leads in one place.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm flex items-center shadow transition-all duration-150"
          >
            <FaPlus className="mr-2" /> Add Lead
          </button>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and organize your leads</p>
          </div>
          <CsvImportButton onImportComplete={fetchLeads} />
        </div>
        {/* Bulk Actions */}
        {selectedLeads.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm border mb-4 flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <div className="text-sm text-gray-600">
                {selectedLeads.length} leads selected
              </div>
              <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Message</button>
              <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200">Tag</button>
              <button className="px-3 py-1 rounded bg-purple-100 text-purple-700 text-sm hover:bg-purple-200">Enrich</button>
              <button className="px-3 py-1 rounded bg-green-100 text-green-700 text-sm hover:bg-green-200">Convert to Candidate</button>
              <button
                onClick={() => setShowExportModal(true)}
                className={`px-3 py-1 rounded flex items-center gap-1 bg-white border text-gray-700 text-sm shadow hover:bg-gray-50 transition ${selectedLeads.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={selectedLeads.length < 2}
              >
                <FaDownload /> Export
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No leads</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by importing your first leads.</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => {
                  // Parse enrichment_data if it's a string
                  let enrichment = lead.enrichment_data;
                  if (typeof enrichment === 'string') {
                    try {
                      enrichment = JSON.parse(enrichment);
                    } catch {
                      enrichment = {};
                    }
                  }
                  // Debug log
                  console.log('Lead enrichment_data:', enrichment);
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => handleSelectLead(lead.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {((lead.first_name || enrichment?.first_name || '') + ' ' + (lead.last_name || enrichment?.last_name || '')).trim()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.company}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{lead.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(() => {
                            // Combine city, state, country if present
                            const locationParts = [lead.city, lead.state, lead.country].filter(Boolean);
                            if (locationParts.length > 0) return locationParts.join(', ');
                            // Fallback to campaign_location if present
                            if (lead.campaign_location) return lead.campaign_location;
                            // Otherwise show Unknown
                            return 'Unknown';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {lead.enrichment_source || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleMessageAgain(lead)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Message
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Export Leads</h2>
            <p className="mb-6">You are about to export <span className="font-semibold">{selectedLeads.length}</span> leads. Continue?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleExportLeads}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 