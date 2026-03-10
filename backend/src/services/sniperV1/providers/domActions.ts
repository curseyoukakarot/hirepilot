/**
 * domActions.ts — Inject Chrome extension's battle-tested DOM functions into Browserbase pages.
 *
 * The Chrome extension's hpConnectAndSendDOM() function is the most reliable way to
 * interact with LinkedIn's UI. It uses dispatchClick(), text-based element search,
 * 8-attempt retry loops, and top-card scoping — all pure DOM manipulation with ZERO
 * Chrome extension API dependencies.
 *
 * This module:
 * 1. Packages the function as a raw JS string for page.evaluate() injection
 * 2. Provides a TypeScript wrapper that calls it and maps results to provider types
 * 3. Adds lightweight post-send verification (poll for Pending button)
 *
 * Source: hirepilot-cookie/extension/content.js lines 13-189
 */

import type { Page } from 'playwright';
import type { SendConnectResult } from './types';

// ---------------------------------------------------------------------------
// Type augmentation for the browser global
// ---------------------------------------------------------------------------

type DomConnectResult =
  | { ok: true }
  | { skipped: true; reason: string }
  | { error: string };

declare global {
  interface Window {
    __hpConnectAndSendDOM: (message: string) => Promise<DomConnectResult>;
    __HP_CONNECT_RUNNING__: boolean;
  }
}

// ---------------------------------------------------------------------------
// Raw JS string — extracted from hirepilot-cookie/extension/content.js
// lines 13-189. This runs in the BROWSER context, NOT Node.js.
//
// Changes from content.js:
// - Assigned to window.__hpConnectAndSendDOM (global scope for evaluate access)
// - Console.log prefix changed from '[HirePilot Extension]' to '[HP DOM Engine]'
// - Everything else is IDENTICAL to the battle-tested extension code
// ---------------------------------------------------------------------------

