import type { Page, Browser } from 'playwright';
import type { SniperExecutionProvider, LinkedInAuthStartResult, SendConnectResult, SendMessageResult, JobListing } from './types';
import type { ProspectProfile } from './linkedinActions';

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
  getSendConnectionRequestPrompt,
  getSendMessagePrompt,
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

    // Navigate to LinkedIn first to verify auth
    if (opts?.navigateTo) {
      await page.goto(opts.navigateTo, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } else {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }

    await page.waitForTimeout(2000);
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

    // Create a session with this context and navigate to LinkedIn login
    const session = await createSession({ contextId, timeoutMinutes: 15 });

    // Connect and navigate to LinkedIn login
    let browser: Browser | null = null;
    try {
      const conn = await connectPlaywright(session.sessionId);
      browser = conn.browser;
      await conn.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch {
      // Session is still active for the user to use via live view
    } finally {
      try { if (browser) await browser.close(); } catch {}
    }

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
        maxSteps: Math.min(DEFAULT_MAX_STEPS * 2, 40), // Extraction tasks may need more steps
        timeoutMs: DEFAULT_TIMEOUT_MS * 2,
      }, llm);
    }, { navigateTo: postUrl });

    await logAgentRun({ workspaceId, taskType: 'prospect_post_engagers', result });

    if (!result.success) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    // Parse profiles from agent result
    const profiles: ProspectProfile[] = [];
    const rawProfiles = result.data?.profiles || [];

    for (const p of rawProfiles) {
      if (p.profile_url && p.profile_url.includes('linkedin.com/in/')) {
        profiles.push({
          profile_url: p.profile_url,
          name: p.name || null,
          headline: p.headline || null,
        });
      }
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

    if (!result.success) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    const profiles: ProspectProfile[] = [];
    const rawProfiles = result.data?.profiles || [];

    for (const p of rawProfiles) {
      if (p.profile_url && p.profile_url.includes('linkedin.com/in/')) {
        profiles.push({
          profile_url: p.profile_url,
          name: p.name || null,
          headline: p.headline || null,
        });
      }
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

    if (!result.success) {
      throw new Error(`Agent failed: ${result.error}`);
    }

    const jobs: JobListing[] = [];
    const rawJobs = result.data?.jobs || [];

    for (const j of rawJobs) {
      if (j.job_url) {
        jobs.push({
          job_url: j.job_url,
          title: j.title || null,
          company: j.company || null,
          company_url: j.company_url || null,
          location: j.location || null,
        });
      }
    }

    return jobs.slice(0, limit);
  },

  // =========================================================================
  // Action: send connection request
  // =========================================================================
  async sendConnectionRequest({ userId, workspaceId, profileUrl, note, debug }): Promise<SendConnectResult> {
    const llm = createLLMClient();
    const instruction = getSendConnectionRequestPrompt(profileUrl, note);

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
};
