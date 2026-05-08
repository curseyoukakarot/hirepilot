/**
 * v2 / Reports — analytics hub
 *
 * SHELL stub for Wave 1: gives the WorkspaceSidebar "Reports" link a
 * real v2 destination. Surfaces the legacy /messaging-reports surface
 * as a quick jump while the v2 charts get built.
 *
 * Wave 5 will port the existing reports + add per-agent / per-skill
 * breakdowns (REX: which agents are saving you the most time, which
 * skills are converting, etc.).
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

const REPORT_TILES = [
  {
    icon: 'fa-envelope-open-text',
    title: 'Outbound performance',
    copy: 'Reply rates per campaign, per step, per template.',
    href: '/messaging-reports',
    accent: '#10B981',
  },
  {
    icon: 'fa-handshake',
    title: 'Pipeline velocity',
    copy: 'Stage-by-stage hand-off times and stuck candidates.',
    href: '/analytics',
    accent: '#0C5CF4',
  },
  {
    icon: 'fa-chart-pie',
    title: 'Source mix',
    copy: 'LinkedIn vs Apollo vs CSV — which channel actually replies?',
    href: '/messaging-reports',
    accent: '#F59E0B',
  },
  {
    icon: 'fa-wand-magic-sparkles',
    title: 'REX impact',
    copy: 'Hours saved by each specialist this week.',
    href: '/messaging-reports',
    accent: '#6B46C1',
  },
];

export default function ReportsPage() {
  useV2Theme();

  return (
    <WorkspaceShell autopilot>
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-chart-line text-primary text-xs" />
          Reports
        </div>
        <div className="status-pill ml-3">
          <i className="fa-solid fa-bolt text-warn text-[10px]" />
          <span>v2 charts coming soon</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <a href="/messaging-reports" className="btn-outline">
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
            Open in classic UI
          </a>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-10 max-w-[1100px] mx-auto">
        {/* Hero */}
        <section
          className="float-in d-1 rounded-2xl p-8 mb-8"
          style={{
            background:
              'linear-gradient(135deg,rgba(12,92,244,.06),rgba(107,70,193,.04) 60%,transparent)',
            border: '1px solid rgba(12,92,244,.15)',
          }}
        >
          <div className="flex items-start gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg"
              style={{
                background: 'linear-gradient(135deg,#0C5CF4,#6B46C1)',
                boxShadow: '0 12px 30px -10px rgba(12,92,244,.4)',
              }}
            >
              <i className="fa-solid fa-chart-line text-[20px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-extrabold tracking-tight mb-1">Reports</h1>
              <p className="text-text-secondary text-[14px] max-w-2xl">
                Charts you'll actually open. We're rebuilding analytics in v2 with
                per-agent and per-skill breakdowns. For now, your existing reports
                are one click away.
              </p>
            </div>
          </div>
        </section>

        {/* Quick jumps */}
        <section className="float-in d-2">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-text-muted mb-3">
            Quick reports
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {REPORT_TILES.map((t) => (
              <a
                key={t.title}
                href={t.href}
                className="group bg-white rounded-xl p-5 flex items-start gap-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ border: '1px solid #ECECEC' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: t.accent }}
                >
                  <i className={`fa-solid ${t.icon} text-[15px]`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[14px] truncate">{t.title}</span>
                    <i
                      className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-50 group-hover:opacity-100 transition"
                      title="opens in classic UI"
                    />
                  </div>
                  <p className="text-[12.5px] text-text-secondary leading-relaxed">{t.copy}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Roadmap callout */}
        <section className="float-in d-3 mt-8">
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              background: 'linear-gradient(90deg,rgba(107,70,193,.05),rgba(12,92,244,.03))',
              border: '1px solid rgba(107,70,193,.12)',
            }}
          >
            <div className="w-8 h-8 rounded-md grad-icon flex items-center justify-center text-white">
              <i className="fa-solid fa-wand-magic-sparkles text-[12px]" />
            </div>
            <div className="flex-1 text-[12.5px]">
              <span className="font-semibold">Coming next:</span>
              <span className="text-text-secondary ml-1">
                REX-narrated weekly recap, "biggest wins this week," and a
                hours-saved leaderboard per agent.
              </span>
            </div>
            <Link to="/v2/today" className="btn-outline">
              <i className="fa-solid fa-arrow-left text-[10px] rotate-180" />
              Back to Today
            </Link>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