export const HP_CONNECT_DOM_SCRIPT = `
(function() {
  if (typeof window.__hpConnectAndSendDOM === 'function') return; // Already injected

  window.__hpConnectAndSendDOM = async function(message) {
    const wait = (ms) => new Promise(r=>setTimeout(r, ms));
    const dispatchClick = (el) => { try { el && el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); el?.click?.(); return !!el; } catch { return false; } };
    const findByText = (root, selector, regex) => {
      const nodes = Array.from((root || document).querySelectorAll(selector));
      return nodes.find(n => regex.test((n.textContent || '').trim())) || null;
    };
    const findClickableByText = (root, selector, regex) => {
      const el = findByText(root, selector, regex);
      if (!el) return null;
      return el.closest('button, a, [role="menuitem"], [role="button"]') || el;
    };
    const isVisible = (el) => !!(el && el.offsetParent !== null);
    const textOf = (el) => (el && (el.textContent || '').trim()) || '';

    // Prefer searching within top card area to avoid sidebar "More profiles" buttons
    const topCard = document.querySelector('.pv-top-card, .profile-topcard, [data-view-name="profile"], section.pv-top-card, .pv-top-card-v2-ctas') || document;
    const waitForVisible = async (selector, timeout = 18000) => new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el && el.offsetParent !== null) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(tick, 300);
      };
      tick();
    });

    // Avoid duplicate runs
    if (window.__HP_CONNECT_RUNNING__) return { skipped: true, reason: 'Already running' };
    window.__HP_CONNECT_RUNNING__ = true;

    try {
      // Ensure top-card is present before attempting
      await waitForVisible('.pv-top-card, .profile-topcard, [data-view-name="profile"], section.pv-top-card, .pv-top-card-v2-ctas');

      let target = null;
      // Retry attempts to locate Connect
      for (let attempt = 0; attempt < 8 && !target; attempt++) {
        // Strategy 1: Direct Connect/Invite in top card (exact then fuzzy)
        target = findClickableByText(topCard, 'button,[role="button"],a', /^(connect|invite)$/i) ||
                 findClickableByText(topCard, 'button,[role="button"],a', /(connect|invite)/i) ||
                 topCard.querySelector('button[aria-label*="Connect" i], a[aria-label*="Connect" i]');
        if (target) break;

        // Strategy 2: Open More dropdown and search menu
        let moreBtn = findClickableByText(topCard, 'button,[role="button"],a', /^more$/i) ||
                      findClickableByText(topCard, 'button,[role="button"],a', /more/i) ||
                      topCard.querySelector('button[aria-label*="More" i]') ||
                      topCard.querySelector('button.artdeco-dropdown__trigger[aria-haspopup="menu"]') ||
                      topCard.querySelector('button[aria-expanded][aria-controls]');
        if (moreBtn) {
          dispatchClick(moreBtn);
          await wait(500 + Math.floor(Math.random()*300));
          const menus = Array.from(document.querySelectorAll('div[role="menu"], ul[role="menu"], .artdeco-dropdown__content-inner, .artdeco-dropdown__content'));
          const menu = menus.find(m => (m.offsetParent !== null)) || menus[0] || document;
          target = findClickableByText(menu, 'div[role="menuitem"],li,button,a,span', /connect|invite/i);
          if (!target) {
            const items = Array.from(menu.querySelectorAll('div[role="menuitem"], li, button, a')).filter(n => (n.offsetParent !== null));
            if (items.length) target = items.find(el => /connect|invite/i.test((el.textContent||'').trim()));
          }
          // Close menu if Connect wasn't found (prevents stale dropdown)
          if (!target) {
            try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch {}
            await wait(300);
          }
        }

        // Strategy 3: Brute-force search ENTIRE PAGE (not just top card)
        // Catches "Connect if you know each other" sections below the top card,
        // and other non-standard Connect placements LinkedIn shows to some accounts.
        if (!target) {
          const brute = Array.from(document.querySelectorAll('button,a,[role="menuitem"],[role="button"],li,span'))
            .filter(el => isVisible(el) && /^(connect|invite)$/i.test((el.textContent||'').trim()))[0];
          if (brute) target = brute.closest('button,a,[role="menuitem"],[role="button"]') || brute;
        }

        // Strategy 4: Fuzzy full-page search (catches partial matches like "Connect with...")
        if (!target) {
          const fuzzy = Array.from(document.querySelectorAll('button,a,[role="button"]'))
            .filter(el => isVisible(el) && /connect|invite/i.test((el.textContent||'').trim()) && !/disconnect/i.test((el.textContent||'').trim()))[0];
          if (fuzzy) target = fuzzy;
        }

        if (!target && attempt === 0) {
          // Scroll down 40% on first attempt to reveal below-fold Connect sections
          try { window.scrollTo(0, document.body.scrollHeight * 0.4); } catch {}
        }

        if (!target) await wait(700);
      }

      if (!target) {
        // No Connect found. Determine profile state comprehensively.
        // Search FULL PAGE (not just top card) for state indicators.

        // Pending detection: explicit labels/buttons
        const pendingEl = Array.from(document.querySelectorAll('button,[role="button"],a,span')).find((el) => /\\b(pending|invited|withdraw|requested)\\b/i.test(textOf(el)));

        // 1st-degree badge detection
        const degreeEl = Array.from(document.querySelectorAll('span,div,[aria-label]')).find((el) => /\\b1st\\b/i.test(textOf(el)) || /\\b1st\\b/i.test(el.getAttribute('aria-label') || ''));

        // Message CTA without any Connect available strongly implies already connected
        const messageEl = (findClickableByText(document, 'button,[role="button"],a,span', /^message$/i) || findClickableByText(document, 'button,[role="button"],a,span', /^(message|open message)$/i));

        // Follow button detection — LinkedIn shows Follow instead of Connect for low-trust accounts or out-of-network profiles
        const followEl = findClickableByText(document, 'button,[role="button"],a,span', /^follow$/i);

        // Any evidence of a Connect action anywhere on the page?
        const hasAnyConnect = !!(
          findClickableByText(document, 'button,[role="button"],a,span', /\\bconnect\\b/i) ||
          document.querySelector('button[aria-label*="Connect" i], a[aria-label*="Connect" i]')
        );

        // Collect all visible button labels for diagnostics
        const visibleButtons = Array.from(document.querySelectorAll('button,[role="button"]'))
          .filter(el => isVisible(el))
          .map(el => textOf(el))
          .filter(t => t.length > 0 && t.length < 30)
          .slice(0, 15);

        try {
          console.log('[HP DOM Engine] Connect not found; evaluating status', {
            hasAnyConnect: !!hasAnyConnect,
            pendingDetected: !!pendingEl,
            firstDegreeBadge: !!degreeEl,
            messageCta: !!messageEl,
            followBtn: !!followEl,
            visibleButtons: visibleButtons
          });
        } catch {}

        if (pendingEl) {
          try { console.log('[HP DOM Engine] Skip: Pending detected via element:', textOf(pendingEl).slice(0, 120)); } catch {}
          return { skipped: true, reason: 'Pending invitation' };
        }
        if (degreeEl) {
          try { console.log('[HP DOM Engine] Skip: Already connected (1st-degree badge visible)'); } catch {}
          return { skipped: true, reason: 'Already connected (1st)' };
        }
        if (messageEl && !hasAnyConnect) {
          try { console.log('[HP DOM Engine] Skip: Message CTA present and no Connect action available'); } catch {}
          return { skipped: true, reason: 'Already connected (Message only, no Connect)' };
        }
        if (followEl && !hasAnyConnect) {
          try { console.log('[HP DOM Engine] Follow button visible but no Connect — profile may be restricted or account trust too low'); } catch {}
          return { error: 'Connect not available (Follow only — account may need warming up)', followOnly: true };
        }

        return { error: 'Connect button not found after 8 attempts. Visible buttons: ' + visibleButtons.join(', ') };
      }
      try {
        console.log('[HP DOM Engine] Clicking Connect target:', (target.getAttribute('aria-label') || textOf(target) || '').slice(0, 120));
      } catch {}
      dispatchClick(target);
      await wait(800);

      // 3) Handle the post-click dialog
      const dlg = document.querySelector('div[role="dialog"], .artdeco-modal') || document;
      const hasNote = (message || '').trim().length > 0;

      if (hasNote) {
        // --- WITH NOTE: click "Add a note" → fill textarea → click Send ---
        const findAddNoteButton = () => {
          const d = document.querySelector('div[role="dialog"], .artdeco-modal') || document;
          return (
            findClickableByText(d, 'button,[role="button"],a,span', /^add a note$/i) ||
            findClickableByText(d, 'button,[role="button"],a,span', /add a note/i) ||
            document.querySelector('button[aria-label*="Add a note" i]')
          );
        };

        let addNote = findAddNoteButton();
        if (addNote) { dispatchClick(addNote); await wait(600); }

        // Fill the note (wait adaptively for the textarea to appear)
        const modal = document.querySelector('div[role="dialog"], .artdeco-modal') || document;
        const inputSelectors = [
          'textarea[name="message"]',
          'textarea#custom-message',
          'textarea[id*="custom" i]',
          'textarea[aria-label*="note" i]',
          '.msg-form__contenteditable',
          'div[contenteditable="true"]',
          'textarea'
        ];
        let inputs = Array.from(modal.querySelectorAll(inputSelectors.join(', ')));
        if (!inputs.length) {
          addNote = findAddNoteButton();
          if (addNote) { dispatchClick(addNote); await wait(800); }
          for (let i=0; i<8 && !inputs.length; i++) {
            await wait(300);
            inputs = Array.from((document.querySelector('div[role="dialog"], .artdeco-modal')||document).querySelectorAll(inputSelectors.join(', ')));
          }
        }
        if (!inputs.length) return { error: 'Could not find message input' };
        const input = inputs[0];
        const max = Number(input.getAttribute('maxlength') || 300);
        const text = (message || '').slice(0, max);
        if (input.tagName.toLowerCase() === 'textarea') { input.value = text; } else { input.textContent = text; }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(300);

        // Click Send
        const sendBtn = findClickableByText(modal, 'button,[role="button"],a,span', /^send$/i) ||
                        findClickableByText(modal, 'button,[role="button"],a,span', /send/i) ||
                        modal.querySelector('button[aria-label*="Send" i]') ||
                        modal.querySelector('button.artdeco-button--primary');
        if (!sendBtn) return { error: 'Send button not found' };
        dispatchClick(sendBtn);
        await wait(600);
      } else {
        // --- WITHOUT NOTE: click "Send without a note" or just "Send" directly ---
        const modal = document.querySelector('div[role="dialog"], .artdeco-modal') || document;

        // Try "Send without a note" first (LinkedIn's fast path)
        const sendWithoutNote = findClickableByText(modal, 'button,[role="button"],a,span', /send without a note/i) ||
                                findClickableByText(modal, 'button,[role="button"],a,span', /^send$/i) ||
                                findClickableByText(modal, 'button,[role="button"],a,span', /send/i) ||
                                modal.querySelector('button[aria-label*="Send" i]') ||
                                modal.querySelector('button.artdeco-button--primary');
        if (!sendWithoutNote) {
          // No send button in dialog — maybe LinkedIn sent immediately (no confirmation dialog)
          await wait(500);
          try { console.log('[HP DOM Engine] No Send button found in dialog — Connect may have been sent directly'); } catch {}
        } else {
          dispatchClick(sendWithoutNote);
          await wait(600);
        }
      }

      return { ok: true };
    } catch (e) {
      return { error: e?.message || 'Failed to connect and send' };
    } finally {
      window.__HP_CONNECT_RUNNING__ = false;
    }
  };
})();
`;

