import React, { useEffect, useState } from 'react';

type Props = {
  show: boolean;
};

const DISMISS_KEY = 'hp_ph_banner_dismissed_until';

export default function PromoBanner({ show }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (!until || Date.now() > Number(until)) setVisible(true);
      else setVisible(false);
    } catch { setVisible(true); }
  }, [show]);

  if (!visible) return null;

  const dismiss = (days = 7) => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000)); } catch {}
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60]">
      <div className="mx-auto max-w-7xl px-4 pb-4">
        <div className="relative rounded-2xl shadow-2xl border border-orange-200 bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <a
            href="/producthunt?utm_source=site&utm_medium=banner&utm_campaign=ph_launch"
            className="block w-full px-5 py-3 text-center text-sm sm:text-base font-semibold hover:opacity-95"
            onClick={() => {
              try { (window as any).dataLayer = (window as any).dataLayer || []; (window as any).dataLayer.push({ event: 'ph_banner_click' }); } catch {}
            }}
          >
            🚀 Claim 500 Free Credits on New Signups — Product Hunt promo live!
          </a>
          <button
            aria-label="Dismiss banner"
            onClick={() => dismiss(7)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white/20 hover:bg-white/30 p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


