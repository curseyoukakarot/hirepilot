import React from 'react';

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
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">REX</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Job Seeker Command Center
          </div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
            Outreach-first workflow. No spam. Just leverage.
          </div>
        </div>
      </div>
      <nav className="mt-4 flex-1 px-2">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Navigation
        </div>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = currentPath === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={[
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                    active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-lg border',
                      active
                        ? 'border-white/10 bg-white/10 dark:border-zinc-200/40 dark:bg-zinc-900'
                        : 'border-zinc-200 bg-white group-hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:group-hover:bg-zinc-900',
                    ].join(' ')}
                  >
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <span className="font-medium">Need help?</span>
          <span className="text-zinc-500 dark:text-zinc-400">Ask REX →</span>
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
