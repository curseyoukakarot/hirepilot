import { AirtopClient } from '@airtop/sdk';

let _client: AirtopClient | null = null;

export function airtopEnabled(): boolean {
  return String(process.env.AIRTOP_PROVIDER_ENABLED || 'false').toLowerCase() === 'true';
}

export function getAirtopClient(): AirtopClient {
  if (_client) return _client;
  const apiKey = String(process.env.AIRTOP_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('AIRTOP_API_KEY missing');
  }
  _client = new AirtopClient({ apiKey });
  return _client;
}


