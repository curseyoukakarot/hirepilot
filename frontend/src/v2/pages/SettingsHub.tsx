/**
 * v2 / Settings Hub — landing page at /v2/settings
 *
 * Wave 3 — single jump-off point for every settings surface. Replaces
 * the "All Settings" sidebar link bouncing to legacy /settings.
 *
 * Each card links to a /v2/settings/* sub-route. Most sub-routes wrap
 * legacy Settings (V2SettingsWrapper); the team tab has a native v2
 * page already.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import WorkspaceShell from '../components/WorkspaceShell';
import { useV2Theme } from '../hooks/useV2Theme';

interface Tile {
  href: string;
  icon: string;
  iconBg: string;
  title: string;
  copy: string;
  badge?: string;
  external?: boolean;
}

const TILES: Tile[] = [
  {
    href: '/v2/settings/team',
    icon: 'fa-people-roof',
    iconBg: 'linear-gradient(135deg,#6B46C1,#0C5CF4)',
    title: 'Team',
    copy: 'Workspace identity, members, sharing defaults, plan, danger zone.',
    badge: 'Native v2',
  },
  {
    href: '/v2/settings/profile',
    icon: 'fa-user',
    iconBg: 'linear-gradient(135deg,#0EA5E9,#0D9488)',
    title: 'Profile',
    copy: 'Your name, photo, contact info, and timezone.',
  },
  {
    href: '/v2/settings/integrations',
    icon: 'fa-plug',
    iconBg: 'linear-gradient(135deg,#10B981,#0D9488)',
    title: 'Integrations',
    copy: 'Slack, Gmail/Outlook, Calendar, LinkedIn, Apollo, GitHub, Stripe.',
  },
  {
    href: '/v2/settings/notifications',
    icon: 'fa-bell',
    iconBg: 'linear-gradient(135deg,#F59E0B,#EA580C)',
    title: 'Notifications',
    copy: 'Daily digest, mentions, decision alerts, REX activity.',
  },
  {
    href: '/v2/settings/api',
    icon: 'fa-key',
    iconBg: 'linear-gradient(135deg,#475569,#1E40AF)',
    title: 'API & Webhooks',
    copy: 'Tokens for Zapier, n8n, custom automations.',
  },
  {
    href: '/v2/settings/credits',
    icon: 'fa-coins',
    iconBg: 'linear-gradient(135deg,#F59E0B,#F43F5E)',
    title: 'Credits',
    copy: 'House credits balance, BYOK status, top-ups.',
  },
  {
    href: '/v2/settings/team',
    icon: 'fa-shield-halved',
    iconBg: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
    title: 'Guardrails',
    copy: 'Spend caps, daily limits, the trust ladder.',
  },
  {
    href: '/v2/settings/team',
    icon: 'fa-credit-card',
    iconBg: 'linear-gradient(135deg,#0EA5E9,#0284C7)',
    title: 'Billing',
    copy: 'Subscription, invoices, payment methods (via Stripe portal).',
  },
];

export default function SettingsHubPage() {
  useV2Theme();

  return (
    <WorkspaceShell autopilot>
      <header className="border-b border-gray-100 px-8 h-14 glass flex items-center gap-4 sticky top-0 z-30">
        <div className="font-semibold text-[14.5px] flex items-center gap-2">
          <i className="fa-solid fa-gear text-primary text-xs" />
          Settings
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 ring-2 ring-white" />
        </div>
      </header>

      <div className="px-8 py-10 max-w-[1180px] mx-auto">
        {/* Hero */}
        <section className="float-in mb-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-1.5">
            <i className="fa-solid fa-gear text-[10px] mr-1" />
            Workspace settings
          </div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Tune HirePilot to your team.</h1>
          <p className="text-text-secondary text-[14px] mt-1.5 max-w-2xl">
            Identity, integrations, billing, guardrails — everything in one
            place. Most surfaces still live in the classic UI; we're porting
            them to v2 one section at a time.
          </p>
        </section>

        {/* Tile grid */}
        <section className="float-in d-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TILES.map((t) => (
              <Link
                key={t.title + t.href}
                to={t.href}
                className="group bg-white rounded-xl p-5 flex items-start gap-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ border: '1px solid #ECECEC' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: t.iconBg }}
                >
                  <i className={`fa-solid ${t.icon} text-[15px]`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-[14px]">{t.title}</span>
                    {t.badge && (
                      <span className="tag tag-success">{t.badge}</span>
                    )}
                    <i className="fa-solid fa-arrow-right text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition ml-auto" />
                  </div>
                  <p className="text-[12.5px] text-text-secondary leading-relaxed">{t.copy}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Roadmap callout */}
        <section className="float-in d-2 mt-8">
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
                Voice & tone, automations, security &amp; 2FA — native v2 surfaces
                so you can manage every guardrail without leaving the app.
              </span>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
