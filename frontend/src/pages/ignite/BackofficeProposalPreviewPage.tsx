import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EventProposalLandingTemplate from '../../ignite/templates/EventProposalLandingTemplate';
import { apiGet } from '../../lib/api';
import { buildProposalPdfUrl } from '../../ignite/lib/proposalsApi';
import { IgniteProposalComputed } from '../../ignite/types/proposals';

export default function BackofficeProposalPreviewPage() {
  const { proposalId = '' } = useParams();
  const [proposal, setProposal] = useState<IgniteProposalComputed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiGet(`/api/ignite/proposals/${proposalId}/computed`);
        if (!mounted) return;
        setProposal(response?.proposal || null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load proposal preview');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [proposalId]);

  if (loading) return <div className="min-h-screen bg-slate-950 px-6 py-10 text-sm text-slate-300">Loading preview...</div>;
  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10">
        <div className="rounded-xl border border-red-300/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error || 'Proposal preview unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <EventProposalLandingTemplate
      proposal={proposal}
      onDownloadPdf={(optionId) =>
        window.open(buildProposalPdfUrl(proposalId, optionId), '_blank', 'noopener,noreferrer')
      }
    />
  );
}
