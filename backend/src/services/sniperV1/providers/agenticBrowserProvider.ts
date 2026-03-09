import type { Page, Browser } from 'playwright';
import type { SniperExecutionProvider, LinkedInAuthStartResult, SendConnectResult, SendMessageResult, SendInMailResult, JobListing, DecisionMakerResult } from './types';
import type { ProspectProfile } from './linkedinActions';
import { normalizeLinkedinProfileUrl } from '../../../utils/linkedinUrl';

import {
  createContext,
  createSession,
  connectPlaywright,
  terminateSession,
  browserbaseEnabled,
} from '../agent/browserbaseClient';
import { createLLMClient } from '../agent/llmClient';
import { executeAgentTask, AgentResult } from '../agent/agentExecutor';
import {
  getProspectPostEngagersPrompt,
  getProspectPeopleSearchPrompt,
  getProspectJobsIntentPrompt,
  getProspectDecisionMakersPrompt,
  getSendConnectionRequestPrompt,
  getSendMessagePrompt,
  getSalesNavSearchPrompt,
  getSalesNavConnectPrompt,
  getSalesNavInMailPrompt,
  getSalesNavMessagePrompt,
} from '../agent/prompts';
import {
  getUserLinkedinAuth,
  upsertUserLinkedinAuth,
  createBrowserbaseAuthSession,
  getBrowserbaseAuthSession,
  markBrowserbaseAuthSession,
} from '../linkedinAuth';
import { sniperSupabaseDb } from '../supabase';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MAX_STEPS = Number(process.env.SNIPER_AGENT_MAX_STEPS || 20);
const DEFAULT_TIMEOUT_MS = Number(process.env.SNIPER_AGENT_TIMEOUT_MS || 120_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contextName(workspaceId: string, userId: string): string {
  return `hp-li-${workspaceId.slice(0, 8)}-${userId.slice(0, 8)}`;
}

/**
 * Get the Browserbase context ID for a user, or throw if not authed.
 */
async function requireBrowserbaseAuth(userId: string, workspaceId: string): Promise<string> {
  const auth = await getUserLinkedinAuth(userId, workspaceId);
  if (!auth?.browserbase_context_id) {
    throw new Error('LINKEDIN_AUTH_REQUIRED: No Browserbase session. User must log into LinkedIn first.');
  }
  if (auth.status === 'needs_reauth') {
    throw new Error('LINKEDIN_AUTH_REQUIRED: LinkedIn auth needs refresh. User must re-login.');
  }
  return auth.browserbase_context_id;
}

/**
 * Assert the page is on a valid LinkedIn page (not login/checkpoint).
 */
async function assertLinkedInAuthenticated(page: Page): Promise<void> {
  const url = page.url();
  const isLoginPage = url.includes('/login') || url.includes('/checkpoint') || url.includes('/authwall');
  if (isLoginPage) {
    throw new Error('LINKEDIN_AUTH_REQUIRED: Browser session landed on login/checkpoint page');
  }
}

/**
 * Run an agent task within a managed Browserbase session.
 * Handles session creation, connection, auth check, and cleanup.
 */
async function runWithSession<T>(
  userId: string,
  workspaceId: string,
  taskFn: (page: Page) => Promise<T>,
  opts?: { navigateTo?: string }
): Promise<T> {
  const contextId = await requireBrowserbaseAuth(userId, workspaceId);

  const session = await createSession({ contextId });
  let browser: Browser | null = null;

  try {
    const conn = await connectPlaywright(session.sessionId);
    browser = conn.browser;
    const page = conn.page;

    // Navigate to LinkedIn first to verify auth.
    // Profile pages, Sales Navigator, and company pages are heavy SPAs — use `load` and a longer settle.
    // All pages via residential proxy can be slow — use 60s timeout + retry on timeout.
    if (opts?.navigateTo) {
      const isSalesNav = opts.navigateTo.includes('/sales/');
      const isCompanyPage = opts.navigateTo.includes('/company/');
      const isProfilePage = /linkedin\.com\/in\//i.test(opts.navigateTo);
      const isHeavyPage = isSalesNav || isCompanyPage || isProfilePage;
      const navTimeout = 60_000; // 60s for all pages (residential proxy adds latency)
      const waitUntil = isHeavyPage ? 'load' as const : 'domcontentloaded' as const;
      const settleMs = isHeavyPage ? 3000 : 2000;

      // Retry once on navigation timeout — residential proxies can be flaky
      try {
        await page.goto(opts.navigateTo, { waitUntil, timeout: navTimeout });
      } catch (navErr: any) {
        const isTimeout = String(navErr?.message || '').includes('Timeout');
        if (isTimeout) {
          console.warn(`[agentic-browser] Initial page.goto timed out (${navTimeout}ms), retrying with commit strategy...`);
          await page.goto(opts.navigateTo, { waitUntil: 'commit', timeout: navTimeout });
          // After commit, wait for DOM to settle since we skipped full load
          await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
        } else {
          throw navErr;
        }
      }
      await page.waitForTimeout(settleMs);

      // For profile pages, wait for network idle to ensure action buttons (Connect/Pending/Message) render fully.
      // LinkedIn loads these buttons asynchronously — without this, the agent may see stale/missing elements.
      if (isProfilePage) {
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
        // Extra settle: wait for the profile action bar to appear in the DOM
        await page.waitForSelector(
          'button:has-text("Connect"), button:has-text("Pending"), button:has-text("Message"), button:has-text("Follow"), button:has-text("More")',
          { timeout: 8_000 }
        ).catch(() => {
          console.warn('[agentic-browser] Profile action buttons did not appear within 8s — proceeding anyway');
        });
      }
    } else {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000);
    }

    await assertLinkedInAuthenticated(page);

    return await taskFn(page);
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await terminateSession(session.sessionId); } catch {}
  }
}

