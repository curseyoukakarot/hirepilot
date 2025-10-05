import { chromium } from 'playwright';
import { decryptFromBase64 } from '../../crypto/encryption';

export async function sendConnection(payload: { profileUrl: string; message?: string }, cookiesEnc: string, proxyUrl?: string) {
  const cookies = JSON.parse(decryptFromBase64(cookiesEnc));
  const launchArgs: any = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  };
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
  await page.waitForTimeout(1500 + Math.random()*1000);

  const connectSel = 'button:has-text("Connect"), div[role="button"]:has-text("Connect")';
  const addNoteSel = 'button:has-text("Add a note")';
  const sendSel = 'button:has-text("Send")';

  await page.click(connectSel, { timeout: 8000 }).catch(()=>{});
  await page.waitForTimeout(800 + Math.random()*800);
  if (payload.message) {
    await page.click(addNoteSel, { timeout: 5000 }).catch(()=>{});
    await page.waitForSelector('textarea', { timeout: 5000 }).catch(()=>{});
    const ta = await page.$('textarea');
    if (ta) await ta.fill(payload.message.slice(0, 280));
  }
  await page.click(sendSel, { timeout: 8000 }).catch(()=>{});

  await page.waitForTimeout(1200 + Math.random()*1200);
  await browser.close();
  return { ok: true };
}


