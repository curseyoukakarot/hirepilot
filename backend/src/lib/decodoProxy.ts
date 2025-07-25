import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch, { HeadersInit } from 'node-fetch';

import { HIREPILOT_UA } from './constants';

const host = 'unblock.decodo.com';
const port = 60000;
const user = process.env.DECODO_USER!;
const pass = process.env.DECODO_PASS!;

const proxyUrl = `http://${user}:${pass}@${host}:${port}`;

// Reusable proxy agent configured for Decodo Site Unblocker
export const decodoAgent = new HttpsProxyAgent(proxyUrl);

/**
 * Fetch HTML from a URL via the Decodo Site Unblocker proxy.
 * Logs content-length for bandwidth tracking.
 */
export async function fetchHtml(
  url: string,
  cookie: string,
  extraHeaders: HeadersInit = {}
): Promise<{ html: string; size: number }> {
  const res = await fetch(
    `${url}?render=true`,
    {
      // agent: decodoAgent as unknown as any, // temporarily disabled – fallback to Smartproxy/default
      // Node-fetch types don't include timeout; cast to any to suppress.
      timeout: 25_000,
      headers: {
        Cookie: cookie,
        'User-Agent': HIREPILOT_UA,
        ...extraHeaders,
      },
    } as any,
  );

  if (!res.ok) {
    throw new Error(`Decodo ${res.status} ${res.statusText}`);
  }

  return {
    html: await res.text(),
    size: Number(res.headers.get('content-length') || 0),
  };
}

export function pickDecodoPort(): number {
  const ports = (process.env.DECODO_PORTS || '10001,10002,10003,10004,10005,10006,10007')
    .split(',')
    .map(p => Number(p.trim()))
    .filter(Boolean);
  return ports[Math.floor(Math.random() * ports.length)];
} 