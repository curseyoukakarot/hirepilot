import axios from 'axios';

export type ZapierSignatureRequestPayload = {
  event_type: 'ignite.signature_request.created';
  idempotency_key: string;
  proposal_id: string;
  share_link_id?: string | null;
  selected_option_id?: string | null;
  envelope_label: string;
  signer: {
    name: string;
    email: string;
    title?: string | null;
    company?: string | null;
  };
  agreement: Record<string, any>;
  metadata?: Record<string, any>;
};

export async function sendSignatureRequestToZapier(payload: ZapierSignatureRequestPayload) {
  const webhookUrl = String(process.env.IGNITE_ZAPIER_SIGNATURE_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    throw new Error('IGNITE_ZAPIER_SIGNATURE_WEBHOOK_URL is not configured');
  }

  const secret = String(process.env.IGNITE_ZAPIER_WEBHOOK_SECRET || '').trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secret) headers['X-Ignite-Signature-Secret'] = secret;

  const response = await axios.post(webhookUrl, payload, {
    headers,
    timeout: 20_000,
  });

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    data: response.data || {},
  };
}
