import type { Page } from 'playwright';
import type { AgentLLMClient, AgentMessage, AgentAction, AgentCompletion } from './llmClient';
import { captureObservation, Observation } from './observation';
import { executeAction } from './actionExecutor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentTask = {
  instruction: string;   // Full system prompt for this task
  maxSteps: number;      // Safety limit
  timeoutMs: number;     // Total timeout
};

export type AgentStep = {
  stepNumber: number;
  observation: {
    url: string;
    title: string;
    hasScreenshot: boolean;
    domSnippet: string;      // First 500 chars of DOM snapshot
  };
  action: AgentAction;
  reasoning: string;
  actionResult: string;
  tokensUsed: number;
  timestamp: string;
};

export type AgentResult = {
  success: boolean;
  data: any;
  steps: AgentStep[];
  totalTokensUsed: number;
  durationMs: number;
  error?: string;
  extractedData: any[];  // Accumulated data from extract actions
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MAX_STEPS = Number(process.env.SNIPER_AGENT_MAX_STEPS || 20);
const DEFAULT_TIMEOUT_MS = Number(process.env.SNIPER_AGENT_TIMEOUT_MS || 120_000);
const MAX_HISTORY_STEPS = 5; // Keep last N steps in full context (with screenshots)
const LLM_RETRY_ON_PARSE_ERROR = 2; // Retry up to 2 times on parse/API errors

// ---------------------------------------------------------------------------
// Build messages for the LLM
// ---------------------------------------------------------------------------

function buildMessages(
  systemPrompt: string,
  history: AgentStep[],
  currentObservation: Observation
): AgentMessage[] {
  const messages: AgentMessage[] = [];

  // System prompt
  messages.push({ role: 'system', content: systemPrompt });

  // Historical steps (older steps as text only, recent steps with screenshots)
  for (let i = 0; i < history.length; i++) {
    const step = history[i];
    const isRecent = i >= history.length - MAX_HISTORY_STEPS;

    if (isRecent) {
      // Full observation with screenshot
      messages.push({
        role: 'user',
        content: `Step ${step.stepNumber} observation:\nURL: ${step.observation.url}\nTitle: ${step.observation.title}\nDOM: ${step.observation.domSnippet}`,
      });
    } else {
      // Summarized (no screenshot, minimal DOM)
      messages.push({
        role: 'user',
        content: `Step ${step.stepNumber}: URL=${step.observation.url} | Action: ${step.action.type} | Result: ${step.actionResult}`,
      });
    }

    messages.push({
      role: 'assistant',
      content: JSON.stringify({ reasoning: step.reasoning, action: step.action }),
    });

    // Action result as user message
    messages.push({
      role: 'user',
      content: `Action result: ${step.actionResult}`,
    });
  }

  // Current observation (always with screenshot)
  const parts: any[] = [];

  // Screenshot
  if (currentObservation.screenshotBase64) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${currentObservation.screenshotBase64}` },
    });
  }

  // Text context
  parts.push({
    type: 'text',
    text: [
      `Current page state:`,
      `URL: ${currentObservation.url}`,
      `Title: ${currentObservation.title}`,
      ``,
      `Interactive elements (with CSS selectors after "->"):`,
      currentObservation.domSnapshot || '(no interactive elements found)',
      ``,
      `Visible text (truncated):`,
      currentObservation.visibleText.slice(0, 2000) || '(no visible text)',
      ``,
      `What is your next action? Respond with JSON.`,
    ].join('\n'),
  });

  messages.push({ role: 'user', content: parts });

  return messages;
}

// ---------------------------------------------------------------------------
// Main agent executor
// ---------------------------------------------------------------------------

export async function executeAgentTask(
  page: Page,
  task: AgentTask,
  llm: AgentLLMClient
): Promise<AgentResult> {
  const startTime = Date.now();
  const maxSteps = task.maxSteps || DEFAULT_MAX_STEPS;
  const timeoutMs = task.timeoutMs || DEFAULT_TIMEOUT_MS;

  const steps: AgentStep[] = [];
  const extractedData: any[] = [];
  let totalTokensUsed = 0;

  for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
    // Timeout check
    if (Date.now() - startTime > timeoutMs) {
      return {
        success: false,
        data: null,
        steps,
        extractedData,
        totalTokensUsed,
        durationMs: Date.now() - startTime,
        error: `Agent timed out after ${timeoutMs}ms (${stepNum - 1} steps completed)`,
      };
    }

    // 1. Capture observation
    let observation: Observation;
    try {
      observation = await captureObservation(page);
    } catch (e: any) {
      return {
        success: false,
        data: null,
        steps,
        extractedData,
        totalTokensUsed,
        durationMs: Date.now() - startTime,
        error: `Failed to capture observation at step ${stepNum}: ${e.message}`,
      };
    }

    // 2. Build messages and call LLM
    const messages = buildMessages(task.instruction, steps, observation);

    let completion: AgentCompletion;
    let parseRetries = 0;

    while (true) {
      try {
        completion = await llm.complete(messages);
        break;
      } catch (e: any) {
        const errMsg = String(e.message || '');
        // Retry on parse errors, API errors (rate limits, timeouts), and malformed responses
        const isRetryable = errMsg.includes('parse') || errMsg.includes('JSON') ||
          errMsg.includes('rate') || errMsg.includes('timeout') || errMsg.includes('429') ||
          errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('overloaded') ||
          errMsg.includes('Failed to parse');
        if (parseRetries < LLM_RETRY_ON_PARSE_ERROR && isRetryable) {
          parseRetries++;
          console.warn(`[agent] LLM error at step ${stepNum} (attempt ${parseRetries}/${LLM_RETRY_ON_PARSE_ERROR}): ${errMsg.slice(0, 200)}. Retrying…`);
          // For parse errors, append guidance; for API errors, just retry
          if (errMsg.includes('parse') || errMsg.includes('JSON') || errMsg.includes('Failed to parse')) {
            messages.push({
              role: 'user',
              content: `Your previous response was not valid JSON. Error: ${e.message}\nPlease respond with valid JSON matching the schema.`,
            });
          }
          // Brief pause before retry (helps with rate limits)
          await new Promise(r => setTimeout(r, 1000 * parseRetries));
          continue;
        }
        return {
          success: false,
          data: null,
          steps,
          extractedData,
          totalTokensUsed,
          durationMs: Date.now() - startTime,
          error: `LLM error at step ${stepNum}: ${e.message}`,
        };
      }
    }

    totalTokensUsed += completion.tokensUsed;
    const action = completion.action;

    // 3. Check for terminal actions
    if (action.type === 'done') {
      steps.push({
        stepNumber: stepNum,
        observation: {
          url: observation.url,
          title: observation.title,
          hasScreenshot: Boolean(observation.screenshotBase64),
          domSnippet: observation.domSnapshot.slice(0, 500),
        },
        action,
        reasoning: completion.reasoning,
        actionResult: 'Task completed',
        tokensUsed: completion.tokensUsed,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        data: action.result,
        steps,
        extractedData,
        totalTokensUsed,
        durationMs: Date.now() - startTime,
      };
    }

    if (action.type === 'error') {
      steps.push({
        stepNumber: stepNum,
        observation: {
          url: observation.url,
          title: observation.title,
          hasScreenshot: Boolean(observation.screenshotBase64),
          domSnippet: observation.domSnapshot.slice(0, 500),
        },
        action,
        reasoning: completion.reasoning,
        actionResult: `Agent error: ${action.message}`,
        tokensUsed: completion.tokensUsed,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        data: null,
        steps,
        extractedData,
        totalTokensUsed,
        durationMs: Date.now() - startTime,
        error: action.message,
      };
    }

    // 3b. Accumulate extract data
    if (action.type === 'extract' && action.data) {
      extractedData.push(action.data);
    }

    // 4. Execute the action
    const actionResult = await executeAction(page, action);

    steps.push({
      stepNumber: stepNum,
      observation: {
        url: observation.url,
        title: observation.title,
        hasScreenshot: Boolean(observation.screenshotBase64),
        domSnippet: observation.domSnapshot.slice(0, 500),
      },
      action,
      reasoning: completion.reasoning,
      actionResult,
      tokensUsed: completion.tokensUsed,
      timestamp: new Date().toISOString(),
    });
  }

  // Max steps exceeded — but still return partial extracted data
  return {
    success: extractedData.length > 0,
    data: extractedData.length > 0 ? { profiles: [] } : null,
    steps,
    extractedData,
    totalTokensUsed,
    durationMs: Date.now() - startTime,
    error: extractedData.length > 0
      ? undefined
      : `Agent exceeded max steps (${maxSteps}) without completing the task`,
  };
}
