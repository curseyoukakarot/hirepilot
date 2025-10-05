import { chromium } from 'playwright';
import { decryptFromBase64 } from '../../crypto/encryption';

export async function visitProfile(payload: { profileUrl: string }, cookiesEnc: string, proxyUrl?: string) {
  const cookies = JSON.parse(decryptFromBase64(cookiesEnc));
  const launchArgs: any = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (proxyUrl) {
    const u = new URL(proxyUrl);
    launchArgs.proxy = { server: `${u.protocol}//${u.host}`, username: u.username || undefined, password: u.password || undefined };
  }
  const browser = await chromium.launch(launchArgs);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addCookies(cookies.map((c: any) => ({
    name: c.name, value: c.value, domain: (c.domain || '').replace(/^\./,''), path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: (c.sameSite?.toLowerCase?.() as any) || 'Lax', expires: c.expires || -1
  })));
  const page = await ctx.newPage();
  await page.goto(payload.profileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const name = await page.$eval('h1, .text-heading-xlarge', n => (n as HTMLElement).innerText).catch(()=>null);
  const headline = await page.$eval('.text-body-medium', n => (n as HTMLElement).innerText).catch(()=>null);
  const avatar = await page.$eval('img.pv-top-card-profile-picture__image, img[alt*="profile" i]', (n:any)=> n.currentSrc || n.src).catch(()=>null);

  await browser.close();
  return { profile: { name: name || '', headline: headline || '', avatarUrl: avatar || '', profileUrl: payload.profileUrl } };
}