/**
 * Log an agent run to sniper_agent_runs for debugging.
 */
async function logAgentRun(opts: {
  jobId?: string;
  jobItemId?: string;
  workspaceId: string;
  taskType: string;
  result: AgentResult;
}): Promise<void> {
  try {
    await sniperSupabaseDb.from('sniper_agent_runs').insert({
      job_id: opts.jobId || null,
      job_item_id: opts.jobItemId || null,
      workspace_id: opts.workspaceId,
      task_type: opts.taskType,
      steps_json: opts.result.steps.map((s) => ({
        step: s.stepNumber,
        action: s.action.type,
        reasoning: s.reasoning,
        result: s.actionResult,
        url: s.observation.url,
      })),
      total_steps: opts.result.steps.length,
      llm_tokens_used: opts.result.totalTokensUsed,
      duration_ms: opts.result.durationMs,
      status: opts.result.success ? 'succeeded' : 'failed',
      error_message: opts.result.error || null,
    } as any);
  } catch (e: any) {
    console.warn('[agentic_browser] Failed to log agent run:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export const agenticBrowserProvider: SniperExecutionProvider = {
  name: 'agentic_browser',

  // =========================================================================
  // Auth: start LinkedIn login
  // =========================================================================
  async startLinkedInAuth({ userId, workspaceId }): Promise<LinkedInAuthStartResult> {
    const name = contextName(workspaceId, userId);

    // Create a new persistent Browserbase context
    const contextId = await createContext(name);

    // Create a session with this context (DO NOT connect Playwright here —
    // browser.close() would kill the session before the user can interact).
    // The user will navigate to LinkedIn themselves in the embedded live view.
    const session = await createSession({ contextId, timeoutMinutes: 15 });

    console.log(`[agentic_browser] Auth session created: sessionId=${session.sessionId}, contextId=${contextId}, liveViewUrl=${session.liveViewUrl}`);

    // Store auth session record
    const authSession = await createBrowserbaseAuthSession({
      user_id: userId,
      workspace_id: workspaceId,
      browserbase_session_id: session.sessionId,
      browserbase_context_id: contextId,
    });

    return {
      provider: 'agentic_browser',
      auth_session_id: authSession.id,
      browserbase_session_id: session.sessionId,
      browserbase_context_id: contextId,
      live_view_url: session.liveViewUrl,
    };
  },

  // =========================================================================
  // Auth: verify login and persist
  // =========================================================================
  async completeLinkedInAuth({ userId, workspaceId, authSessionId }): Promise<{ ok: true; airtop_profile_id: string }> {
    const authSession = await getBrowserbaseAuthSession(authSessionId);
    if (!authSession || authSession.status !== 'active') {
      throw new Error('Auth session not found or already completed');
    }

    // Verify the user actually logged in by connecting and checking
    let browser: Browser | null = null;
    try {
      const conn = await connectPlaywright(authSession.browserbase_session_id);
      browser = conn.browser;
      const page = conn.page;

      // Navigate to feed to verify login
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(2000);
      await assertLinkedInAuthenticated(page);
    } finally {
      try { if (browser) await browser.close(); } catch {}
    }

    // Terminate session (context persists automatically with Browserbase)
    await terminateSession(authSession.browserbase_session_id);

    // Mark auth session as completed
    await markBrowserbaseAuthSession(authSessionId, 'completed');

    // Save context ID to user_linkedin_auth
    await upsertUserLinkedinAuth(userId, workspaceId, {
      browserbase_context_id: authSession.browserbase_context_id,
      browserbase_last_auth_at: new Date().toISOString(),
      status: 'ok',
    } as any);

    // Return airtop_profile_id for backward compatibility
    return { ok: true, airtop_profile_id: authSession.browserbase_context_id };
  },

  // =========================================================================
  // Prospect: extract post engagers
  // =========================================================================
  async prospectPostEngagers({ userId, workspaceId, postUrl, limit }): Promise<ProspectProfile[]> {
    const llm = createLLMClient();
    const instruction = getProspectPostEngagersPrompt(postUrl, limit);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 3, 60), // Post engagers need many scroll+extract cycles
        timeoutMs: DEFAULT_TIMEOUT_MS * 3, // 6 min timeout for large reaction lists
      }, llm);
    }, { navigateTo: postUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_post_engagers', result });

    // Merge profiles from all extract batches + final done result
    const profiles: ProspectProfile[] = [];
    const seen = new Set<string>();

    const addProfiles = (rawProfiles: any[]) => {
      for (const p of rawProfiles) {
        if (p.profile_url && p.profile_url.includes('linkedin.com/in/') && !seen.has(p.profile_url)) {
          seen.add(p.profile_url);
          profiles.push({
            profile_url: p.profile_url,
            name: p.name || null,
            headline: p.headline || null,
          });
        }
      }
    };

    // 1. Profiles from extract actions (batched extraction)
    for (const batch of (result.extractedData || [])) {
      addProfiles(batch?.profiles || []);
    }

    // 2. Profiles from final done result
    addProfiles(result.data?.profiles || []);

    // If agent failed AND we have zero partial data, throw so the worker can retry
    if (!result.success && profiles.length === 0) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    if (!result.success && profiles.length > 0) {
      console.warn(`[agentic_browser] prospect_post_engagers partially succeeded: ${profiles.length} profiles recovered from ${(result.extractedData || []).length} extract batches. Error: ${result.error}`);
    }

    return profiles.slice(0, limit);
  },

  // =========================================================================
  // Prospect: people search
  // =========================================================================
  async prospectPeopleSearch({ userId, workspaceId, searchUrl, limit }): Promise<ProspectProfile[]> {
    const llm = createLLMClient();
    const instruction = getProspectPeopleSearchPrompt(searchUrl, limit);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 2, 40),
        timeoutMs: DEFAULT_TIMEOUT_MS * 2,
      }, llm);
    }, { navigateTo: searchUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_people_search', result });

    // Merge profiles from extract batches + final done result
    const profiles: ProspectProfile[] = [];
    const seen = new Set<string>();

    const addProfiles = (rawProfiles: any[]) => {
      for (const p of rawProfiles) {
        if (p.profile_url && p.profile_url.includes('linkedin.com/in/') && !seen.has(p.profile_url)) {
          seen.add(p.profile_url);
          profiles.push({ profile_url: p.profile_url, name: p.name || null, headline: p.headline || null });
        }
      }
    };

    for (const batch of (result.extractedData || [])) addProfiles(batch?.profiles || []);
    addProfiles(result.data?.profiles || []);

    if (!result.success && profiles.length === 0) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    if (!result.success && profiles.length > 0) {
      console.warn(`[agentic_browser] prospect_people_search partially succeeded: ${profiles.length} profiles recovered. Error: ${result.error}`);
    }

    return profiles.slice(0, limit);
  },

  // =========================================================================
  // Prospect: jobs intent
  // =========================================================================
  async prospectJobsIntent({ userId, workspaceId, searchUrl, limit }): Promise<JobListing[]> {
    const llm = createLLMClient();
    const instruction = getProspectJobsIntentPrompt(searchUrl, limit);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 2, 40),
        timeoutMs: DEFAULT_TIMEOUT_MS * 2,
      }, llm);
    }, { navigateTo: searchUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_jobs_intent', result });

    // Merge jobs from all extract batches + final done result
    const jobs: JobListing[] = [];
    const seen = new Set<string>();

    const addJobs = (rawJobs: any[]) => {
      for (const j of rawJobs) {
        if (j.job_url && !seen.has(j.job_url)) {
          seen.add(j.job_url);
          jobs.push({
            job_url: j.job_url,
            title: j.title || null,
            company: j.company || null,
            company_url: j.company_url || null,
            location: j.location || null,
          });
        }
      }
    };

    // 1. Jobs from extract actions (batched extraction)
    for (const batch of (result.extractedData || [])) {
      addJobs(batch?.jobs || []);
    }

    // 2. Jobs from final done result
    addJobs(result.data?.jobs || []);

    if (!result.success && jobs.length === 0) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    if (!result.success && jobs.length > 0) {
      console.warn(`[agentic_browser] prospect_jobs_intent partially succeeded: ${jobs.length} jobs recovered. Error: ${result.error}`);
    }

    return jobs.slice(0, limit);
  },

  // =========================================================================
  // Prospect: decision maker lookup
  // =========================================================================
  async prospectDecisionMakers({ userId, workspaceId, companyUrl, companyName, criteria, limit }): Promise<DecisionMakerResult[]> {
    const llm = createLLMClient();
    const instruction = getProspectDecisionMakersPrompt(companyUrl, companyName, criteria, limit);
    const peopleUrl = companyUrl.replace(/\/+$/, '') + '/people/';

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 3, 60),
        timeoutMs: DEFAULT_TIMEOUT_MS * 3,
      }, llm);
    }, { navigateTo: peopleUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_decision_makers', result });

    const seen = new Set<string>();

    // Helper to normalize a URL or return null
    const cleanUrl = (raw: any): string | null => {
      if (!raw) return null;
      const s = String(raw);
      if (s.includes('linkedin.com/in/')) {
        return normalizeLinkedinProfileUrl(s);
      }
      if (s.includes('linkedin.com/sales/')) {
        return s; // SN URLs pass through as-is
      }
      return null;
    };

    // Helper to build a dedup key (name+title since URLs can be null)
    const dedupKey = (p: any): string => `${(p.name || '').toLowerCase()}::${(p.title || p.headline || '').toLowerCase()}`;

    const addPerson = (p: any, defaultSource: string): DecisionMakerResult | null => {
      const key = dedupKey(p);
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        profile_url: cleanUrl(p.profile_url),
        name: p.name || null,
        headline: p.title || p.headline || null,
        company_name: companyName || null,
        company_url: companyUrl,
        match_reason: p.match_reason || null,
        source: (p.source || defaultSource) as DecisionMakerResult['source'],
      };
    };

    // 1. Collect ALL people from batched extract actions (Phase 1 raw)
    const allExtracted: DecisionMakerResult[] = [];
    for (const batch of (result.extractedData || [])) {
      for (const p of (batch?.people || [])) {
        const person = addPerson(p, 'company_people');
        if (person) allExtracted.push(person);
      }
    }

    // 2. Collect matched_people from done result (Phase 2 filtered)
    const matchedPeople: DecisionMakerResult[] = [];
    for (const p of (result.data?.matched_people || [])) {
      // Reset seen set for matched_people so they aren't blocked by Phase 1 dedup
      const key = dedupKey(p);
      const person: DecisionMakerResult = {
        profile_url: cleanUrl(p.profile_url),
        name: p.name || null,
        headline: p.title || p.headline || null,
        company_name: companyName || null,
        company_url: companyUrl,
        match_reason: p.match_reason || null,
        source: (p.source || 'company_people') as DecisionMakerResult['source'],
      };
      // Dedup within matched_people
      if (!matchedPeople.some((m) => dedupKey(m) === key)) {
        matchedPeople.push(person);
      }
    }

    // 3. Prioritize matched_people if available (they have match_reason)
    if (matchedPeople.length > 0) {
      return matchedPeople.slice(0, limit);
    }

    // 4. Fallback to all extracted people
    if (!result.success && allExtracted.length === 0) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    if (!result.success && allExtracted.length > 0) {
      console.warn(`[decision_maker_lookup] Partially succeeded: ${allExtracted.length} people recovered. Error: ${result.error}`);
    }

    return allExtracted.slice(0, limit);
  },

  // =========================================================================
  // Action: send connection request
  // =========================================================================
  async sendConnectionRequest({ userId, workspaceId, profileUrl, note, debug }): Promise<SendConnectResult> {
    const llm = createLLMClient();
    const instruction = getSendConnectionRequestPrompt(profileUrl, note);

    // Helper: run agent task with page verification for connect requests
    const runConnectAgent = async (attemptLabel: string) => {
      return runWithSession(userId, workspaceId, async (page) => {
        return executeAgentTask(page, {
          instruction,
          maxSteps: DEFAULT_MAX_STEPS,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        }, llm);
      }, { navigateTo: profileUrl });
    };

    let result = await runConnectAgent('attempt_1');

    // If the agent reported PROFILE_PAGE_NOT_LOADED, retry once with a fresh session
    if (!result.success && result.error?.includes('PROFILE_PAGE_NOT_LOADED')) {
      console.warn(`[agentic-browser] Profile page didn't load for ${profileUrl}, retrying with fresh session...`);
      result = await runConnectAgent('attempt_2_retry');
    }

    await logAgentRun({
      jobId: debug?.jobId || undefined,
      workspaceId,
      taskType: 'send_connection_request',
      result,
    });

    if (!result.success) {
      // Check if it's an auth error
      if (result.error?.includes('LINKEDIN_AUTH_REQUIRED')) {
        throw new Error(result.error);
      }
      return { status: 'failed', details: { reason: result.error, steps: result.steps.length } };
    }

    // Map agent result status to SendConnectResult status
    const agentStatus = result.data?.status || 'failed';

    // -----------------------------------------------------------------------
    // VERIFICATION: When agent claims "already_pending" or "already_connected",
    // verify by directly checking the profile page in a fresh session.
    // This prevents false positives when the page didn't fully render.
    // -----------------------------------------------------------------------
    if (agentStatus === 'already_pending' || agentStatus === 'already_connected') {
      try {
        const verified = await runWithSession(userId, workspaceId, async (page) => {
          // Wait for action buttons to stabilize
          await page.waitForTimeout(1500);
          await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});

          // Check for the specific buttons
          const hasPending = (await page.locator('button:has-text("Pending")').count().catch(() => 0)) > 0
            || (await page.locator('button:has-text("Invited")').count().catch(() => 0)) > 0;
          const hasMessage = (await page.locator('button:has-text("Message")').count().catch(() => 0)) > 0;
          const hasConnect = (await page.locator('button:has-text("Connect")').count().catch(() => 0)) > 0;

          // If we see a Connect button, the agent was wrong — the connection wasn't actually sent
          if (hasConnect && !hasPending && !hasMessage) {
            return 'not_connected';
          }
          // Confirm pending
          if (hasPending) return 'pending';
          // Confirm connected (Message button present, no Connect button)
          if (hasMessage && !hasConnect) return 'connected';
          // Could not confirm either way — page may still not be loaded
          return 'unknown';
        }, { navigateTo: profileUrl });

        if (verified === 'not_connected') {
          // Agent falsely reported already_pending/already_connected — the profile has a Connect button
          console.warn(`[agentic-browser] FALSE POSITIVE: Agent reported "${agentStatus}" but verification found Connect button for ${profileUrl}. Retrying connect...`);
          // Retry the actual connection request with a fresh session
          const retryResult = await runConnectAgent('retry_after_false_positive');
          await logAgentRun({
            jobId: debug?.jobId || undefined,
            workspaceId,
            taskType: 'send_connection_request_retry',
            result: retryResult,
          });

          if (retryResult.success) {
            const retryStatus = retryResult.data?.status || 'failed';
            const retryStatusMap: Record<string, SendConnectResult['status']> = {
              sent_verified: 'sent_verified',
              already_connected: 'already_connected',
              already_pending: 'already_pending',
              restricted: 'restricted',
            };
            return {
              status: retryStatusMap[retryStatus] || 'failed',
              details: {
                ...retryResult.data?.details,
                agent_steps: retryResult.steps.length,
                agent_tokens: retryResult.totalTokensUsed,
                was_false_positive_retry: true,
              },
            };
          }
          return { status: 'failed', details: { reason: retryResult.error || 'retry_failed', was_false_positive_retry: true } };
        }

        if (verified === 'unknown') {
          console.warn(`[agentic-browser] Could not verify "${agentStatus}" claim for ${profileUrl} — page may not have loaded. Trusting agent result.`);
        }
      } catch (verifyErr: any) {
        console.warn(`[agentic-browser] Verification session failed for ${profileUrl}: ${verifyErr?.message}. Trusting agent result.`);
      }
    }

    const statusMap: Record<string, SendConnectResult['status']> = {
      sent_verified: 'sent_verified',
      already_connected: 'already_connected',
      already_pending: 'already_pending',
      restricted: 'restricted',
    };

    return {
      status: statusMap[agentStatus] || 'failed',
      details: {
        ...result.data?.details,
        agent_steps: result.steps.length,
        agent_tokens: result.totalTokensUsed,
      },
    };
  },

  // =========================================================================
  // Action: send message
  // =========================================================================
  async sendMessage({ userId, workspaceId, profileUrl, message, debug }): Promise<SendMessageResult> {
    const llm = createLLMClient();
    const instruction = getSendMessagePrompt(profileUrl, message);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: DEFAULT_MAX_STEPS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }, llm);
    }, { navigateTo: profileUrl });

    await logAgentRun({
      jobId: debug?.jobId || undefined,
      workspaceId,
      taskType: 'send_message',
      result,
    });

    if (!result.success) {
      if (result.error?.includes('LINKEDIN_AUTH_REQUIRED')) {
        throw new Error(result.error);
      }
      return { status: 'failed', details: { reason: result.error, steps: result.steps.length } };
    }

    const agentStatus = result.data?.status || 'failed';
    const statusMap: Record<string, SendMessageResult['status']> = {
      sent_verified: 'sent_verified',
      not_1st_degree: 'not_1st_degree',
    };

    return {
      status: statusMap[agentStatus] || 'failed',
      details: {
        ...result.data?.details,
        agent_steps: result.steps.length,
        agent_tokens: result.totalTokensUsed,
      },
    };
  },

  // =========================================================================
  // Sales Navigator: lead search
  // =========================================================================
  async prospectSalesNavSearch({ userId, workspaceId, searchUrl, limit }): Promise<ProspectProfile[]> {
    const llm = createLLMClient();
    const instruction = getSalesNavSearchPrompt(searchUrl, limit);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 3, 60),
        timeoutMs: DEFAULT_TIMEOUT_MS * 3,
      }, llm);
    }, { navigateTo: searchUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_sn_search', result });

    const profiles: ProspectProfile[] = [];
    const seen = new Set<string>();

    const addProfiles = (rawProfiles: any[]) => {
      for (const p of rawProfiles) {
        const rawUrl = p.profile_url || '';
        if (!rawUrl) continue;
        // Accept both /in/ and /sales/lead/ URLs
        if (rawUrl.includes('linkedin.com/in/')) {
          const normalized = normalizeLinkedinProfileUrl(rawUrl);
          if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            profiles.push({ profile_url: normalized, name: p.name || null, headline: p.headline || null });
          }
        } else if (rawUrl.includes('linkedin.com/sales/') && !seen.has(rawUrl)) {
          seen.add(rawUrl);
          profiles.push({ profile_url: rawUrl, name: p.name || null, headline: p.headline || null });
        }
      }
    };

    for (const batch of (result.extractedData || [])) addProfiles(batch?.profiles || []);
    addProfiles(result.data?.profiles || []);

    if (!result.success && profiles.length === 0) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    if (!result.success && profiles.length > 0) {
      console.warn(`[agentic_browser] prospect_sn_search partially succeeded: ${profiles.length} profiles recovered. Error: ${result.error}`);
    }

    return profiles.slice(0, limit);
  },

  // =========================================================================
  // Sales Navigator: send connect
  // =========================================================================
  async sendSalesNavConnect({ userId, workspaceId, profileUrl, note, debug }): Promise<SendConnectResult> {
    const llm = createLLMClient();
    const instruction = getSalesNavConnectPrompt(profileUrl, note);

    const runSnConnectAgent = async (attemptLabel: string) => {
      return runWithSession(userId, workspaceId, async (page) => {
        return executeAgentTask(page, {
          instruction,
          maxSteps: DEFAULT_MAX_STEPS,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        }, llm);
      }, { navigateTo: profileUrl });
    };

    let result = await runSnConnectAgent('attempt_1');

    // If the agent reported PROFILE_PAGE_NOT_LOADED, retry once with a fresh session
    if (!result.success && result.error?.includes('PROFILE_PAGE_NOT_LOADED')) {
      console.warn(`[agentic-browser] SN profile page didn't load for ${profileUrl}, retrying with fresh session...`);
      result = await runSnConnectAgent('attempt_2_retry');
    }

    await logAgentRun({
      jobId: debug?.jobId || undefined,
      workspaceId,
      taskType: 'sn_send_connect',
      result,
    });

    if (!result.success) {
      if (result.error?.includes('LINKEDIN_AUTH_REQUIRED')) {
        throw new Error(result.error);
      }
      return { status: 'failed', details: { reason: result.error, steps: result.steps.length } };
    }

    const agentStatus = result.data?.status || 'failed';

    // Verify already_pending/already_connected claims for SN connect too
    if (agentStatus === 'already_pending' || agentStatus === 'already_connected') {
      try {
        const verified = await runWithSession(userId, workspaceId, async (page) => {
          await page.waitForTimeout(1500);
          await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});

          const hasPending = (await page.locator('button:has-text("Pending")').count().catch(() => 0)) > 0;
          const hasMessage = (await page.locator('button:has-text("Message")').count().catch(() => 0)) > 0;
          const hasConnect = (await page.locator('button:has-text("Connect")').count().catch(() => 0)) > 0;

          if (hasConnect && !hasPending && !hasMessage) return 'not_connected';
          if (hasPending) return 'pending';
          if (hasMessage && !hasConnect) return 'connected';
          return 'unknown';
        }, { navigateTo: profileUrl });

        if (verified === 'not_connected') {
          console.warn(`[agentic-browser] SN FALSE POSITIVE: Agent reported "${agentStatus}" but verification found Connect button for ${profileUrl}. Retrying...`);
          const retryResult = await runSnConnectAgent('retry_after_false_positive');
          await logAgentRun({
            jobId: debug?.jobId || undefined,
            workspaceId,
            taskType: 'sn_send_connect_retry',
            result: retryResult,
          });

          if (retryResult.success) {
            const retryStatus = retryResult.data?.status || 'failed';
            const retryMap: Record<string, SendConnectResult['status']> = {
              sent_verified: 'sent_verified', already_connected: 'already_connected',
              already_pending: 'already_pending', restricted: 'restricted',
            };
            return {
              status: retryMap[retryStatus] || 'failed',
              details: { ...retryResult.data?.details, agent_steps: retryResult.steps.length, agent_tokens: retryResult.totalTokensUsed, was_false_positive_retry: true },
            };
          }
          return { status: 'failed', details: { reason: retryResult.error || 'retry_failed', was_false_positive_retry: true } };
        }
      } catch (verifyErr: any) {
        console.warn(`[agentic-browser] SN verification session failed for ${profileUrl}: ${verifyErr?.message}. Trusting agent result.`);
      }
    }

    const statusMap: Record<string, SendConnectResult['status']> = {
      sent_verified: 'sent_verified',
      already_connected: 'already_connected',
      already_pending: 'already_pending',
      restricted: 'restricted',
    };

    return {
      status: statusMap[agentStatus] || 'failed',
      details: {
        ...result.data?.details,
        agent_steps: result.steps.length,
        agent_tokens: result.totalTokensUsed,
      },
    };
  },

  // =========================================================================
  // Sales Navigator: send InMail
  // =========================================================================
  async sendSalesNavInMail({ userId, workspaceId, profileUrl, subject, message, debug }): Promise<SendInMailResult> {
    const llm = createLLMClient();
    const instruction = getSalesNavInMailPrompt(profileUrl, subject, message);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: DEFAULT_MAX_STEPS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }, llm);
    }, { navigateTo: profileUrl });

    await logAgentRun({
      jobId: debug?.jobId || undefined,
      workspaceId,
      taskType: 'sn_send_inmail',
      result,
    });

    if (!result.success) {
      if (result.error?.includes('LINKEDIN_AUTH_REQUIRED')) {
        throw new Error(result.error);
      }
      return { status: 'failed', details: { reason: result.error, steps: result.steps.length } };
    }

    const agentStatus = result.data?.status || 'failed';
    const statusMap: Record<string, SendInMailResult['status']> = {
      sent_verified: 'sent_verified',
      no_inmail_credits: 'no_inmail_credits',
      not_available: 'not_available',
    };

    return {
      status: statusMap[agentStatus] || 'failed',
      details: {
        ...result.data?.details,
        agent_steps: result.steps.length,
        agent_tokens: result.totalTokensUsed,
      },
    };
  },

  // =========================================================================
  // Sales Navigator: send message
  // =========================================================================
  async sendSalesNavMessage({ userId, workspaceId, profileUrl, message, debug }): Promise<SendMessageResult> {
    const llm = createLLMClient();
    const instruction = getSalesNavMessagePrompt(profileUrl, message);

    const result = await runWithSession(userId, workspaceId, async (page) => {
      return executeAgentTask(page, {
        instruction,
        maxSteps: DEFAULT_MAX_STEPS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }, llm);
    }, { navigateTo: profileUrl });

    await logAgentRun({
      jobId: debug?.jobId || undefined,
      workspaceId,
      taskType: 'sn_send_message',
      result,
    });

    if (!result.success) {
      if (result.error?.includes('LINKEDIN_AUTH_REQUIRED')) {
        throw new Error(result.error);
      }
      return { status: 'failed', details: { reason: result.error, steps: result.steps.length } };
    }

    const agentStatus = result.data?.status || 'failed';
    const statusMap: Record<string, SendMessageResult['status']> = {
      sent_verified: 'sent_verified',
      not_1st_degree: 'not_1st_degree',
    };

    return {
      status: statusMap[agentStatus] || 'failed',
      details: {
        ...result.data?.details,
        agent_steps: result.steps.length,
        agent_tokens: result.totalTokensUsed,
      },
    };
  },
};
