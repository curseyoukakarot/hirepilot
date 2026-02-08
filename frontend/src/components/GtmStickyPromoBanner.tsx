import React, { useEffect, useState } from 'react';

type Props = {
  show?: boolean;
  href?: string;
};

const DISMISS_KEY = 'hp_gtm_banner_dismissed_until';

export default function GtmStickyPromoBanner({
  show = true,
  href = '/gtm-strategy/teaser',
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (!until || Date.now() > Number(until)) setVisible(true);
      else setVisible(false);
    } catch {
      setVisible(true);
    }
  }, [show]);

  if (!visible) return null;

  const dismiss = (days = 7) => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000)); } catch {}
    setVisible(false);
  };

  return (
    <div className="sticky top-20 z-[49] w-full">
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative mt-2 mb-3 rounded-2xl border border-indigo-200/20 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-2xl">
          <a
            href={href}
            className="block w-full px-5 py-3 text-center text-sm sm:text-base font-semibold hover:opacity-95"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <span className="hidden sm:inline">New:</span>
              <span>Get the 2026 GTM Strategy Guide →</span>
            </span>
          </a>
          <button
            aria-label="Dismiss banner"
            onClick={() => dismiss(7)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white/20 hover:bg-white/30 p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


