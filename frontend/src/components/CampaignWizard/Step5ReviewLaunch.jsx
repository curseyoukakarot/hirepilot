import React, { useState, useEffect } from 'react';
import {
  Rocket,
  CheckCircle,
  XCircle,
  Pen,
  Trash2,
  ArrowLeft,
  Check,
} from 'lucide-react';
import WizardStepHeader from './WizardStepHeader';
import { useWizard } from '../../context/WizardContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/api';

const LEAD_SOURCE_LABELS = {
  linkedin: 'Sales Navigator',
  apollo: 'Apollo',
  csv: 'CSV',
};

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function Step5ReviewLaunch({ onBack, onEdit }) {
  const { wizard } = useWizard();
  const { campaignId } = wizard;
  const [campaign, setCampaign] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [editingJobDesc, setEditingJobDesc] = useState(false);
  const [jobDescDraft, setJobDescDraft] = useState('');
  const [runStatus, setRunStatus] = useState(null);
  const [runError, setRunError] = useState(null);
  const [enrichmentStatus, setEnrichmentStatus] = useState(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState(null);

  // Get selected leads from wizard context
  const selectedLeads = wizard.leads || [];

  // Load campaign data
  useEffect(() => {
    if (!campaignId) return;
    supabase.from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
      .then(({ data }) => {
        setCampaign(data);
        if (data?.jobDescription) {
          setJobDescDraft(data.jobDescription);
        }
      });
  }, [campaignId]);

  const handleLaunch = async () => {
    if (!campaign) return;
    setIsLaunching(true);
    try {
      // Get user session for user_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Build payload to send to backend service (uses service-role key)
      const leadsToInsert = selectedLeads.map(lead => {
        const { id, emailStatus, firstName, lastName, isGdprLocked, linkedinUrl, status, ...rest } = lead;
        const obj = {
          ...rest,
          user_id: session.user.id,
          first_name: lead.first_name || lead.firstName || '',
          last_name: lead.last_name || lead.lastName || '',
          name: ((lead.first_name || lead.firstName || '') + ' ' + (lead.last_name || lead.lastName || '')).trim(),
          email_status: emailStatus,
          is_gdpr_locked: isGdprLocked,
          linkedin_url: linkedinUrl,
          campaign_id: campaign.id,
          enrichment_data: {
            location: [lead.city, lead.state, lead.country].filter(Boolean).join(', ') || campaign.location || 'Unknown',
            source: 'Apollo'
          },
          enrichment_source: 'Apollo',
          city: lead.city || campaign.location || 'Unknown',
          state: lead.state || '',
          country: lead.country || '',
          campaign_location: campaign.location || 'Unknown',
          location: [lead.city, lead.state, lead.country].filter(Boolean).join(', ') || campaign.location || 'Unknown'
        };
        return obj;
      });

      console.log('[Launch] sending leads to backend import endpoint', { leads: leadsToInsert.length });

      const importRes = await fetch(`${API_BASE_URL}/leads/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify({ campaignId: campaign.id, leads: leadsToInsert })
      });

      if (!importRes.ok) {
        const { error } = await importRes.json().catch(() => ({}));
        throw new Error(error || 'Failed to import leads');
      }

      // Update campaign status
      await supabase
        .from('campaigns')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      setShowSuccessToast(true);
      toast.success('Campaign launched successfully!');
    } catch (error) {
      console.error('Launch failed:', error);
      toast.error('Failed to launch campaign');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Review & Launch"
        description="Review your campaign details and selected leads before launching."
      />

      {/* Campaign Summary */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Campaign Summary
          </h3>
          <div className="mt-5 border-t border-gray-200">
            <dl className="divide-y divide-gray-200">
              <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">Campaign Name</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                  {campaign?.name}
                </dd>
              </div>
              <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">Selected Leads</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                  {selectedLeads.length} leads selected
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Selected Leads Table */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Selected Leads
          </h3>
          <div className="mt-4 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Company</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Location</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {selectedLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                          {lead.firstName} {lead.lastName}
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
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {lead.isGdprLocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              GDPR Protected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={isLaunching || !selectedLeads.length}
          className={`
            inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
            ${isLaunching || !selectedLeads.length
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
        >
          {isLaunching ? (
            <>Loading...</>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Launch Campaign
            </>
          )}
        </button>
      </div>
    </div>
  );
} 