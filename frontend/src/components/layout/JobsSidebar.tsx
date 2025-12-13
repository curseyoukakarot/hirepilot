import React from 'react';
import { motion } from 'framer-motion';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type JobsSidebarProps = {
  items: NavItem[];
  currentPath?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
};

export function JobsSidebar({
  items,
  currentPath,
  isOpenMobile = false,
  onCloseMobile,
}: JobsSidebarProps) {
  const SidebarBody = (
    <aside className="flex min-h-screen w-64 flex-col bg-[#050915] border-r border-slate-800/60">
      <div className="px-4 pt-6">
        <div className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 shadow-lg shadow-black/30">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">REX</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">Job Seeker Command Center</div>
          <div className="mt-2 text-xs text-slate-400">Outreach-first workflow. No spam. Just leverage.</div>
        </div>
      </div>
      <nav className="mt-5 flex-1 px-3">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Navigation</div>
        <ul className="space-y-2">
          {items.map((item) => {
            const active = currentPath === item.href;
            return (
              <li key={item.href}>
                <motion.a
                  href={item.href}
                  whileHover={{ x: 2 }}
                  className={[
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition border',
                    active
                      ? 'border-slate-700 bg-slate-800/70 text-slate-50 shadow-[0_10px_40px_-25px_rgba(0,0,0,0.8)]'
                      : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/60',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-lg border transition',
                      active
                        ? 'border-slate-600 bg-slate-700/60 text-slate-50'
                        : 'border-slate-800 bg-slate-900 text-slate-400 group-hover:text-slate-100',
                    ].join(' ')}
                  >
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </motion.a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-slate-800/70 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
        >
          <span className="font-medium">Need help?</span>
          <span className="text-slate-400">Ask REX →</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block">{SidebarBody}</div>
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="absolute left-0 top-0 h-full">{SidebarBody}</div>
        </div>
      )}
    </>
  );
}
