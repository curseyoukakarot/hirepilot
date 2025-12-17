import axios from 'axios';
import { Builder, By, Key, until } from 'selenium-webdriver';
import { brightDataBrowserConfig, isBrightDataBrowserEnabled } from '../config/brightdata';

export type LinkedInRemoteActionType = 'connect_request' | 'send_message';

export interface LinkedInRemoteActionPayload {
  action: LinkedInRemoteActionType;
  linkedinUrl: string;
  message?: string;
}

interface BrowserRunRequest {
  url: string;
  cookies: string;
  action: LinkedInRemoteActionType;
  message?: string;
}

function isSeleniumEndpoint(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return u.port === '9515' || u.host.endsWith('brd.superproxy.io:9515');
  } catch {
    return baseUrl.includes(':9515');
  }
}

function buildSeleniumServerUrl(): string {
  const baseUrlRaw = String(brightDataBrowserConfig.baseUrl || '').trim();
  const username = String(brightDataBrowserConfig.username || '').trim();
  const password = String(brightDataBrowserConfig.password || '').trim();
  if (!baseUrlRaw) throw new Error('Missing BRIGHTDATA_BROWSER_BASE_URL');
  if (!username || !password) throw new Error('Missing BRIGHTDATA_BROWSER_USERNAME or BRIGHTDATA_BROWSER_PASSWORD');

  const u = new URL(baseUrlRaw.startsWith('http') ? baseUrlRaw : `https://${baseUrlRaw}`);
  // Inject basic auth for Selenium remote
  u.username = username;
  u.password = password;
  return u.toString();
}

async function clickFirst(driver: any, xpaths: string[], timeoutMs = 15_000): Promise<boolean> {
  for (const xp of xpaths) {
    try {
      const el = await driver.wait(until.elementLocated(By.xpath(xp)), timeoutMs);
      await driver.wait(until.elementIsVisible(el), timeoutMs);
      await el.click();
      return true;
    } catch {}
  }
  return false;
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  // cookieHeader is typically "a=b; c=d; e=f"
  return (cookieHeader || '')
    .split(';')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return { name: '', value: '' };
      const name = pair.slice(0, idx).trim();
      let value = pair.slice(idx + 1).trim();
      // LinkedIn sometimes stores JSESSIONID wrapped in quotes
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      return { name, value };
    })
    .filter((c) => c.name && c.value);
}

async function applyLinkedInCookies(driver: any, cookieHeader: string) {
  const cookies = parseCookieHeader(cookieHeader);
  if (!cookies.length) return;

  // Must be on the target domain before adding cookies
  await driver.get('https://www.linkedin.com/');
  await driver.sleep(800);

  for (const c of cookies) {
    try {
      // Selenium requires same-domain; setting domain explicitly can fail on some drivers,
      // so we omit it and rely on current domain.
      await driver.manage().addCookie({
        name: c.name,
        value: c.value,
        path: '/',
        secure: true
      });
    } catch {}
  }

  // Refresh to apply cookies
  await driver.navigate().refresh();
  await driver.sleep(800);
}

async function detectLoginGate(driver: any): Promise<boolean> {
  try {
    const url = String(await driver.getCurrentUrl());
    const title = String(await driver.getTitle());
    if (url.includes('/login') || url.includes('/checkpoint') || title.toLowerCase().includes('sign in')) return true;
  } catch {}
  try {
    // Common login form fields
    const els = await driver.findElements(By.css('input[name="session_key"], input[name="session_password"]'));
    if (els && els.length) return true;
  } catch {}
  return false;
}

