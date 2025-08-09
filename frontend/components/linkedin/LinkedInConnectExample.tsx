import React from 'react';
import LinkedInConnectButton from './LinkedInConnectButton';
import { supabase } from '../../lib/supabaseClient';

/**
 * Example usage of LinkedInConnectButton component
 * This shows how to integrate the n8n automation into existing HirePilot components
 */

// Example 1: In a Lead Table Row
export const LeadTableRowExample = ({ lead }: { lead: any }) => {
  const handleConnectSuccess = (data: any) => {
    console.log('Connection request sent successfully:', data);
    // Update lead status in your state management
    // You might want to refetch leads or update local state
  };

  const handleConnectError = (error: string) => {
    console.error('Connection request failed:', error);
    // Handle error - maybe show a retry option or update UI
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <img
            className="h-10 w-10 rounded-full"
            src={lead.photo_url || '/default-avatar.png'}
            alt={lead.name}
          />
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{lead.name}</div>
            <div className="text-sm text-gray-500">{lead.title}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">{lead.company}</td>
      <td className="px-6 py-4 text-sm text-gray-500">{lead.location}</td>
      <td className="px-6 py-4">
        {lead.linkedin_url && (
          <LinkedInConnectButton
            linkedin_url={lead.linkedin_url}
            leadId={lead.id}
            campaignId={lead.campaign_id}
            defaultMessage={`Hi ${lead.first_name}! I came across your profile and would love to connect. Your experience at ${lead.company} looks really interesting!`}
            onSuccess={handleConnectSuccess}
            onError={handleConnectError}
            className="max-w-xs"
          />
        )}
      </td>
    </tr>
  );
};

// Example 2: In a Lead Detail Modal/Page
export const LeadDetailExample = ({ lead }: { lead: any }) => {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <img
          className="h-16 w-16 rounded-full"
          src={lead.photo_url || '/default-avatar.png'}
          alt={lead.name}
        />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{lead.name}</h2>
          <p className="text-gray-600">{lead.title} at {lead.company}</p>
          <p className="text-gray-500">{lead.location}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Actions</h3>
          
          {lead.linkedin_url && (
            <div className="space-y-4">
              <LinkedInConnectButton
                linkedin_url={lead.linkedin_url}
                leadId={lead.id}
                campaignId={lead.campaign_id}
                defaultMessage={`Hi ${lead.first_name}! I noticed you're ${lead.title} at ${lead.company}. I'd love to connect and learn more about your work in ${lead.industry || 'your field'}!`}
                onSuccess={(data) => {
                  console.log('Connect success:', data);
                  // Maybe update lead status or show success state
                }}
                onError={(error) => {
                  console.error('Connect error:', error);
                }}
              />
              
              <div className="text-xs text-gray-500">
                💡 This will automatically send a personalized connection request via LinkedIn
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Lead Information</h3>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{lead.email || 'Not available'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Industry</dt>
              <dd className="text-sm text-gray-900">{lead.industry || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="text-sm text-gray-900">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  lead.status === 'connected' ? 'bg-green-100 text-green-800' :
                  lead.status === 'connection_requested' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {lead.status?.replace('_', ' ') || 'New'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

// Example 3: Integration with existing CampaignWizard or Lead Management
export const CampaignLeadActionsExample = ({ leads, campaignId }: { leads: any[]; campaignId: string }) => {
  const [selectedLeads, setSelectedLeads] = React.useState<string[]>([]);
  const [bulkConnecting, setBulkConnecting] = React.useState(false);

  const handleBulkConnect = async () => {
    setBulkConnecting(true);
    
    try {
      const connectPromises = selectedLeads.map(async (leadId) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead?.linkedin_url) return null;

        // Trigger individual connect requests with staggered timing
        return new Promise(resolve => {
          setTimeout(async () => {
            try {
              // Get auth token from Supabase
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Not authenticated');

              const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';
              const response = await fetch(`${API_BASE_URL}/api/linkedin/send-connect`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  linkedin_url: lead.linkedin_url,
                  message: `Hi ${lead.first_name}! I'm reaching out about potential opportunities at ${lead.company}. Would love to connect!`,
                  lead_id: lead.id,
                  campaign_id: campaignId
                })
              });
              
              resolve(await response.json());
            } catch (error: any) {
              resolve({ error: error.message });
            }
          }, Math.random() * 5000); // Random delay 0-5 seconds to avoid rate limiting
        });
      });

      const results = await Promise.all(connectPromises);
      const successful = results.filter(r => r && !(r as any).error).length;
      
      console.log(`Bulk connect completed: ${successful}/${selectedLeads.length} successful`);
      
    } finally {
      setBulkConnecting(false);
      setSelectedLeads([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Campaign Leads ({leads.length})</h3>
        
        {selectedLeads.length > 0 && (
          <button
            onClick={handleBulkConnect}
            disabled={bulkConnecting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkConnecting ? 'Connecting...' : `Connect to ${selectedLeads.length} selected`}
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {leads.map((lead) => (
          <div key={lead.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedLeads.includes(lead.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLeads([...selectedLeads, lead.id]);
                    } else {
                      setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                    }
                  }}
                  className="rounded border-gray-300"
                />
                <div>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-sm text-gray-500">{lead.title} at {lead.company}</div>
                </div>
              </div>
              
              {lead.linkedin_url && (
                <div className="flex-shrink-0">
                  <LinkedInConnectButton
                    linkedin_url={lead.linkedin_url}
                    leadId={lead.id}
                    campaignId={campaignId}
                    defaultMessage={`Hi ${lead.first_name}! I'm reaching out about exciting opportunities. Would love to connect and share more details!`}
                    className="max-w-48"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No leads found for this campaign.
        </div>
      )}
    </div>
  );
};

// Example 4: Settings Integration - Show LinkedIn Connection Status
export const LinkedInSettingsExample = () => {
  const [cookieStatus, setCookieStatus] = React.useState<'checking' | 'valid' | 'invalid'>('checking');

  React.useEffect(() => {
    // Check LinkedIn cookie status
    const checkLinkedInStatus = async () => {
      try {
        // Get auth token from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/linkedin/check-cookie`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();
        setCookieStatus(data.valid ? 'valid' : 'invalid');
      } catch (error) {
        setCookieStatus('invalid');
      }
    };

    checkLinkedInStatus();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="text-lg font-medium mb-4">LinkedIn Integration</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">LinkedIn Authentication</div>
            <div className="text-sm text-gray-500">
              Required for automated connection requests
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm ${
            cookieStatus === 'valid' ? 'bg-green-100 text-green-800' :
            cookieStatus === 'invalid' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {cookieStatus === 'checking' ? 'Checking...' :
             cookieStatus === 'valid' ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {cookieStatus === 'invalid' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="font-medium text-yellow-800">LinkedIn session expired</div>
            <div className="text-sm text-yellow-700 mt-1">
              Please refresh your LinkedIn session to continue using automation features.
            </div>
            <button className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
              Refresh LinkedIn Session
            </button>
          </div>
        )}

        {cookieStatus === 'valid' && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="font-medium text-green-800">LinkedIn automation ready</div>
            <div className="text-sm text-green-700 mt-1">
              You can now send automated connection requests through HirePilot.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};