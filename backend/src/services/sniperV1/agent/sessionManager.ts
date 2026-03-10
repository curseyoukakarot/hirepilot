import type { Browser, Page } from 'playwright';
import {
  createSession,
  connectPlaywright,
  terminateSession,
  type BrowserbaseSessionInfo,
} from './browserbaseClient';
import { waitForProfileReady, isAuthWallUrl } from '../providers/linkedinActions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionManagerOpts = {
  contextId: string;
  jobId: string;
  timeoutMinutes?: number; // default 30
};

type ManagedSession = {
  sessionId: string;
  browser: Browser;
  page: Page;
  createdAt: number;
  itemsProcessed: number;
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export function isSessionDeadError(error: any): boolean {
  const msg = String(error?.message || '');
  return (
    msg.includes('Target closed') ||
    msg.includes('Browser closed') ||
    msg.includes('Session ended') ||
    msg.includes('Connection refused') ||
    msg.includes('Protocol error') ||
    msg.includes('Connection closed') ||
    msg.includes('browser has been closed') ||
    msg.includes('Target page, context or browser has been closed') ||
    msg.includes('Session timed out')
  );
}

/** Transient proxy/network errors that may resolve on retry (page reload). */
export function isTransientNetworkError(error: any): boolean {
  const msg = String(error?.message || '');
  return (
    msg.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
    msg.includes('ERR_PROXY_CONNECTION_FAILED') ||
    msg.includes('ERR_CONNECTION_TIMED_OUT') ||
    msg.includes('ERR_CONNECTION_RESET') ||
    msg.includes('ERR_NETWORK_CHANGED') ||
    msg.includes('ERR_NAME_NOT_RESOLVED') ||
    msg.includes('ERR_INTERNET_DISCONNECTED') ||
    msg.includes('net::ERR_FAILED') ||
    msg.includes('NS_ERROR_NET_RESET') ||
    msg.includes('Timeout') // Playwright navigation timeout
  );
}

// ---------------------------------------------------------------------------
// SessionManager — manages a reusable session for the lifetime of a job
// ---------------------------------------------------------------------------

const MAX_RECOVERIES = 3;

export class SessionManager {
  private contextId: string;
  private jobId: string;
  private timeoutMinutes: number;
  private session: ManagedSession | null = null;
  private recoveryCount = 0;
  private released = false;

  constructor(opts: SessionManagerOpts) {
    this.contextId = opts.contextId;
    this.jobId = opts.jobId;
    this.timeoutMinutes = opts.timeoutMinutes ?? 30;
  }

  // -------------------------------------------------------------------------
  // acquire() — idempotent: creates session on first call, returns page after
  // -------------------------------------------------------------------------

  async acquire(): Promise<Page> {
    if (this.released) {
      throw new Error('SessionManager already released');
    }

    // Return existing page if session is alive
    if (this.session) {
      const alive = await this.isAlive();
      if (alive) return this.session.page;

      // Session died — try recovery
      console.warn(`[session-mgr] Session ${this.session.sessionId} died for job ${this.jobId}, recovering…`);
      return this.recover();
    }

    // First call — create new session
    return this._createSession();
  }

  // -------------------------------------------------------------------------
  // navigateToProfile() — navigate the reused page to a profile URL
  // -------------------------------------------------------------------------

  async navigateToProfile(profileUrl: string): Promise<Page> {
    const page = await this.acquire();

    const MAX_NAV_RETRIES = 3;
    const isProfilePage = /linkedin\.com\/in\//i.test(profileUrl);
    const ACTION_BTN_SELECTOR = [
      'button:text-matches("^Connect$", "i")',
      'button:text-matches("^Pending$", "i")',
      'button:text-matches("^Message$", "i")',
      'button:text-matches("^Follow$", "i")',
      'button:text-matches("^More$", "i")',
      'button[aria-label="More actions"]',
    ].join(', ');

    for (let attempt = 1; attempt <= MAX_NAV_RETRIES; attempt++) {
      try {
        // Navigate directly to the profile
        await page.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });

        // Check for proxy / tunnel errors rendered on the page
        const pageContent = await page.title().catch(() => '');
        const currentUrl = page.url();
        if (
          pageContent.includes("can't be reached") ||
          pageContent.includes('is not available') ||
          currentUrl === 'about:blank' ||
          currentUrl.startsWith('chrome-error://')
        ) {
          throw new Error(`ERR_TUNNEL_CONNECTION_FAILED: page showed error for ${profileUrl}`);
        }

        // Wait for action buttons — the only wait we need
        if (isProfilePage) {
          await page
            .waitForSelector(ACTION_BTN_SELECTOR, { timeout: 10_000 })
            .catch(() => {
              console.warn('[session-mgr] Profile action buttons did not appear within 10s — proceeding anyway');
            });
        }

        // Check for auth wall
        if (isAuthWallUrl(page.url())) {
          throw new Error('LINKEDIN_AUTH_REQUIRED: Browser session landed on login/checkpoint page');
        }

        // Success — break out of retry loop
        break;
      } catch (navErr: any) {
        const msg = String(navErr?.message || '');

        // Auth errors and session-dead errors should propagate immediately
        if (msg.includes('LINKEDIN_AUTH_REQUIRED')) throw navErr;
        if (isSessionDeadError(navErr)) throw navErr;

        // Transient proxy/network error — retry
        if (isTransientNetworkError(navErr) && attempt < MAX_NAV_RETRIES) {
          console.warn(
            `[session-mgr] Navigation attempt ${attempt}/${MAX_NAV_RETRIES} failed for ${profileUrl}: ${msg}. Retrying in ${attempt * 2}s…`,
          );
          await page.waitForTimeout(attempt * 2000).catch(() => {});
          continue;
        }

        // All retries exhausted with proxy/tunnel errors → the session's proxy died mid-job.
        // Recover with a new session (= new proxy) instead of failing the whole job.
        if (attempt >= MAX_NAV_RETRIES && isTransientNetworkError(navErr)) {
          console.error(
            `[session-mgr] All ${MAX_NAV_RETRIES} navigation retries failed with proxy error for ${profileUrl}. Triggering session recovery…`,
          );
          const freshPage = await this.recover();
          // One more try on the fresh session
          await freshPage.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          if (isAuthWallUrl(freshPage.url())) {
            throw new Error('LINKEDIN_AUTH_REQUIRED: Browser session landed on login/checkpoint page');
          }
          if (isProfilePage) {
            await freshPage.waitForSelector(ACTION_BTN_SELECTOR, { timeout: 10_000 }).catch(() => {
              console.warn('[session-mgr] Profile action buttons did not appear within 10s after recovery — proceeding anyway');
            });
          }
          if (this.session) this.session.itemsProcessed++;
          return freshPage;
        }

        // Final attempt or unknown error — propagate
        if (attempt >= MAX_NAV_RETRIES) {
          console.error(`[session-mgr] All ${MAX_NAV_RETRIES} navigation attempts failed for ${profileUrl}: ${msg}`);
        }
        throw navErr;
      }
    }

    if (this.session) {
      this.session.itemsProcessed++;
    }

    return page;
  }

  // -------------------------------------------------------------------------
  // isAlive() — check if the session/page is still responsive
  // -------------------------------------------------------------------------

  async isAlive(): Promise<boolean> {
    if (!this.session) return false;
    try {
      // Quick check — if page.url() throws, session is dead
      await this.session.page.url();
      // Double-check: try evaluating a simple expression
      await this.session.page.evaluate(() => true).catch(() => {
        throw new Error('Page evaluation failed');
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // recover() — teardown dead session, create new one
  // -------------------------------------------------------------------------

  async recover(): Promise<Page> {
    this.recoveryCount++;

    if (this.recoveryCount > MAX_RECOVERIES) {
      throw new Error(
        `SessionManager: exceeded max recoveries (${MAX_RECOVERIES}) for job ${this.jobId}. Session unrecoverable.`,
      );
    }

    console.warn(
      `[session-mgr] Recovering session (attempt ${this.recoveryCount}/${MAX_RECOVERIES}) for job ${this.jobId}`,
    );

    // Teardown old session
    await this._teardown();

    // Create fresh session
    return this._createSession();
  }

  // -------------------------------------------------------------------------
  // release() — terminate session at end of job
  // -------------------------------------------------------------------------

  async release(): Promise<void> {
    if (this.released) return;
    this.released = true;

    const items = this.session?.itemsProcessed || 0;
    const sessionId = this.session?.sessionId || 'none';
    console.log(
      `[session-mgr] Releasing session ${sessionId} for job ${this.jobId} (${items} items processed, ${this.recoveryCount} recoveries)`,
    );

    await this._teardown();
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  get sessionId(): string | null {
    return this.session?.sessionId || null;
  }

  get itemsProcessed(): number {
    return this.session?.itemsProcessed || 0;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async _createSession(): Promise<Page> {
    const MAX_SESSION_ATTEMPTS = 3;

    for (let sessionAttempt = 1; sessionAttempt <= MAX_SESSION_ATTEMPTS; sessionAttempt++) {
      console.log(
        `[session-mgr] Creating new session for job ${this.jobId} (context: ${this.contextId.slice(0, 8)}…)` +
          (sessionAttempt > 1 ? ` [attempt ${sessionAttempt}/${MAX_SESSION_ATTEMPTS} — previous proxy was dead]` : ''),
      );

      const sessionInfo: BrowserbaseSessionInfo = await createSession({
        contextId: this.contextId,
        timeoutMinutes: this.timeoutMinutes,
      });

      const conn = await connectPlaywright(sessionInfo.sessionId);

      this.session = {
        sessionId: sessionInfo.sessionId,
        browser: conn.browser,
        page: conn.page,
        createdAt: Date.now(),
        itemsProcessed: 0,
      };

      // --- Proxy health check ---
      // Navigate to a lightweight LinkedIn page to verify the proxy tunnel works.
      // Browserbase assigns ONE residential proxy per session — if it's dead,
      // every request in this session will fail. Catch it early.
      try {
        await conn.page.goto('https://www.linkedin.com/robots.txt', {
          waitUntil: 'domcontentloaded',
          timeout: 15_000,
        });

        const title = await conn.page.title().catch(() => '');
        const url = conn.page.url();
        if (
          title.includes("can't be reached") ||
          title.includes('is not available') ||
          url === 'about:blank' ||
          url.startsWith('chrome-error://')
        ) {
          throw new Error('Proxy health check failed: page showed connection error');
        }

        console.log(`[session-mgr] Session ${sessionInfo.sessionId} proxy health check passed ✓`);
        return this.session.page;
      } catch (healthErr: any) {
        const msg = String(healthErr?.message || '');
        console.warn(
          `[session-mgr] Proxy health check FAILED for session ${sessionInfo.sessionId}: ${msg}`,
        );

        // Teardown the bad session
        await this._teardown();

        if (sessionAttempt >= MAX_SESSION_ATTEMPTS) {
          throw new Error(
            `SessionManager: proxy health check failed after ${MAX_SESSION_ATTEMPTS} session attempts for job ${this.jobId}: ${msg}`,
          );
        }

        // Brief pause before creating a new session (new proxy assignment)
        console.log(`[session-mgr] Will create new session with fresh proxy in 2s…`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Should never reach here, but satisfy TS
    throw new Error('SessionManager: _createSession() exhausted all attempts');
  }

  private async _teardown(): Promise<void> {
    if (!this.session) return;

    const { sessionId, browser } = this.session;
    this.session = null;

    try {
      if (browser) await browser.close();
    } catch (e: any) {
      console.warn(`[session-mgr] browser.close() failed for ${sessionId}: ${e.message}`);
    }

    try {
      await terminateSession(sessionId);
    } catch (e: any) {
      console.warn(`[session-mgr] terminateSession() failed for ${sessionId}: ${e.message}`);
    }
  }
}
