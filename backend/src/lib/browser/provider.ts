import { chromium, Browser, BrowserContext, Cookie } from 'playwright';
import playwrightExtra from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const PROVIDER = process.env.BROWSER_PROVIDER || 'playwright';
const BROWSERLESS_WS = process.env.BROWSERLESS_WS;

export interface ContextOpts {
  cookies?: Cookie[];
  locale?: string;
  timezoneId?: string;
  userAgent?: string;
}

export async function startBrowser(): Promise<Browser> {
  if (PROVIDER === 'browserless') {
    if (!BROWSERLESS_WS) throw new Error('BROWSERLESS_WS missing');
    // connect via CDP (Browserless)
    // @ts-ignore
    return await chromium.connectOverCDP(BROWSERLESS_WS);
  }
  // local Playwright with stealth
  // @ts-ignore
  if ((playwrightExtra as any).use) (playwrightExtra as any).use(stealth());
  return await chromium.launch({ headless: true });
}

export async function newContext(browser: Browser, opts: ContextOpts = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    locale: opts.locale || 'en-US',
    timezoneId: opts.timezoneId || 'America/Chicago',
    userAgent: opts.userAgent,
  });
  if (opts.cookies?.length) await context.addCookies(opts.cookies);
  return context;
}


