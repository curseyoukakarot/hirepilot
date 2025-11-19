import crypto from 'crypto';

type BuildParams = {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  replyToOverride: string;
  trackingPixelHtml?: string;
  headers?: Record<string, string>;
};

function encodeBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function buildMessageIdHeader(sendDomain?: string): string {
  const domain = sendDomain || process.env.SEND_DOMAIN || 'thehirepilot.com';
  return `<${crypto.randomBytes(16).toString('hex')}@${domain}>`;
}

export function buildGmailRawMessage(params: BuildParams): {
  raw: string;
  messageIdHeader: string;
} {
  const boundary = 'hirepilot_mime_boundary_' + crypto.randomBytes(8).toString('hex');
  const messageIdHeader = params.headers?.['Message-ID'] || buildMessageIdHeader();

  const extraHeaders = Object.entries(params.headers || {})
    .filter(([k]) => k.toLowerCase() !== 'message-id') // we'll set our own
    .map(([k, v]) => `${k}: ${v}\r\n`)
    .join('');

  const html = params.trackingPixelHtml
    ? params.htmlBody + params.trackingPixelHtml
    : params.htmlBody;

  // Build a minimal multipart/alternative with only HTML part for now
  const mime =
    `From: ${params.from}\r\n` +
    `To: ${params.to}\r\n` +
    `Subject: ${params.subject}\r\n` +
    `Reply-To: ${params.replyToOverride}\r\n` +
    `Message-ID: ${messageIdHeader}\r\n` +
    extraHeaders +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: 7bit\r\n` +
    `\r\n` +
    `${html}\r\n` +
    `\r\n` +
    `--${boundary}--\r\n`;

  return { raw: encodeBase64Url(mime), messageIdHeader };
}


