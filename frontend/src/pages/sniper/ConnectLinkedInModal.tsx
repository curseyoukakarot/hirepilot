import React, { useState } from 'react';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  open: boolean;
  authUrl: string | null;
  authError: string | null;
  authBusy: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReload: () => void;
  onOpenNewTab: () => void;
};

export default function ConnectLinkedInModal({
  open, authUrl, authError, authBusy,
  onClose, onComplete, onReload, onOpenNewTab,
}: Props) {
  const [iframeKey, setIframeKey] = useState(0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Connect LinkedIn</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Navigate to linkedin.com and log in, then click &quot;I&apos;m logged in&quot;. If the captcha loops, open the view in a new tab.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        {/* Browser view */}
        <div className="relative bg-slate-100 dark:bg-black/40">
          {authUrl ? (
            <>
              {/* Loading overlay */}
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 transition-opacity dark:bg-slate-950/90"
                id="bb-iframe-loader"
              >
                <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Loading cloud browser…</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">This may take a few seconds.</div>
              </div>
              <iframe
                key={iframeKey}
                src={authUrl}
                className="h-[70vh] w-full"
                sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock allow-popups allow-popups-to-escape-sandbox"
                allow="clipboard-write"
                onLoad={() => {
                  const el = document.getElementById('bb-iframe-loader');
                  if (el) el.style.display = 'none';
                }}
                onError={() => {}}
              />
            </>
          ) : (
            <div className="flex h-[70vh] flex-col items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="mt-3">Starting remote session…</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {authError ? <span className="text-rose-600 dark:text-rose-400">Error: {authError}</span> : 'Keep this window open until LinkedIn finishes loading.'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewTab}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open in new tab
            </button>
            <button
              onClick={() => { setIframeKey((k) => k + 1); onReload(); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reload view
            </button>
            <button
              onClick={onComplete}
              disabled={authBusy}
              className={cx(
                'rounded-xl px-4 py-2 text-xs font-semibold text-white',
                authBusy ? 'bg-slate-400 cursor-not-allowed dark:bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-500'
              )}
            >
              {authBusy ? 'Finalizing…' : "I'm logged in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
