import { test, expect } from '@playwright/test';

test.describe('Auth session smoke', () => {
  test('landing -> sign in screen renders', async ({ page }) => {
    await page.goto('/');
    // tolerate either redirect to /signin or inline login UI
    const loginSelectors = [
      'text=Sign in',
      'input[type="email"]',
      'button:has-text("Sign in with Google")',
    ];
    const anyVisible = await Promise.any(
      loginSelectors.map(async (sel) => {
        const el = await page.locator(sel).first();
        return el.isVisible();
      })
    ).catch(() => false);
    expect(anyVisible).toBeTruthy();
  });
});


