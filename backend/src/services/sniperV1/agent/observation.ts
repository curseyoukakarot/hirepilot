import type { Page } from 'playwright';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Observation = {
  url: string;
  title: string;
  screenshotBase64: string;   // PNG base64
  domSnapshot: string;        // Simplified interactive element tree
  visibleText: string;        // Main page text (truncated)
};

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

const SCREENSHOT_WIDTH = 1024;
const MAX_VISIBLE_TEXT_LENGTH = 4000;

async function captureScreenshot(page: Page): Promise<string> {
  const screenshotEnabled = String(process.env.SNIPER_AGENT_SCREENSHOT_ENABLED || 'true').toLowerCase() !== 'false';
  if (!screenshotEnabled) return '';

  const buffer = await page.screenshot({ type: 'png', fullPage: false });

  // Resize to keep token cost low
  const resized = await sharp(buffer)
    .resize(SCREENSHOT_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 6 })
    .toBuffer();

  return resized.toString('base64');
}

// ---------------------------------------------------------------------------
// DOM snapshot - extract interactive elements with selectors
// ---------------------------------------------------------------------------

async function captureDomSnapshot(page: Page): Promise<string> {
  const snapshot = await page.evaluate(() => {
    const elements: string[] = [];
    const MAX_ELEMENTS = 150;
    let count = 0;

    function getSelector(el: Element): string {
      // Try ID first
      if (el.id) return `#${CSS.escape(el.id)}`;

      // Try data-testid or data-control-name
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-control-name');
      if (testId) return `[data-testid="${testId}"]`;

      // Try aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.length < 50) return `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;

      // Use nth-of-type path
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;

      const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (siblings.length === 1) return `${getSelector(parent)} > ${tag}`;

      const idx = siblings.indexOf(el) + 1;
      return `${getSelector(parent)} > ${tag}:nth-of-type(${idx})`;
    }

    function getVisibleText(el: Element): string {
      const text = (el as HTMLElement).innerText || el.textContent || '';
      return text.trim().slice(0, 80);
    }

    function isVisible(el: Element): boolean {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    // Gather interactive elements
    const interactiveSelectors = [
      'button', 'a[href]', 'input', 'textarea', 'select',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[role="checkbox"]', '[role="switch"]',
      '[onclick]', '[data-control-name]',
    ];

    for (const sel of interactiveSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (count >= MAX_ELEMENTS) break;
        if (!isVisible(el)) continue;

        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const text = getVisibleText(el);
        const type = (el as HTMLInputElement).type || '';
        const href = (el as HTMLAnchorElement).href || '';
        const selector = getSelector(el);
        const disabled = (el as HTMLButtonElement).disabled ? ' [disabled]' : '';

        let desc = `[${tag}`;
        if (role) desc += ` role="${role}"`;
        if (type) desc += ` type="${type}"`;
        desc += `]`;
        if (text) desc += ` "${text}"`;
        if (href && href.length < 100) desc += ` href="${href}"`;
        desc += disabled;
        desc += ` -> ${selector}`;

        elements.push(desc);
        count++;
      }
      if (count >= MAX_ELEMENTS) break;
    }

    return elements.join('\n');
  });

  return snapshot;
}

// ---------------------------------------------------------------------------
// Visible text extraction
// ---------------------------------------------------------------------------

async function captureVisibleText(page: Page): Promise<string> {
  try {
    const text = await page.evaluate(() => {
      const body = document.body;
      if (!body) return '';
      return body.innerText || body.textContent || '';
    });
    return text.trim().slice(0, MAX_VISIBLE_TEXT_LENGTH);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Main observation function
// ---------------------------------------------------------------------------

export async function captureObservation(page: Page): Promise<Observation> {
  // Retry logic: Sales Navigator (and other heavy SPA pages) can destroy the
  // execution context during initial load due to client-side redirects/module
  // bootstrapping.  If we hit "Execution context was destroyed", wait for the
  // page to settle and retry.
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [url, title, screenshotBase64, domSnapshot, visibleText] = await Promise.all([
        page.url(),
        page.title().catch(() => ''),
        captureScreenshot(page),
        captureDomSnapshot(page),
        captureVisibleText(page),
      ]);

      return { url, title, screenshotBase64, domSnapshot, visibleText };
    } catch (e: any) {
      const isContextDestroyed =
        e.message?.includes('Execution context was destroyed') ||
        e.message?.includes('context was destroyed') ||
        e.message?.includes('navigation');

      if (isContextDestroyed && attempt < MAX_RETRIES) {
        console.warn(`[observation] Context destroyed on attempt ${attempt}/${MAX_RETRIES}, waiting for page to settle…`);
        await page.waitForTimeout(3000);
        continue;
      }
      throw e;
    }
  }

  // TypeScript: unreachable, but keeps the compiler happy
  throw new Error('captureObservation: exhausted retries');
}
