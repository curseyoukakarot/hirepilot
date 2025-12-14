import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function JobsSidebar({
  items,
  currentPath,
  isOpenMobile = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}: JobsSidebarProps) {
  const navigate = useNavigate();

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signout error', e);
    } finally {
      navigate('/login');
    }
  }, [navigate]);

  const SidebarBody = (
    <aside
      className={[
        'flex min-h-screen flex-col bg-[#050915] border-r border-slate-800/60 transition-all duration-200',
        collapsed ? 'w-[72px]' : 'w-64',
      ].join(' ')}
    >
      <div className="px-4 pt-4 flex items-center justify-between">
        <div
          className={[
            'rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 shadow-lg shadow-black/30',
            collapsed ? 'w-full px-2 py-3 text-center' : '',
          ].join(' ')}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">REX</div>
          {!collapsed && (
            <>
              <div className="mt-1 text-sm font-semibold text-slate-100">Job Seeker Command Center</div>
              <div className="mt-2 text-xs text-slate-400">Outreach-first workflow. No spam. Just leverage.</div>
            </>
          )}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="ml-2 hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800 transition"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '«'}
          </button>
        )}
      </div>
      <nav className="mt-4 flex-1 px-3">
        {!collapsed && (
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Navigation</div>
        )}
        <ul className="space-y-2">
          {items.map((item) => {
            const active = currentPath === item.href;
            return (
              <li key={item.href}>
                <motion.a
                  href={item.href}
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  className={[
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition border',
                    active
                      ? 'border-slate-700 bg-slate-800/70 text-slate-50 shadow-[0_10px_40px_-25px_rgba(0,0,0,0.8)]'
                      : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/60',
                    collapsed ? 'justify-center' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-lg border transition shrink-0',
                      active
                        ? 'border-slate-600 bg-slate-700/60 text-slate-50'
                        : 'border-slate-800 bg-slate-900 text-slate-400 group-hover:text-slate-100',
                    ].join(' ')}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </motion.a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-slate-800/70 p-4 space-y-3">
        <button
          type="button"
          className={[
            'w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition',
            collapsed ? 'text-center px-0' : '',
          ].join(' ')}
          onClick={handleSignOut}
        >
          {collapsed ? '↩' : 'Sign out'}
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