async function runViaSelenium(
  cookies: string,
  payload: LinkedInRemoteActionPayload,
  context: { userId: string; leadId?: string; candidateId?: string }
): Promise<{ success: boolean; error?: string }> {
  const server = buildSeleniumServerUrl();
  const driver = await new Builder().forBrowser('chrome').usingServer(server).build();
  try {
    console.log('[BrightDataBrowser:Selenium] Connected', { userId: context.userId, url: payload.linkedinUrl });

    // Apply cookies so LinkedIn is authenticated
    await applyLinkedInCookies(driver, cookies);

    // Navigate to target profile
    await driver.get(payload.linkedinUrl);

    // Basic waits for page readiness
    await driver.sleep(1500);

    if (await detectLoginGate(driver)) {
      let url = '';
      let title = '';
      try { url = String(await driver.getCurrentUrl()); } catch {}
      try { title = String(await driver.getTitle()); } catch {}
      return {
        success: false,
        error: `LinkedIn session not authenticated (login/checkpoint detected). url=${url} title=${title}`
      };
    }

    if (payload.action === 'connect_request') {
      // Connect button, or More -> Connect
      const connected = await clickFirst(driver, [
        "//button[.//span[normalize-space()='Connect']]",
        "//button[contains(@aria-label,'Connect')]",
        "//button[contains(.,'Connect')]"
      ]);
      if (!connected) {
        const openedMore = await clickFirst(driver, [
          "//button[.//span[normalize-space()='More']]",
          "//button[contains(.,'More')]"
        ]);
        if (openedMore) {
          const inMenu = await clickFirst(driver, [
            "//div[@role='menu']//span[normalize-space()='Connect']/ancestor::button[1]",
            "//div[@role='menu']//span[contains(.,'Connect')]/ancestor::button[1]"
          ]);
          if (!inMenu) return { success: false, error: 'Could not find Connect action on profile (may be 1st-degree, follow-only, or restricted).' };
        } else {
          return { success: false, error: 'Could not find Connect button (may be 1st-degree, follow-only, or restricted).' };
        }
      }

      // Optional note
      if (payload.message && payload.message.trim()) {
        await clickFirst(driver, [
          "//button[.//span[normalize-space()='Add a note']]",
          "//button[contains(.,'Add a note')]"
        ]).catch(() => false);
        try {
          const textarea = await driver.wait(until.elementLocated(By.xpath("//textarea")), 10_000);
          await textarea.sendKeys(payload.message.trim().slice(0, 300));
        } catch {}
      }

      // Send invite
      const sent = await clickFirst(driver, [
        "//button[.//span[normalize-space()='Send']]",
        "//button[contains(.,'Send')]",
        "//button[.//span[normalize-space()='Done']]"
      ]);
      if (!sent) return { success: false, error: 'Connect dialog did not show Send/Done button' };
      return { success: true };
    }

    // send_message
    const opened = await clickFirst(driver, [
      "//button[.//span[normalize-space()='Message']]",
      "//button[contains(.,'Message')]"
    ]);
    if (!opened) return { success: false, error: 'Could not find Message button on profile' };
    await driver.sleep(800);

    const msg = String(payload.message || '').trim();
    if (!msg) return { success: false, error: 'Missing message' };

    // Try message composer
    const textboxXpaths = [
      "//*[@role='textbox']",
      "//div[@contenteditable='true']"
    ];
    let typed = false;
    for (const xp of textboxXpaths) {
      try {
        const box = await driver.wait(until.elementLocated(By.xpath(xp)), 10_000);
        await box.click();
        await box.sendKeys(msg);
        typed = true;
        break;
      } catch {}
    }
    if (!typed) return { success: false, error: 'Could not locate message textbox' };

    // Send
    const sendBtn = await clickFirst(driver, [
      "//button[.//span[normalize-space()='Send']]",
      "//button[contains(.,'Send')]"
    ]);
    if (!sendBtn) {
      // Fallback: press Enter
      try {
        await driver.actions().sendKeys(Key.ENTER).perform();
      } catch {}
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  } finally {
    try {
      await driver.quit();
    } catch {}
  }
}

export async function runLinkedInRemoteAction(
  cookies: string,
  payload: LinkedInRemoteActionPayload,
  context: { userId: string; leadId?: string; candidateId?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!isBrightDataBrowserEnabled()) {
    const hasToken = Boolean(brightDataBrowserConfig.apiToken);
    const hasBaseUrl = Boolean(brightDataBrowserConfig.baseUrl);
    console.warn('[BrightDataBrowser] Disabled/misconfigured', {
      hasToken,
      hasBaseUrl,
      envEnabledFlag: String(process.env.BRIGHTDATA_BROWSER_ENABLED || ''),
      baseUrlPreview: brightDataBrowserConfig.baseUrl ? String(brightDataBrowserConfig.baseUrl).slice(0, 32) : null
    });
    return {
      success: false,
      error: `Bright Data Browser API is disabled (hasToken=${hasToken}, hasBaseUrl=${hasBaseUrl})`
    };
  }

  const baseUrl = String(brightDataBrowserConfig.baseUrl || '').trim();
  // Selenium/WebDriver mode (HTTPS :9515) — use username/password
  if (isSeleniumEndpoint(baseUrl) || (brightDataBrowserConfig.username && brightDataBrowserConfig.password)) {
    return await runViaSelenium(cookies, payload, context);
  }

  if (!cookies || !payload.linkedinUrl) {
    return { success: false, error: 'Missing cookies or LinkedIn URL' };
  }

  const requestBody: BrowserRunRequest = {
    url: payload.linkedinUrl,
    cookies,
    action: payload.action,
    message: payload.message
  };

  const requestConfig = {
    headers: {
      Authorization: `Bearer ${brightDataBrowserConfig.apiToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 120_000
  };

  console.log('[BrightDataBrowser] Starting action', {
    action: payload.action,
    userId: context.userId,
    leadId: context.leadId,
    candidateId: context.candidateId,
    url: payload.linkedinUrl
  });

  try {
    const response = await axios.post(
      brightDataBrowserConfig.baseUrl!,
      {
        country: brightDataBrowserConfig.country,
        session: {
          cookies: cookies.split(';').map((rawCookie) => {
            const [name, ...rest] = rawCookie.trim().split('=');
            return {
              name,
              value: rest.join('='),
              domain: '.linkedin.com',
              path: '/',
              httpOnly: true,
              secure: true
            };
          })
        },
        actions: [
          {
            run: {
              command: payload.action,
              args: {
                url: payload.linkedinUrl,
                message: payload.message || ''
              }
            }
          }
        ]
      },
      requestConfig
    );

    const runResult = response.data;
    if (runResult?.success === false) {
      console.error('[BrightDataBrowser] Action failed', {
        action: payload.action,
        userId: context.userId,
        leadId: context.leadId,
        candidateId: context.candidateId,
        info: runResult?.error || runResult
      });
      return { success: false, error: runResult?.error || 'Unknown Browser API error' };
    }

    console.log('[BrightDataBrowser] Action completed', {
      action: payload.action,
      userId: context.userId,
      leadId: context.leadId,
      candidateId: context.candidateId
    });
    return { success: true };
  } catch (error: any) {
    console.error('[BrightDataBrowser] Action error', {
      action: payload.action,
      userId: context.userId,
      leadId: context.leadId,
      candidateId: context.candidateId,
      error: error?.message || String(error)
    });
    return { success: false, error: error?.message || 'Browser API request failed' };
  }
}

