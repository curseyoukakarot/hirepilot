import WebSocket from 'ws';
import { encryptToBase64 } from '../crypto/encryption';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function cdpSend(ws: WebSocket, id: number, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          ws.off('message', onMessage);
          resolve(msg.result);
        }
      } catch {}
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.off('message', onMessage); reject(new Error('CDP timeout')); }, 10000);
  });
}

export async function harvestCookies(sessionId: string, remoteDebugUrl: string) {
  const ws = new WebSocket(remoteDebugUrl);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  const { targetId } = await cdpSend(ws, 1, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId: cdpSessionId } = await cdpSend(ws, 2, 'Target.attachToTarget', { targetId, flatten: true });

  const invoke = (id: number, method: string, params: any = {}) =>
    cdpSend(ws, id, method, { ...params, sessionId: cdpSessionId });

  const cookies = await invoke(3, 'Network.getAllCookies');
  const list = cookies.cookies || [];
  const liAt = list.find((c: any) => c.name === 'li_at');
  if (!liAt) throw new Error('li_at not found; user likely not logged in');

  const cookiesJson = JSON.stringify(list);
  const enc = encryptToBase64(cookiesJson);

  await supabase.from('linkedin_sessions')
    .update({ cookies_encrypted: enc, status: 'active', last_login_at: new Date().toISOString(), last_refresh_at: new Date().toISOString() })
    .eq('id', sessionId);

  // Build a simple name→value map for convenience (filter to linkedin hosts only)
  const cookieMap: Record<string, string> = {};
  for (const c of list) {
    try {
      if (typeof c?.domain === 'string' && /linkedin\./i.test(c.domain)) {
        cookieMap[c.name] = String(c.value ?? '');
      }
    } catch {}
  }

  ws.close();
  return { cookieCount: list.length, hasLiAt: true, cookies: cookieMap };
}


