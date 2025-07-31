import { chromium, BrowserContext } from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SalesNavFetchOptions {
  apiUrl: string;
  fullCookie: string; // raw document.cookie string
  csrfToken: string;
}

export interface SalesNavLead {
  firstName?: string;
  lastName?: string;
  occupation?: string;
  publicIdentifier?: string;
  picture?: string;
  companyName?: string;
  location?: string;
}

// Utility to build proxy args from env
function buildProxyArgs() {
  const host = process.env.DECODO_HOST || 'gate.decodo.com';
  const port = process.env.DECODO_PORT || '10001';
  const user = process.env.DECODO_USER || '';
  const pass = process.env.DECODO_PASS || '';
  if (!user || !pass) return { args: [], creds: null };
  const proxyUrl = `http://${host}:${port}`;
  const creds = { username: user, password: pass };
  return { args: [`--proxy-server=${proxyUrl}`], creds };
}

export async function fetchSalesNavJson(options: SalesNavFetchOptions): Promise<any> {
  const { apiUrl, fullCookie, csrfToken } = options;
  const { args, creds } = buildProxyArgs();

  const browser = await chromium.launch({ headless: true, args });
  const context: BrowserContext = await browser.newContext();

  if (creds) {
    await context.setHTTPCredentials(creds);
  }

  // Add cookies
  const cookieEntries = fullCookie.split(';').map(part => part.trim()).filter(Boolean);
  const cookies = cookieEntries.map(pair => {
    const equalIdx = pair.indexOf('=');
    const name = pair.substring(0, equalIdx);
    const value = pair.substring(equalIdx + 1);
    return { name, value, domain: '.linkedin.com', path: '/', httpOnly: false, secure: true, sameSite: 'Lax' } as any;
  });
  await context.addCookies(cookies);

  const page = await context.newPage();
  // Step 1: load lightweight Sales Nav page to establish session & headers
  await page.goto('https://www.linkedin.com/sales/home', { waitUntil: 'domcontentloaded' });

  // Extract x-li-page-instance from <meta name="pageInstance" ...>
  const pageInstance = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="pageInstance"]');
    return meta ? meta.getAttribute('content') : null;
  });
  if (!pageInstance) console.warn('[Playwright] Failed to grab pageInstance meta');

  // Capture x-li-identity from the first voyager/sales API request
  let identity: string | null = null;
  const identityPromise = new Promise<string>((resolve) => {
    page.on('request', req => {
      if (identity) return;
      if (req.url().includes('/salesApi') || req.url().includes('/voyager/api')) {
        const hdr = req.headers();
        if (hdr['x-li-identity']) {
          identity = hdr['x-li-identity'];
          resolve(identity);
        }
      }
    });
  });
  // Trigger a benign fetch to ensure we capture headers quickly
  await page.evaluate(() => fetch('/voyager/api/typeahead/hits?keywords=test').catch(() => {}));
  await Promise.race([identityPromise, page.waitForTimeout(5000)]);

  if (!identity) console.warn('[Playwright] x-li-identity not captured');

  // Now perform target fetch with assembled headers
  const result = await page.evaluate(async ({ url, csrf, identity, pageInstance }) => {
    const headers: Record<string, string> = {
      'accept': '*/*',
      'csrf-token': csrf,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': '{"clientVersion":"2.0.4899","mpName":"lighthouse-web"}'
    };
    if (identity) headers['x-li-identity'] = identity;
    if (pageInstance) headers['x-li-page-instance'] = pageInstance;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    let json: any = {};
    try {
      json = await res.json();
    } catch {
      // ignore JSON parse errors
    }
    return { status: res.status, ok: res.ok, json };
  }, { url: apiUrl, csrf: csrfToken, identity, pageInstance });

  await browser.close();
  return result;
} 