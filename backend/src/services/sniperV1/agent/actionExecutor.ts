import type { Page } from 'playwright';
import type { AgentAction } from './llmClient';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ACTION_TIMEOUT = 10_000; // 10s per action
const MAX_WAIT_MS = 5_000;
const DEFAULT_SCROLL_AMOUNT = 600;

// ---------------------------------------------------------------------------
// Execute a single agent action on the page
// ---------------------------------------------------------------------------

/**
 * Translate an AgentAction into a Playwright command and execute it.
 * Returns a human-readable result string the LLM can use in the next step.
 */
export async function executeAction(page: Page, action: AgentAction): Promise<string> {
  try {
    switch (action.type) {
      case 'navigate': {
        const url = action.url;
        if (!url) return 'Error: navigate action missing url';

        // Safety: only allow LinkedIn URLs
        if (!url.startsWith('https://www.linkedin.com') && !url.startsWith('https://linkedin.com')) {
          return `Error: navigation blocked - only linkedin.com URLs allowed, got: ${url}`;
        }

        // Sales Navigator pages are heavy SPAs that need full load + extra settle
        // Profile pages via residential proxy need longer timeouts
        const isSalesNav = url.includes('/sales/');
        const navTimeout = isSalesNav ? 60_000 : 45_000;
        try {
          await page.goto(url, {
            waitUntil: isSalesNav ? 'load' : 'domcontentloaded',
            timeout: navTimeout,
          });
        } catch (navErr: any) {
          const isTimeout = String(navErr?.message || '').includes('Timeout');
          if (isTimeout) {
            // Retry with commit strategy — get the page loaded even if assets are slow
            await page.goto(url, { waitUntil: 'commit', timeout: navTimeout });
            await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
          } else {
            throw navErr;
          }
        }
        await page.waitForTimeout(isSalesNav ? 3000 : 1000);
        return `Navigated to ${page.url()}`;
      }

      case 'click': {
        const selector = action.selector;
        if (!selector) return 'Error: click action missing selector';

        try {
          // First try the selector directly
          const locator = page.locator(selector).first();
          await locator.waitFor({ state: 'visible', timeout: DEFAULT_ACTION_TIMEOUT });
          await locator.click({ timeout: DEFAULT_ACTION_TIMEOUT });
          await page.waitForTimeout(500); // Brief settle after click
          return `Clicked element: ${selector}${action.description ? ` (${action.description})` : ''}`;
        } catch (e: any) {
          // Fallback: try clicking by text content if selector fails
          if (action.description) {
            try {
              await page.getByText(action.description, { exact: false }).first().click({ timeout: 5000 });
              await page.waitForTimeout(500);
              return `Clicked element by text: "${action.description}" (selector ${selector} failed)`;
            } catch {
              // Both failed
            }
          }
          return `Error clicking ${selector}: ${e.message}`;
        }
      }

      case 'fill': {
        const { selector, value } = action;
        if (!selector) return 'Error: fill action missing selector';
        if (value === undefined || value === null) return 'Error: fill action missing value';

        try {
          const locator = page.locator(selector).first();
          await locator.waitFor({ state: 'visible', timeout: DEFAULT_ACTION_TIMEOUT });
          await locator.click({ timeout: 5000 });
          await locator.fill(String(value), { timeout: DEFAULT_ACTION_TIMEOUT });
          await page.waitForTimeout(300);
          return `Filled "${selector}" with value (${String(value).length} chars)`;
        } catch (e: any) {
          // Fallback: try typing character by character
          try {
            const locator = page.locator(selector).first();
            await locator.click({ timeout: 5000 });
            await page.keyboard.type(String(value), { delay: 30 });
            return `Typed into "${selector}" via keyboard (${String(value).length} chars)`;
          } catch (e2: any) {
            return `Error filling ${selector}: ${e.message}`;
          }
        }
      }

      case 'scroll': {
        const direction = action.direction || 'down';
        const amount = Math.min(Math.abs(action.amount || DEFAULT_SCROLL_AMOUNT), 2000);
        const pixels = direction === 'up' ? -amount : amount;
        const scrollSelector = (action as any).selector as string | undefined;

        const scrollResult = await page.evaluate(({ px, selector }) => {
          // Helper: scroll a specific element
          function scrollElement(el: Element, delta: number): string {
            const before = el.scrollTop;
            el.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
            const after = el.scrollTop;
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
            return `Scrolled container (${el.tagName}.${el.className.toString().slice(0, 40)}) by ${after - before}px (scrollTop: ${Math.round(before)} → ${Math.round(after)}, scrollHeight: ${el.scrollHeight}${atBottom ? ', AT_BOTTOM' : ''})`;
          }

          // 1. If a CSS selector was provided, scroll that element
          if (selector) {
            const target = document.querySelector(selector);
            if (target) {
              return scrollElement(target, px);
            }
            return `SELECTOR_NOT_FOUND:${selector}`;
          }

          // 2. Auto-detect: look for a visible modal/overlay with scrollable content
          // LinkedIn modals use these common patterns
          const modalSelectors = [
            '.artdeco-modal__content',           // LinkedIn artdeco modal body
            '.scaffold-finite-scroll__content',   // LinkedIn finite scroll container
            '[role="dialog"] [class*="scroll"]',  // Generic dialog scroll area
            '[role="dialog"]',                    // Dialog itself
            '.artdeco-modal',                     // LinkedIn modal
            '.social-details-reactors-modal__content', // Reactions modal specifically
            '.msg-overlay-list-bubble',           // Message overlay
          ];

          for (const sel of modalSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              const style = window.getComputedStyle(el);
              const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
              const isScrollable = el.scrollHeight > el.clientHeight + 10;
              if (isVisible && isScrollable) {
                return scrollElement(el, px);
              }
            }
          }

          // 3. Broader fallback: find ANY visible element with overflow-y scroll/auto
          //    that has scrollable content (scrollHeight > clientHeight)
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            if ((overflowY === 'scroll' || overflowY === 'auto') &&
                el.scrollHeight > el.clientHeight + 50 &&
                style.display !== 'none' && style.visibility !== 'hidden') {
              // Skip the <html> and <body> elements (those are page-level scroll)
              if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;
              return scrollElement(el, px);
            }
          }

          // 4. Final fallback: scroll the page
          window.scrollBy(0, px);
          return `PAGE_SCROLL:${px}`;
        }, { px: pixels, selector: scrollSelector });

        await page.waitForTimeout(800); // Slightly longer wait for lazy-loaded content

        if (scrollResult.startsWith('SELECTOR_NOT_FOUND:')) {
          return `Scroll warning: selector "${scrollSelector}" not found, no scroll performed. Try scrolling without a selector.`;
        }
        if (scrollResult.startsWith('PAGE_SCROLL:')) {
          return `Scrolled page ${direction} by ${amount}px (no modal/overlay detected)`;
        }
        return `Scrolled ${direction} by ${amount}px — ${scrollResult}`;
      }

      case 'wait': {
        const ms = Math.min(Math.max(action.ms || 1000, 100), MAX_WAIT_MS);
        await page.waitForTimeout(ms);
        return `Waited ${ms}ms`;
      }

      case 'extract':
        // Extract is a no-op on the page; the LLM provides the data in action.data
        return 'Data extracted (from LLM analysis)';

      case 'done':
        return 'Task completed';

      case 'error':
        return `Agent error: ${action.message}`;

      default:
        return `Unknown action type: ${(action as any).type}`;
    }
  } catch (e: any) {
    return `Unexpected error executing ${action.type}: ${e.message}`;
  }
}
