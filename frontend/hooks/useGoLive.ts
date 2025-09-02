import { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { Campaign } from '../types/campaign';

interface UseGoLiveOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export function useGoLive(campaignId: string, options: UseGoLiveOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Subscribe to campaign changes
    const subscription = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`
        },
        (payload) => {
          const campaign = payload.new as Campaign;
          
          // Calculate progress
          if (campaign.total_leads > 0) {
            const newProgress = Math.round(
              (campaign.enriched_leads / campaign.total_leads) * 100
            );
            setProgress(newProgress);
            options.onProgress?.(newProgress);
          }

          // Handle completion
          if (campaign.status === 'active') {
            setIsLoading(false);
            options.onSuccess?.();
          }

          // Handle failure
          if (campaign.status === 'failed') {
            setIsLoading(false);
            const error = new Error(campaign.error_message || 'Enrichment failed');
            setError(error);
            options.onError?.(error);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [campaignId]);

  const goLive = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);

      const response = await fetch(`/api/campaigns/${campaignId}/go-live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start enrichment');
      }

      // Note: Don't set loading to false here
      // Wait for the subscription to confirm completion
    } catch (err: any) {
      setIsLoading(false);
      const error = new Error(err.message || 'Failed to start enrichment');
      setError(error);
      options.onError?.(error);
    }
  };

  return {
    goLive,
    isLoading,
    error,
    progress
  };
} 