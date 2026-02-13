import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EventProposalLandingTemplate from '../../../ignite/templates/EventProposalLandingTemplate';
import { buildProposalPdfUrl, fetchClientProposal } from '../../../ignite/lib/proposalsApi';
import { IgniteProposalComputed } from '../../../ignite/types/proposals';

export default function ClientProposalViewPage() {
  const navigate = useNavigate();
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
        const data = await fetchClientProposal(proposalId);
        if (!mounted) return;
        setProposal(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load proposal');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [proposalId]);

  const downloadPdf = (optionId: string) => {
    window.open(buildProposalPdfUrl(proposalId, optionId), '_blank', 'noopener,noreferrer');
  };

  const copySummary = async (optionId: string) => {
    if (!proposal) return;
    const selected = proposal.options.find((item) => item.id === optionId) || proposal.options[0];
    if (!selected) return;
    const summary = [
      `Event: ${proposal.eventName}`,
      `Client: ${proposal.clientName}`,
      `Option: ${selected.name}`,
      `Total Investment: $${Number(selected.totals.total || 0).toLocaleString()}`,
      ...proposal.nextSteps.bullets.map((line) => `- ${line}`),
    ].join('\n');
    await navigator.clipboard.writeText(summary);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-sm text-slate-300">Loading proposal...</div>;
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10">
        <div className="max-w-xl rounded-xl border border-red-300/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error || 'Proposal not found.'}
          <button
            type="button"
            onClick={() => navigate('/ignite/client')}
            className="mt-4 block rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
          >
            Back to client portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <EventProposalLandingTemplate
      proposal={proposal}
      onDownloadPdf={downloadPdf}
      onDownloadXlsx={() => {}}
      onCopySummary={copySummary}
    />
  );
}
