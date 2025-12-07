import React, { useState, useEffect } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export default function AttachToCampaignModal({ isOpen, onClose, leadIds, onSuccess }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch campaigns when modal opens
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!isOpen) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !session?.access_token) throw new Error('Not authenticated');

        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/getCampaigns`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        const result = await response.json();
        if (response.ok && result.campaigns) {
          // Include campaigns with all statuses: draft, active, completed, etc.
          setCampaigns(result.campaigns);
        } else {
          throw new Error(result.error || 'Failed to fetch campaigns');
        }
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCampaignId('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCampaignId) {
      setError('Please select a campaign');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/leads/attach-to-campaign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            leadIds: Array.isArray(leadIds) ? leadIds : [leadIds],
            campaignId: selectedCampaignId,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to attach leads to campaign');
      }

      // Find the selected campaign name for the success message
      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const campaignName = selectedCampaign?.name || selectedCampaign?.title || 'Unknown Campaign';
      const leadCount = Array.isArray(leadIds) ? leadIds.length : 1;

      toast.success(
        `${leadCount} lead${leadCount > 1 ? 's' : ''} successfully attached to ${campaignName}`,
        {
          duration: 5000,
          position: 'top-center',
        }
      );

      // Call success callback to refresh the leads table
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err) {
      console.error('Error attaching leads to campaign:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to attach leads to campaign', {
        duration: 5000,
        position: 'top-center',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCampaignOption = (campaign) => {
    const name = campaign.name || campaign.title || 'Untitled Campaign';
    const status = campaign.status || 'unknown';
    return `${name} (${status})`;
  };

  if (!isOpen) return null;

  const leadCount = Array.isArray(leadIds) ? leadIds.length : 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Attach Leads to Campaign</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <FaXmark />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Select a campaign to assign {leadCount > 1 ? `these ${leadCount} leads` : 'this lead'} to:
            </p>
            
            <label htmlFor="campaign" className="block text-sm font-medium text-gray-700 mb-2">
              Select a campaign to assign these lead(s) to
            </label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading campaigns...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No campaigns found. Create a campaign first.
              </div>
            ) : (
              <select
                id="campaign"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {formatCampaignOption(campaign)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center"
              disabled={isSubmitting || isLoading || campaigns.length === 0}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Attaching...
                </>
              ) : 'Attach to Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}