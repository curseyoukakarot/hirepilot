import { encryptToBase64, decryptFromBase64 } from './encryption';

describe('encryption utils', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, COOKIE_ENC_KEY: '0123456789abcdef0123456789abcdef' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('roundtrips text', () => {
    const msg = 'hello world';
    const enc = encryptToBase64(msg);
    const dec = decryptFromBase64(enc);
    expect(dec).toBe(msg);
  });
});


