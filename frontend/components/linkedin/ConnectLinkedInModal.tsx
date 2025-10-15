import React, { useEffect, useState } from 'react';

type Props = { open: boolean; onClose: () => void; userId: string };

export default function ConnectLinkedInModal({ open, onClose, userId }: Props) {
  const [sessionId, setSessionId] = useState<string>();
  const [streamUrl, setStreamUrl] = useState<string>();
  const [status, setStatus] = useState<'idle'|'starting'|'ready'|'error'|'success'>('idle');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setStatus('starting');
    fetch('/linkedin/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ streamMode: 'novnc' })
    }).then(r => r.json()).then(d => {
      if (d.error) throw new Error(d.error);
      setSessionId(d.sessionId); setStreamUrl(d.streamUrl);
      setStatus('ready');
    }).catch(e => { setError(e.message); setStatus('error'); });
  }, [open]);

  async function complete() {
    if (!sessionId) return;
    const r = await fetch('/linkedin/session/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ sessionId })
    });
    const d = await r.json();
    if (d.error) { setError(d.error); setStatus('error'); return; }
    setStatus('success');
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Connect LinkedIn (Remote Session)</h2>
          <p className="text-sm text-gray-500">Log into LinkedIn below. Your password never leaves LinkedIn.</p>
        </div>
        <div className="p-0">
          {streamUrl ? (
            <iframe
              src={streamUrl}
              className="w-full h-[540px]"
              // allow='clipboard-write' makes login copy/paste less painful
              sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock allow-popups allow-popups-to-escape-sandbox"
              allow="clipboard-write"
            />
          ) : (
            <div className="h-[540px] flex items-center justify-center text-gray-500">Starting remote session…</div>
          )}
        </div>
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm">
            {status === 'ready' && <span>Step 1: Log in inside the window. Step 2: Click “I’m logged in”.</span>}
            {status === 'success' && <span className="text-green-600">✅ Session connected.</span>}
            {error && <span className="text-red-600">Error: {error}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded border">Close</button>
            <button onClick={complete} disabled={status!=='ready'} className="px-3 py-2 rounded bg-black text-white disabled:opacity-50">I’m logged in</button>
          </div>
        </div>
      </div>
    </div>
  );
}


