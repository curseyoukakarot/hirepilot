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

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(1000); // Brief settle time
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

        await page.evaluate((px) => window.scrollBy(0, px), pixels);
        await page.waitForTimeout(500);
        return `Scrolled ${direction} by ${amount}px`;
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
