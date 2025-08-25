import crypto from 'crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY || '';
if (KEY_HEX.length !== 64) throw new Error('ENCRYPTION_KEY must be 32 bytes hex (64 chars)');
const KEY = Buffer.from(KEY_HEX, 'hex');

export function encryptGCM(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), tag: tag.toString('hex'), cipher: enc.toString('hex') };
}
export function decryptGCM(payload: { iv: string; tag: string; cipher: string }) {
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.cipher, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}


