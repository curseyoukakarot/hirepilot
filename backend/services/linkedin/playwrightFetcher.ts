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
  await page.goto('https://www.linkedin.com/sales', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async ({ url, csrf }) => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'csrf-token': csrf,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, json };
  }, { url: apiUrl, csrf: csrfToken });

  await browser.close();
  return result;
} 