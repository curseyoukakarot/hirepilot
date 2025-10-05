// Minimal Browserless WebRTC starter (placeholder)
// Returns a stream URL the frontend can iframe, and a remoteDebugUrl for CDP

export type WebrtcStartResult = { streamUrl: string; remoteDebugUrl: string };

async function firstReachable(urls: string[]): Promise<string> {
  const fetch = (await import('node-fetch')).default as any;
  for (const u of urls) {
    try {
      const resp = await fetch(u, { method: 'GET', redirect: 'follow' as any, timeout: 4000 });
      const ok = resp.status >= 200 && resp.status < 400;
      if (ok) return u;
    } catch {}
  }
  throw new Error('No reachable Browserless stream endpoint');
}

export async function startWebrtcSession(sessionId: string): Promise<WebrtcStartResult> {
  const base = (process.env.BROWSERLESS_BASE_URL || '').replace(/\/$/, '');
  const token = process.env.BROWSERLESS_TOKEN || '';
  if (!base || !token) throw new Error('Browserless not configured. Set BROWSERLESS_BASE_URL and BROWSERLESS_TOKEN.');

  const candidates = [
    `${base}/webrtc?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`,
    `${base}/playwright/webrtc?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`,
    `${base}/?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`
  ];
  const streamUrl = await firstReachable(candidates);

  // CDP endpoint (best-effort): most servers accept token as a query param
  const remoteDebugUrl = `${base.replace(/^http/, 'ws')}/devtools/browser?token=${encodeURIComponent(token)}`;
  return { streamUrl, remoteDebugUrl };
}


