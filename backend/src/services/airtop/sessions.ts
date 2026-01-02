import { getAirtopClient } from './airtopClient';

export type AirtopSession = { id: string; cdpWsUrl?: string | null };
export type AirtopWindow = { id: string };

export async function createSession(opts?: { profileName?: string; timeoutMinutes?: number }) {
  const client = getAirtopClient();
  const configuration: any = {};
  if (opts?.profileName) configuration.profileName = opts.profileName;
  if (typeof opts?.timeoutMinutes === 'number') configuration.timeoutMinutes = opts.timeoutMinutes;
  const session: any = await client.sessions.create(Object.keys(configuration).length ? { configuration } : undefined);
  return session;
}

export async function createWindow(sessionId: string, opts: { url: string }) {
  const client = getAirtopClient();
  const win: any = await client.windows.create(sessionId, { url: opts.url });
  return win;
}

export async function getLiveViewUrl(sessionId: string, windowId: string): Promise<string> {
  const client = getAirtopClient();
  const info: any = await client.windows.getWindowInfo(sessionId, windowId);
  const url = info?.data?.liveViewUrl;
  if (!url) throw new Error('liveViewUrl missing from Airtop window info');
  return String(url);
}

export async function saveProfileOnTermination(sessionId: string, profileName: string) {
  const client = getAirtopClient();
  await client.sessions.saveProfileOnTermination(sessionId, profileName);
}

export async function terminateSession(sessionId: string) {
  const client = getAirtopClient();
  await client.sessions.terminate(sessionId);
}


