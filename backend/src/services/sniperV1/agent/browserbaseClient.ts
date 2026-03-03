import Browserbase from '@browserbasehq/sdk';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = String(process.env.BROWSERBASE_API_KEY || '').trim();
  if (!key) throw new Error('BROWSERBASE_API_KEY is not set');
  return key;
}

function getProjectId(): string {
  const id = String(process.env.BROWSERBASE_PROJECT_ID || '').trim();
  if (!id) throw new Error('BROWSERBASE_PROJECT_ID is not set');
  return id;
}

export function browserbaseEnabled(): boolean {
  return String(process.env.BROWSERBASE_PROVIDER_ENABLED || 'false').toLowerCase() === 'true';
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: Browserbase | null = null;

function getClient(): Browserbase {
  if (!_client) {
    _client = new Browserbase({ apiKey: getApiKey() });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Context management (persistent browser profiles)
// ---------------------------------------------------------------------------

export type BrowserbaseContext = {
  id: string;
  name: string;
};

/**
 * Create a persistent browser context (stores cookies, localStorage, etc.)
 * This is the Browserbase equivalent of Airtop's profile persistence.
 */
export async function createContext(name: string): Promise<string> {
  const client = getClient();
  const context = await client.contexts.create({
    projectId: getProjectId(),
  });
  return context.id;
}

/**
 * Retrieve an existing context by ID (to verify it still exists).
 */
export async function getContext(contextId: string): Promise<any | null> {
  try {
    const client = getClient();
    const context = await client.contexts.retrieve(contextId);
    return context;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export type BrowserbaseSessionInfo = {
  sessionId: string;
  connectUrl: string;
  liveViewUrl: string;
  contextId?: string;
};

/**
 * Create a new browser session, optionally reusing a persistent context.
 */
export async function createSession(opts?: {
  contextId?: string;
  timeoutMinutes?: number;
}): Promise<BrowserbaseSessionInfo> {
  const client = getClient();

  const createOpts: any = {
    projectId: getProjectId(),
    proxies: true, // Use Browserbase residential proxies to avoid LinkedIn CAPTCHA loops
  };

  if (opts?.contextId) {
    createOpts.browserSettings = {
      context: { id: opts.contextId, persist: true },
    };
  }

  if (opts?.timeoutMinutes) {
    createOpts.timeout = opts.timeoutMinutes * 60; // Browserbase uses seconds
  }

  const session = await client.sessions.create(createOpts);

  // Get debug connection URLs
  const debugUrls = await getSessionDebugUrls(session.id);

  return {
    sessionId: session.id,
    connectUrl: debugUrls.connectUrl,
    liveViewUrl: debugUrls.liveViewUrl,
    contextId: opts?.contextId || undefined,
  };
}

/**
 * Get the CDP connection URL and live view URL for a session.
 */
async function getSessionDebugUrls(sessionId: string): Promise<{
  connectUrl: string;
  liveViewUrl: string;
}> {
  const client = getClient();
  const debugInfo = await client.sessions.debug(sessionId);
  return {
    // CDP connection is always via the standard Browserbase connect endpoint
    connectUrl: `wss://connect.browserbase.com?apiKey=${getApiKey()}&sessionId=${sessionId}`,
    // Live view: the debugger fullscreen URL is the embeddable iframe view
    liveViewUrl: debugInfo.debuggerFullscreenUrl || `https://www.browserbase.com/sessions/${sessionId}`,
  };
}

/**
 * Connect to a Browserbase session via Playwright CDP.
 * Returns browser, context, and page - same pattern as connectAirtopPlaywright.
 */
export async function connectPlaywright(sessionId: string): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const connectUrl = `wss://connect.browserbase.com?apiKey=${getApiKey()}&sessionId=${sessionId}`;

  const browser = await chromium.connectOverCDP(connectUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  return { browser, context, page };
}

/**
 * Terminate a browser session. The persistent context is saved automatically.
 */
export async function terminateSession(sessionId: string): Promise<void> {
  try {
    const client = getClient();
    await client.sessions.update(sessionId, {
      status: 'REQUEST_RELEASE',
    } as any);
  } catch (e: any) {
    // Session may already be terminated
    if (!String(e?.message || '').includes('already')) {
      console.warn(`[browserbase] Failed to terminate session ${sessionId}:`, e?.message);
    }
  }
}

/**
 * Get the live view URL for a session (for user to log into LinkedIn).
 */
export async function getLiveViewUrl(sessionId: string): Promise<string> {
  const urls = await getSessionDebugUrls(sessionId);
  return urls.liveViewUrl;
}
