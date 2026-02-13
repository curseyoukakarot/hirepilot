import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventProposalLandingTemplate from '../../../ignite/templates/EventProposalLandingTemplate';
import { fetchSharedProposal } from '../../../ignite/lib/proposalsApi';
import { IgniteProposalComputed } from '../../../ignite/types/proposals';

export default function SharedProposalViewPage() {
  const { token = '' } = useParams();
  const [proposal, setProposal] = useState<IgniteProposalComputed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchSharedProposal(token);
        if (!mounted) return;
        setProposal(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load shared proposal');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-sm text-slate-300">Loading proposal...</div>;
  }
  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10">
        <div className="max-w-xl rounded-xl border border-red-300/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error || 'Shared proposal not found.'}
        </div>
      </div>
    );
  }

  return <EventProposalLandingTemplate proposal={proposal} />;
}
