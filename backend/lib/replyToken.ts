// Lightweight base62 token generator (no external deps)
// Generates a 12-char token using [0-9A-Za-z]
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomBytes(size: number): Uint8Array {
  // Use Node's crypto if available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  return crypto.randomBytes(size);
}

export function newReplyToken(length = 12): string {
  let token = '';
  while (token.length < length) {
    const buf = randomBytes(length);
    for (let i = 0; i < buf.length && token.length < length; i++) {
      // Map byte to alphabet index using modulo
      const idx = buf[i] % ALPHABET.length;
      token += ALPHABET[idx];
    }
  }
  return token;
}


