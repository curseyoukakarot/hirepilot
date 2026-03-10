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

    // Navigate to the profile
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Wait for profile to fully render (action buttons etc.)
    await waitForProfileReady(page);

    // Heavy page handling: wait for networkidle + action buttons
    const isProfilePage = /linkedin\.com\/in\//i.test(profileUrl);
    if (isProfilePage) {
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      await page
        .waitForSelector(
          [
            'button:has-text("Connect")',
            'button:has-text("Pending")',
            'button:has-text("Message")',
            'button:has-text("Follow")',
            'button:has-text("More")',
            'button[aria-label="More actions"]',
            'button.artdeco-dropdown__trigger',
          ].join(', '),
          { timeout: 8_000 },
        )
        .catch(() => {
          console.warn('[session-mgr] Profile action buttons did not appear within 8s — proceeding anyway');
        });
    }

    // Check for auth wall
    if (isAuthWallUrl(page.url())) {
      throw new Error('LINKEDIN_AUTH_REQUIRED: Browser session landed on login/checkpoint page');
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
    console.log(`[session-mgr] Creating new session for job ${this.jobId} (context: ${this.contextId.slice(0, 8)}…)`);

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

    // Skip /feed auth check — navigateToProfile() already checks for auth walls
    // when it navigates to the actual profile URL. Going to /feed first wastes
    // an entire page load + 2s and was causing sessions to die before reaching profiles.
    console.log(`[session-mgr] Session ${sessionInfo.sessionId} created for job ${this.jobId} — auth will be verified on first profile navigation`);

    return this.session.page;
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
