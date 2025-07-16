import React, { useState, useEffect } from 'react';
import {
  Rocket,
  CheckCircle,
  XCircle,
  Pen,
  Trash2,
  ArrowLeft,
  Check,
  Linkedin,
  Globe,
  Users,
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

  // Check if this is a Sales Navigator campaign
  const isSalesNavigatorCampaign = campaign?.lead_source_type === 'linkedin';

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

      // For Sales Navigator campaigns, trigger the LinkedIn search
      if (isSalesNavigatorCampaign) {
        // Extract search URL from the lead source payload
        const searchUrl = campaign.lead_source_payload?.linkedin_search_url;
        
        if (!searchUrl) {
          throw new Error('LinkedIn search URL not found in campaign');
        }
        
        // Call the LinkedIn search trigger API
        const response = await fetch(`${API_BASE_URL}/campaigns/linkedin/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          credentials: 'include',
          body: JSON.stringify({ 
            campaignId: campaign.id,
            searchUrl: searchUrl 
          })
        });

        if (!response.ok) {
          const { error } = await response.json().catch(() => ({}));
          throw new Error(error || 'Failed to start LinkedIn search');
        }

        // Update campaign status to "running"
        await supabase
          .from('campaigns')
          .update({
            status: 'running',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        toast.success('Sales Navigator search started! Processing takes ~10 minutes. You\'ll receive email and Slack notifications when your leads are ready.');
      } else {
        // For Apollo/CSV campaigns, use the existing lead import logic
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
        body: JSON.stringify({ 
          campaignId: campaign.id, 
          leads: leadsToInsert,
          source: 'apollo',
          searchCriteria: {
            jobTitle: campaign.title,
            keywords: campaign.keywords,
            location: campaign.location
          }
        })
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

        toast.success('Campaign launched successfully!');
      }

      setShowSuccessToast(true);
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
                <dt className="text-sm font-medium text-gray-500">
                  {isSalesNavigatorCampaign ? 'Lead Source' : 'Selected Leads'}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                  {isSalesNavigatorCampaign 
                    ? LEAD_SOURCE_LABELS[campaign?.lead_source_type] || 'Sales Navigator'
                    : `${selectedLeads.length} leads selected`
                  }
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Conditional Content: Sales Navigator Info or Leads Table */}
      {isSalesNavigatorCampaign ? (
        /* Sales Navigator Lead Source Information */
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-4">
              <Linkedin className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Sales Navigator Search
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Search URL</p>
                  <p className="text-sm text-gray-900 truncate" title={campaign?.lead_source_payload?.linkedin_search_url}>
                    {campaign?.lead_source_payload?.linkedin_search_url ? 
                      campaign.lead_source_payload.linkedin_search_url.length > 50 
                        ? `${campaign.lead_source_payload.linkedin_search_url.substring(0, 50)}...`
                        : campaign.lead_source_payload.linkedin_search_url
                      : 'LinkedIn search URL configured'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-gray-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Expected Results</p>
                  <p className="text-sm text-gray-900">Up to 250 leads</p>
                </div>
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-sm text-gray-900">Ready to launch</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> When you launch this campaign, we'll automatically search LinkedIn Sales Navigator 
                using your provided URL and import the found leads. The leads will be enriched with email addresses 
                using Apollo and made available in your campaign dashboard.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Traditional Selected Leads Table (Apollo/CSV) */
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
      )}

      {/* Sales Navigator Timing Expectations */}
      {isSalesNavigatorCampaign && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-medium text-blue-900">
                What to Expect
              </h3>
              <div className="mt-2 space-y-2">
                <p className="text-sm text-blue-800">
                  <strong>Processing Time:</strong> Your LinkedIn Sales Navigator search will take approximately <strong>10 minutes</strong> to complete.
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Automatic Processing:</strong> Our system will scrape LinkedIn in the background and import leads directly to your campaign.
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Notifications:</strong> You'll receive both email and Slack notifications when your leads are ready for review.
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Credit Usage:</strong> This campaign will use 50 credits for LinkedIn scraping.
                </p>
              </div>
              <div className="mt-3 flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <p className="ml-2 text-xs text-blue-700">
                  You can safely close this page - the search will continue in the background
                </p>
            </div>
          </div>
        </div>
      </div>
      )}

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
          disabled={isLaunching || (!isSalesNavigatorCampaign && !selectedLeads.length)}
          className={`
            inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
            ${isLaunching || (!isSalesNavigatorCampaign && !selectedLeads.length)
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
              {isSalesNavigatorCampaign ? 'Start LinkedIn Search' : 'Launch Campaign'}
            </>
          )}
        </button>
      </div>
    </div>
  );
} 