import OpenAI from 'openai';
import { logger } from '../lib/logger';
import { DiffChunk, SeverityLevel } from './types';

const OPENAI_API_KEY =
  process.env.REPO_AGENT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.REPO_AGENT_OPENAI_MODEL || 'gpt-5.1';

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

function ensureClient() {
  if (!client) {
    throw new Error('OpenAI API key not configured for Repo Guardian');
  }
  return client;
}

function buildSystemPrompt() {
  return (
    process.env.REPO_AGENT_SYSTEM_PROMPT ||
    'You are the Repo Guardian Agent for HirePilot. Focus on reliability, bugs, and safe fixes.'
  );
}

function fallbackSeverityFromLogs(logs: { tests: string; lint: string; build: string }): SeverityLevel {
  const hasFailure = [logs.tests, logs.lint, logs.build].some((log) =>
    /fail|error|exception/i.test(log)
  );
  const hasWarn = [logs.tests, logs.lint, logs.build].some((log) => /warn(ing)?/i.test(log));
  if (hasFailure) return 'high';
  if (hasWarn) return 'medium';
  return 'low';
}

export async function summarizeHealthCheck(logs: {
  tests: string;
  lint: string;
  build: string;
}): Promise<{ summary: string; severity: SeverityLevel }> {
  const prompt = `Summarize the following health check logs (tests, lint, build) and rate severity as low, medium, or high.
Respond in JSON with keys "summary" and "severity".

Tests log:
${logs.tests.slice(-4000)}

Lint log:
${logs.lint.slice(-4000)}

Build log:
${logs.build.slice(-4000)}
`;

  try {
    const openai = ensureClient();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: prompt },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    const severity = (parsed.severity || 'low').toLowerCase() as SeverityLevel;
    return {
      summary: parsed.summary || 'Health check completed.',
      severity: severity === 'medium' || severity === 'high' ? severity : 'low',
    };
  } catch (error) {
    logger.warn({ error }, '[repoAgent][llmClient] summarizeHealthCheck fallback');
    return {
      summary: 'Automated summary unavailable. Review raw logs for details.',
      severity: fallbackSeverityFromLogs(logs),
    };
  }
}

export async function explainError(details: {
  errorMessage: string;
  stackTrace?: string;
  contextJson?: any;
}): Promise<string> {
  const context = typeof details.contextJson === 'string'
    ? details.contextJson
    : JSON.stringify(details.contextJson || {});

  const prompt = `Explain the following application error in concise terms and suggest likely causes.
Error message: ${details.errorMessage}
Stack trace: ${details.stackTrace || 'n/a'}
Context: ${context}`;

  try {
    const openai = ensureClient();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: prompt },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() || 'Explanation unavailable.';
  } catch (error) {
    logger.warn({ error }, '[repoAgent][llmClient] explainError fallback');
    return 'Explanation unavailable. Please inspect server logs.';
  }
}

export async function generateChatReply(params: {
  conversationMessages: { role: 'user' | 'assistant' | 'system' | 'agent'; content: string }[];
  context?: Record<string, unknown>;
}): Promise<string> {
  const messages = params.conversationMessages.map((msg) => ({
    role: msg.role === 'agent' ? 'assistant' : msg.role,
    content: msg.content,
  }));

  if (params.context) {
    messages.unshift({
      role: 'system',
      content: `${buildSystemPrompt()} Here is additional context: ${JSON.stringify(
        params.context
      )}`,
    });
  } else {
    messages.unshift({ role: 'system', content: buildSystemPrompt() });
  }

  try {
    const openai = ensureClient();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages,
    });
    return completion.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    logger.error({ error }, '[repoAgent][llmClient] generateChatReply failed');
    throw error;
  }
}

export async function proposePatch(params: {
  context: Record<string, unknown>;
  codeSnippets: { path: string; content: string }[];
  errorDescription: string;
}): Promise<DiffChunk[]> {
  const prompt = `Given the following context and code snippets, propose unified diffs that fix the described issue.
Reply in JSON: { "diffs": [ { "path": "...", "diff": "...", "description": "..." } ] }

Context: ${JSON.stringify(params.context)}
Error description: ${params.errorDescription}

Code snippets:
${params.codeSnippets
  .map((snippet) => `File: ${snippet.path}\n${snippet.content}`)
  .join('\n---\n')}`;

  try {
    const openai = ensureClient();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: prompt },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? '{"diffs": []}';
    const parsed = JSON.parse(content);
    const diffs = Array.isArray(parsed.diffs) ? parsed.diffs : [];
    return diffs.filter((diff: any) => diff?.path && diff?.diff);
  } catch (error) {
    logger.warn({ error }, '[repoAgent][llmClient] proposePatch fallback');
    return [];
  }
}

