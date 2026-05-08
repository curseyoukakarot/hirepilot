/**
 * v2 / Campaigns — outbound campaign hub
 *
 * SHELL stub for Wave 1: gives the WorkspaceSidebar "Campaigns" link a
 * real v2 destination instead of bouncing to legacy `/campaigns`.
 *
 * The legacy /campaigns surface still owns campaign creation + step
 * editing for now; this page surfaces the recruiter's view (active
 * sequences, recent sends, reply rates) and links into the legacy
 * builder for tasks v2 hasn't picked up yet.
 *
 * TODO Wave 5: wire to /api/sequences (already exists in backend) +
 * port the SequencesTab UI. Until then, render a clean shell that
 * shows what's coming and offers a one-click jump to legacy.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

export default function CampaignsPage() {
  useV2Theme();

  return (
    <WorkspaceShell autopilot>
      {/* Topbar */}
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-paper-plane text-primary text-xs" />
          Campaigns
        </div>
        <div className="status-pill ml-3">
          <i className="fa-solid fa-bolt text-warn text-[10px]" />
          <span>Coming soon to v2</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <a href="/campaigns" className="btn-outline">
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
            Open in classic UI
          </a>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-10 max-w-[920px] mx-auto">
        <section
          className="float-in d-1 rounded-2xl p-8"
          style={{
            background:
              'linear-gradient(135deg,rgba(107,70,193,.06),rgba(12,92,244,.04) 60%,transparent)',
            border: '1px solid rgba(107,70,193,.15)',
          }}
        >
          <div className="flex items-start gap-5">
            <div
              className="w-14 h-14 rounded-2xl grad-icon flex items-center justify-center text-white shrink-0 shadow-lg"
              style={{ boxShadow: '0 12px 30px -10px rgba(107,70,193,.4)' }}
            >
              <i className="fa-solid fa-paper-plane text-[20px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-extrabold tracking-tight mb-1">Campaigns</h1>
              <p className="text-text-secondary text-[14px] mb-5 max-w-2xl">
                The Recruiter agent's home base — outbound sequences, drip flows,
                A/B variants, and reply analytics. We're porting this page from the
                classic UI now. In the meantime, your existing campaigns keep running
                automatically — REX hasn't paused anything.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <a href="/campaigns" className="btn-solid">
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                  Manage in classic UI
                </a>
                <Link to="/v2/agents/recruiter" className="btn-outline">
                  <i className="fa-solid fa-user-tie text-[10px]" />
                  See Recruiter agent
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* What's coming */}
        <section className="float-in d-2 mt-8">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-text-muted mb-3">
            What's coming
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[
              {
                icon: 'fa-bolt',
                title: 'REX-drafted variants',
                copy: 'A/B test subjects, pick the winner automatically.',
              },
              {
                icon: 'fa-clock-rotate-left',
                title: 'Stop-on-reply by default',
                copy: 'No more accidental nudges to people who already replied.',
              },
              {
                icon: 'fa-chart-line',
                title: 'Per-step reply rates',
                copy: 'See exactly which step is leaking and fix it inline.',
              },
            ].map((c) => (
              <div
                key={c.title}
                className="bg-white rounded-xl p-4"
                style={{ border: '1px solid #ECECEC' }}
              >
                <div className="w-9 h-9 rounded-lg grad-icon flex items-center justify-center text-white mb-2.5">
                  <i className={`fa-solid ${c.icon} text-[12px]`} />
                </div>
                <div className="font-bold text-[13.5px] mb-1">{c.title}</div>
                <p className="text-[12px] text-text-secondary leading-relaxed">{c.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
