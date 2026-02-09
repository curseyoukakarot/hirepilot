import axios from 'axios';

const AIRTOP_API_BASE = 'https://api.airtop.ai/api/hooks/agents';

type InvokeArgs = {
  agentId: string;
  webhookId: string;
  configVars: Record<string, any>;
};

type PollArgs = {
  agentId: string;
  invocationId: string;
  timeoutSeconds?: number;
  pollIntervalMs?: number;
};

function requireApiKey(): string {
  const key = String(process.env.AIRTOP_API_KEY || '').trim();
  if (!key) {
    throw new Error('AIRTOP_API_KEY missing');
  }
  return key;
}

export function safeOutputParse(output: any) {
  if (typeof output === 'string') {
    try {
      return JSON.parse(output);
    } catch {
      return output;
    }
  }
  return output;
}

export async function invokeAgentWebhook({ agentId, webhookId, configVars }: InvokeArgs) {
  const apiKey = requireApiKey();
  const url = `${AIRTOP_API_BASE}/${encodeURIComponent(agentId)}/webhooks/${encodeURIComponent(webhookId)}`;
  const resp = await axios.post(
    url,
    { configVars },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30_000
    }
  );
  const invocationId = resp?.data?.invocationId;
  if (!invocationId) {
    throw new Error('Missing Airtop invocationId');
  }
  return { invocationId, raw: resp.data };
}

export async function pollInvocationResult({
  agentId,
  invocationId,
  timeoutSeconds = 180,
  pollIntervalMs = 2000
}: PollArgs) {
  const apiKey = requireApiKey();
  const url = `${AIRTOP_API_BASE}/${encodeURIComponent(agentId)}/invocations/${encodeURIComponent(invocationId)}/result`;
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30_000
    });
    const status = String(resp?.data?.status || '').toLowerCase();
    if (status === 'completed' || status === 'failed') {
      return {
        status,
        output: safeOutputParse(resp?.data?.output),
        error: resp?.data?.error || null,
        raw: resp?.data
      };
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error('Airtop invocation timed out');
}
