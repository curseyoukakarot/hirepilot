import { newReplyToken } from '../lib/replyToken';

export const REPLY_DOMAIN =
  process.env.INBOUND_PARSE_DOMAIN || 'reply.thehirepilot.com';

export function generateUniqueReplyToken(length = 12): string {
  return newReplyToken(length);
}

export function buildReplyToAddress(token: string): string {
  // Using plus-addressing to match existing inbound parser
  return `reply+${token}@${REPLY_DOMAIN}`;
}


