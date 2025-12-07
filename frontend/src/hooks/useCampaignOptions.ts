import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CampaignOption {
  id: string;
  name: string;
  status?: string;
  created_at?: string;
}

interface UseCampaignOptionsResult {
  options: CampaignOption[];
  loading: boolean;
  error: string | null;
}

export function useCampaignOptions(): UseCampaignOptionsResult {
  const [options, setOptions] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchCampaigns() {
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !session?.access_token) {
          throw new Error('Not authenticated');
        }

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
        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch campaigns');
        }

        if (!cancelled) {
          // Filter out archived campaigns and format for dropdown
          const campaignOptions = (result.campaigns || [])
            .filter((campaign: any) => campaign.status !== 'archived')
            .map((campaign: any) => ({
              id: campaign.id,
              name: campaign.name || campaign.title || 'Untitled Campaign',
              status: campaign.status,
              created_at: campaign.created_at
            }))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          setOptions(campaignOptions);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load campaigns');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCampaigns();
    
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading, error };
}