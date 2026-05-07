/**
 * Shared OpenAI helpers for skill handlers. Centralized so we keep the
 * import-shape compat shim in one place and don't duplicate the
 * { default | OpenAI | module } interop dance.
 */

function loadOpenAI(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('openai');
  const OpenAI = mod.default || mod.OpenAI || mod;
  return new (OpenAI as any)({ apiKey: process.env.OPENAI_API_KEY });
}

/** One-shot LLM call returning trimmed text. */
export async function llmText(opts: {
  system: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string> {
  const openai = loadOpenAI();
  const completion = await openai.chat.completions.create({
    model: opts.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    max_tokens: opts.max_tokens ?? 400,
    temperature: opts.temperature ?? 0.6,
  });
  return completion.choices?.[0]?.message?.content?.trim() || '';
}

/** One-shot LLM call returning a parsed JSON object. */
export async function llmJSON(opts: {
  system: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}): Promise<any> {
  const openai = loadOpenAI();
  const completion = await openai.chat.completions.create({
    model: opts.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: opts.system + '\n\nReturn ONLY a JSON object — no commentary, no code fences.' },
      { role: 'user', content: opts.user },
    ],
    max_tokens: opts.max_tokens ?? 600,
    temperature: opts.temperature ?? 0.4,
    response_format: { type: 'json_object' },
  });
  const txt = completion.choices?.[0]?.message?.content?.trim() || '{}';
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}
