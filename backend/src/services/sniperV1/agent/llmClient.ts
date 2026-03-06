import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AgentMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AgentMessagePart[];
};

export type AgentAction =
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string; description?: string }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'wait'; ms: number }
  | { type: 'extract'; data: any }
  | { type: 'done'; result: any }
  | { type: 'error'; message: string };

export type AgentCompletion = {
  action: AgentAction;
  reasoning: string;
  tokensUsed: number;
};

export interface AgentLLMClient {
  complete(messages: AgentMessage[]): Promise<AgentCompletion>;
}

// ---------------------------------------------------------------------------
// JSON parsing helper
// ---------------------------------------------------------------------------

function parseAgentAction(raw: string): { action: AgentAction; reasoning: string } {
  // Try to extract JSON from the response
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    // Try to find JSON within markdown code fences or inline
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (match) {
      json = JSON.parse(match[1].trim());
    } else {
      throw new Error(`Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`);
    }
  }

  const reasoning = String(json.reasoning || json.thought || '');
  const action = json.action || json;

  // Validate action has a type
  if (!action.type) {
    throw new Error(`LLM response missing action.type: ${JSON.stringify(action).slice(0, 200)}`);
  }

  return { action: action as AgentAction, reasoning };
}

// ---------------------------------------------------------------------------
// Action JSON schema (shared across all providers)
// ---------------------------------------------------------------------------

export const ACTION_JSON_SCHEMA = `{
  "reasoning": "string — your step-by-step thinking about what to do next",
  "action": {
    "type": "navigate" | "click" | "fill" | "scroll" | "wait" | "extract" | "done" | "error",
    // For navigate: "url": "string"
    // For click: "selector": "string", "description": "string" (optional)
    // For fill: "selector": "string", "value": "string"
    // For scroll: "direction": "up" | "down", "amount": number (pixels, optional, default 600)
    // For wait: "ms": number (max 5000)
    // For extract: "data": any (extracted data from the page)
    // For done: "result": any (final result of the task)
    // For error: "message": "string" (what went wrong)
  }
}`;

// ---------------------------------------------------------------------------
// OpenAI Client
// ---------------------------------------------------------------------------

class OpenAIAgentClient implements AgentLLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
  }

  async complete(messages: AgentMessage[]): Promise<AgentCompletion> {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as any, content: m.content };
      }
      // Multi-part content (text + image)
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.content.map((p) => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text };
        return { type: 'image_url' as const, image_url: { url: p.image_url.url, detail: 'low' as const } };
      });
      return { role: m.role as any, content: parts };
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const tokensUsed =
      (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);

    const { action, reasoning } = parseAgentAction(raw);
    return { action, reasoning, tokensUsed };
  }
}

// ---------------------------------------------------------------------------
// Anthropic Client
// ---------------------------------------------------------------------------

class AnthropicAgentClient implements AgentLLMClient {
  private client: Anthropic;
  private model: string;

  constructor(model: string) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = model;
  }

  async complete(messages: AgentMessage[]): Promise<AgentCompletion> {
    // Separate system message from conversation messages
    let systemPrompt = '';
    const conversationMessages: Anthropic.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt += typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n');
        continue;
      }

      if (typeof m.content === 'string') {
        conversationMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
      } else {
        const parts: Anthropic.ContentBlockParam[] = m.content.map((p) => {
          if (p.type === 'text') return { type: 'text' as const, text: p.text };
          // Convert data URL to base64 for Anthropic
          const url = p.image_url.url;
          const base64Match = url.match(/^data:(image\/\w+);base64,(.+)$/);
          if (base64Match) {
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: base64Match[1] as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                data: base64Match[2],
              },
            };
          }
          // URL-based image
          return {
            type: 'image' as const,
            source: { type: 'url' as const, url },
          };
        });
        conversationMessages.push({ role: m.role as 'user' | 'assistant', content: parts });
      }
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: conversationMessages,
      temperature: 0.1,
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    const { action, reasoning } = parseAgentAction(raw);
    return { action, reasoning, tokensUsed };
  }
}

// ---------------------------------------------------------------------------
// xAI / Grok Client (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

class XAIAgentClient implements AgentLLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    this.client = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });
    this.model = model;
  }

  async complete(messages: AgentMessage[]): Promise<AgentCompletion> {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as any, content: m.content };
      }
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.content.map((p) => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text };
        return { type: 'image_url' as const, image_url: { url: p.image_url.url, detail: 'low' as const } };
      });
      return { role: m.role as any, content: parts };
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const tokensUsed =
      (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);

    const { action, reasoning } = parseAgentAction(raw);
    return { action, reasoning, tokensUsed };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type LLMProviderName = 'openai' | 'anthropic' | 'xai';

const DEFAULT_MODELS: Record<LLMProviderName, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  xai: 'grok-2-vision-1212',
};

export function createLLMClient(opts?: {
  provider?: LLMProviderName;
  model?: string;
}): AgentLLMClient {
  const provider = (opts?.provider || process.env.SNIPER_AGENT_LLM_PROVIDER || 'openai') as LLMProviderName;
  const model = opts?.model || process.env.SNIPER_AGENT_LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;

  switch (provider) {
    case 'anthropic':
      return new AnthropicAgentClient(model);
    case 'xai':
      return new XAIAgentClient(model);
    case 'openai':
    default:
      return new OpenAIAgentClient(model);
  }
}
