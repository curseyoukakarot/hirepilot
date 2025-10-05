// Minimal Browserless WebRTC starter (placeholder)
// Returns a stream URL the frontend can iframe, and a remoteDebugUrl for CDP

export type WebrtcStartResult = { streamUrl: string; remoteDebugUrl: string };

export async function startWebrtcSession(sessionId: string): Promise<WebrtcStartResult> {
  const base = (process.env.BROWSERLESS_BASE_URL || '').replace(/\/$/, '');
  const token = process.env.BROWSERLESS_TOKEN || '';
  if (!base || !token) throw new Error('Browserless not configured. Set BROWSERLESS_BASE_URL and BROWSERLESS_TOKEN.');

  // Many Browserless deployments expose a hosted WebRTC player page. Adjust path as needed.
  const streamUrl = `${base}/webrtc?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
  // CDP endpoint (best-effort): most servers accept token as a query param
  const remoteDebugUrl = `${base.replace(/^http/, 'ws')}/devtools/browser?token=${encodeURIComponent(token)}`;
  return { streamUrl, remoteDebugUrl };
}