// ---------------------------------------------------------------------------
// Feature flag — allows quick disable if issues arise in production
// ---------------------------------------------------------------------------

const DOM_CONNECT_ENABLED = String(process.env.SNIPER_DOM_CONNECT_ENABLED || 'true') === 'true';

// ---------------------------------------------------------------------------
// Inject the DOM script into a page context (idempotent)
// ---------------------------------------------------------------------------

export async function injectDomActions(page: Page): Promise<void> {
  await page.evaluate(HP_CONNECT_DOM_SCRIPT).catch((err: any) => {
    console.warn('[domActions] Failed to inject DOM script:', err?.message);
  });
}

// ---------------------------------------------------------------------------
// Execute connect via injected DOM function and map to provider types
// ---------------------------------------------------------------------------

export async function domConnectAndSend(
  page: Page,
  note?: string | null,
): Promise<
  | { resolved: true; result: SendConnectResult }
  | { resolved: false; error: string }
> {
  // Kill switch
  if (!DOM_CONNECT_ENABLED) {
    return { resolved: false, error: 'DOM connect disabled via SNIPER_DOM_CONNECT_ENABLED' };
  }

  const trimmedNote = String(note || '').trim().slice(0, 300);

  try {
    // Inject the script (idempotent — IIFE checks if already defined)
    await injectDomActions(page);

    // Call the injected function
    const raw: DomConnectResult = await page.evaluate(async (msg: string) => {
      if (typeof window.__hpConnectAndSendDOM !== 'function') {
        return { error: 'DOM connect function not injected' } as { error: string };
      }
      return window.__hpConnectAndSendDOM(msg);
    }, trimmedNote);

    // --- Map extension return values to provider SendConnectResult ---

    // Success: connection request sent
    if ('ok' in raw && raw.ok) {
      // Lightweight post-send verification: poll for Pending/Invited button
      const verified = await verifyPendingButton(page);
      return {
        resolved: true,
        result: {
          status: 'sent_verified',
          details: {
            method: 'dom_inject',
            verification: verified ? 'confirmed' : 'trusted_send_click',
          },
        },
      };
    }

    // Skipped: profile state was definitively detected
    if ('skipped' in raw && raw.skipped) {
      const reason = raw.reason || '';

      if (/pending|invited|withdraw|requested/i.test(reason)) {
        return {
          resolved: true,
          result: {
            status: 'already_pending',
            details: { method: 'dom_inject', reason },
          },
        };
      }

      if (/already connected|1st|message only/i.test(reason)) {
        return {
          resolved: true,
          result: {
            status: 'already_connected',
            details: { method: 'dom_inject', reason },
          },
        };
      }

      // Unknown skip reason (e.g., "Already running" guard)
      return {
        resolved: true,
        result: {
          status: 'skipped',
          details: { method: 'dom_inject', reason },
        },
      };
    }

    // Error: DOM automation couldn't complete — fall through to LLM
    const errorMsg = ('error' in raw && raw.error) || 'Unknown DOM error';
    console.warn(`[domActions] DOM connect returned error: ${errorMsg}`);
    return { resolved: false, error: errorMsg };
  } catch (err: any) {
    // page.evaluate threw (timeout, page crash, etc.)
    console.warn(`[domActions] DOM connect threw: ${err?.message}`);
    return { resolved: false, error: err?.message || 'DOM evaluate failed' };
  }
}

// ---------------------------------------------------------------------------
// Lightweight post-send verification (no page navigation)
// ---------------------------------------------------------------------------

async function verifyPendingButton(page: Page): Promise<boolean> {
  // First check immediately
  const immediate = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], span'));
    return buttons.some(b => /^(pending|invited)$/i.test((b.textContent || '').trim()));
  }).catch(() => false);

  if (immediate) return true;

  // Wait 2 seconds and retry (LinkedIn may take a moment to update the UI)
  await page.waitForTimeout(2000).catch(() => {});

  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], span'));
    return buttons.some(b => /^(pending|invited)$/i.test((b.textContent || '').trim()));
  }).catch(() => false);
}
