// content.js - Injected into LinkedIn pages to handle full cookie access and Sales Nav scraping

// Ignore subframes; operate only on top frame
if (window.top !== window) {
  // Still log for diagnostics, but do nothing
  console.log('[HirePilot Extension] (iframe) Ignoring subframe:', window.location.href);
} else {
  console.log('[HirePilot Extension] Content script loaded on:', window.location.href);
}

// Listen for messages from popup/background
// Shared DOM-based connect flow (no background dependency)
async function hpConnectAndSendDOM(message) {
  const wait = (ms) => new Promise(r=>setTimeout(r, ms));
  const dispatchClick = (el) => { try { el && el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); el?.click?.(); return !!el; } catch { return false; } };
  const isVisible = (el) => !!(el && el.offsetParent !== null);
  const textOf = (el) => (el && (el.textContent || '').trim()) || '';
  // Reject elements that reference counts/links for OTHER people (e.g. "See 12 mutual connections",
  // "Your connections", search result cards), which previously matched /connect/i and caused the
  // browser to navigate to /search/results/people/ instead of clicking the top-card Connect CTA.
  const isBadConnectCandidate = (el) => {
    if (!el) return true;
    const t = textOf(el).toLowerCase();
    if (!t) return true;
    if (/\b(connection|connections)\b/.test(t)) return true;
    if (/\bmutual\b/.test(t)) return true;
    if (/\bsee (all|\d)/.test(t)) return true;
    // Anchor pointing to search results or non-profile destinations
    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') || '').toLowerCase();
      if (href.includes('/search/results/')) return true;
      if (href.includes('connectionof=')) return true;
      if (href.includes('/mynetwork/')) return true;
    }
    const aria = (el.getAttribute && (el.getAttribute('aria-label') || '')).toLowerCase();
    if (aria && (/\b(connection|connections)\b/.test(aria) || /\bmutual\b/.test(aria))) return true;
    return false;
  };
  const findByText = (root, selector, regex) => {
    const nodes = Array.from((root || document).querySelectorAll(selector));
    return nodes.find((n) => regex.test((n.textContent || '').trim()) && !isBadConnectCandidate(n)) || null;
  };
  const findClickableByText = (root, selector, regex) => {
    const el = findByText(root, selector, regex);
    if (!el) return null;
    const clickable = el.closest('button, a, [role="menuitem"], [role="button"]') || el;
    return isBadConnectCandidate(clickable) ? null : clickable;
  };

  // Resolve the profile top card strictly — LinkedIn profile pages now have multiple
  // <section> children inside <main> (About, Experience, "People also viewed", ...).
  // `main section` is too greedy and can pick up sidebar sections that contain
  // "Invite <other person> to connect" buttons. Prefer the first section that has
  // an <h1> (top card) or known top-card class names.
  const resolveTopCard = () => {
    const candidates = [
      '.pv-top-card',
      '.profile-topcard',
      'section.pv-top-card',
      '.pv-top-card-v2-ctas',
      '[data-view-name="profile"]',
      '[data-view-name="profile-top-card"]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Structural: first <section> inside <main> that contains the profile <h1>.
    const main = document.querySelector('main');
    if (main) {
      const sections = Array.from(main.querySelectorAll(':scope > section, :scope > div > section'));
      const withH1 = sections.find((s) => s.querySelector('h1'));
      if (withH1) return withH1;
      if (sections[0]) return sections[0];
    }
    return document.querySelector('main section') || document;
  };
  const topCard = resolveTopCard();

  // Derive the profile owner's name so we can verify matches belong to this profile
  // (otherwise a stray "Invite <someone else> to connect" in a sidebar/"People also
  // viewed" card can get clicked). We compare name tokens, not full strings, because
  // aria-label sometimes includes extras like "on LinkedIn".
  const extractOwnerTokens = () => {
    const h1 = topCard.querySelector('h1') || document.querySelector('main section h1') || document.querySelector('h1');
    let name = (h1 && (h1.textContent || '').trim()) || '';
    if (!name) {
      try {
        const m = location.pathname.match(/\/in\/([^\/?#]+)/i);
        if (m) name = decodeURIComponent(m[1]).replace(/[-_]+/g, ' ');
      } catch {}
    }
    const tokens = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
    return { name, tokens };
  };
  const owner = extractOwnerTokens();
  const ariaNamesOtherPerson = (aria) => {
    // If aria-label mentions a specific person by name, make sure it matches our owner.
    // e.g. "Invite Arnav Gudibande to connect" on a profile whose owner is "Ashutosh Saxena".
    if (!aria) return false;
    const s = aria.toLowerCase();
    // Capture name phrase between "invite" and "to connect", or after "connect with"
    let namePhrase = '';
    let m = s.match(/invite\s+([a-z][a-z\s\-.']+?)\s+to\s+connect/i);
    if (m) namePhrase = m[1];
    if (!namePhrase) {
      m = s.match(/connect\s+with\s+([a-z][a-z\s\-.']+?)(?:\s+on\s+linkedin|$)/i);
      if (m) namePhrase = m[1];
    }
    if (!namePhrase) return false;
    const phraseTokens = namePhrase.split(/\s+/).filter((t) => t.length >= 2);
    if (!phraseTokens.length) return false;
    if (!owner.tokens.length) return false; // can't verify → accept (don't reject)
    // Accept if any aria name token matches any owner token (handles middle names, abbreviations)
    return !phraseTokens.some((t) => owner.tokens.includes(t));
  };

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
    await waitForVisible('main section, .pv-top-card, .profile-topcard, [data-view-name="profile"], section.pv-top-card, .pv-top-card-v2-ctas');

    let target = null;
    // Word-bounded Connect/Invite matcher. Word boundaries already exclude
    // "connection"/"connections" because the trailing "i" is a word character,
    // so \b after "connect" cannot match there.
    const CONNECT_RX_EXACT = /^(connect|invite)$/i;
    const CONNECT_RX_LOOSE = /\b(connect|invite)\b/i;
    // Retry attempts to locate Connect
    for (let attempt = 0; attempt < 8 && !target; attempt++) {
      // 1) Explicit aria-label matches that clearly identify a Connect CTA (not "See N mutual connections")
      const ariaMatches = Array.from(topCard.querySelectorAll('button[aria-label], a[aria-label]')).filter((el) => {
        if (!isVisible(el) || isBadConnectCandidate(el)) return false;
        const a = (el.getAttribute('aria-label') || '').toLowerCase();
        if (!a) return false;
        // Accept things like "Invite Jane to connect", "Connect with Jane"
        if (!(/\b(connect(\s+with)?|invite(?:[^\w]+\w+)*\s+to\s+connect)\b/.test(a) && !/\b(mutual|connections?|message)\b/.test(a))) return false;
        // Reject if the aria-label clearly refers to a DIFFERENT person
        if (ariaNamesOtherPerson(a)) return false;
        return true;
      });
      if (ariaMatches[0]) { target = ariaMatches[0]; break; }

      // 2) Exact-text Connect/Invite buttons (scoped to top card)
      target = findClickableByText(topCard, 'button,[role="button"]', CONNECT_RX_EXACT) ||
               findClickableByText(topCard, 'button,[role="button"]', CONNECT_RX_LOOSE);
      if (target) break;

      // 3) Open the "More" dropdown (Connect often lives there for 2nd/3rd-degree connections).
      // CRITICAL: only search inside a menu that actually opened AFTER we clicked More.
      // Previously a null/invisible menu fell through to `document`, which would then pick up
      // "Invite <other person> to connect" buttons from "People also viewed" sidebars.
      let moreBtn = findClickableByText(topCard, 'button,[role="button"]', /^more$/i) ||
                    findClickableByText(topCard, 'button,[role="button"]', /\bmore\b/i) ||
                    topCard.querySelector('button[aria-label*="More actions" i]') ||
                    topCard.querySelector('button[aria-label^="More" i]') ||
                    topCard.querySelector('button.artdeco-dropdown__trigger[aria-haspopup="menu"]') ||
                    topCard.querySelector('button[aria-expanded][aria-controls]');
      if (moreBtn) {
        const beforeMenus = new Set(Array.from(document.querySelectorAll('div[role="menu"], ul[role="menu"], .artdeco-dropdown__content-inner, .artdeco-dropdown__content')));
        dispatchClick(moreBtn);
        // Poll for a NEW visible menu to appear
        let openedMenu = null;
        for (let i = 0; i < 12 && !openedMenu; i++) {
          await wait(100);
          const nowMenus = Array.from(document.querySelectorAll('div[role="menu"], ul[role="menu"], .artdeco-dropdown__content-inner, .artdeco-dropdown__content'));
          openedMenu = nowMenus.find((m) => isVisible(m) && !beforeMenus.has(m)) || nowMenus.find((m) => isVisible(m));
        }
        if (openedMenu) {
          const items = Array.from(openedMenu.querySelectorAll('div[role="menuitem"], li, button, a'))
            .filter((n) => isVisible(n) && !isBadConnectCandidate(n));
          target = items.find((el) => CONNECT_RX_LOOSE.test((el.textContent || '').trim())) ||
                   items.find((el) => {
                     const a = (el.getAttribute && (el.getAttribute('aria-label') || '')).toLowerCase();
                     return a && CONNECT_RX_LOOSE.test(a) && !ariaNamesOtherPerson(a);
                   }) || null;
        }
        // DO NOT fall back to document-wide search here.
      }

      if (!target) {
        const brute = Array.from(topCard.querySelectorAll('button,[role="menuitem"]'))
          .filter((el) => isVisible(el) && !isBadConnectCandidate(el) && CONNECT_RX_LOOSE.test((el.textContent||'').trim()))[0];
        if (brute) target = brute.closest('button,[role="menuitem"],[role="button"]') || brute;
      }

      // Final safety: if we somehow landed on a target that names a different person
      // via its aria-label, discard it so the next attempt can try again.
      if (target) {
        const aria = (target.getAttribute && (target.getAttribute('aria-label') || '')).toLowerCase();
        if (aria && ariaNamesOtherPerson(aria)) {
          console.log('[HirePilot Extension] Rejecting wrong-person Connect target:', aria);
          target = null;
        }
      }

      if (!target) await wait(700);
    }

    if (!target) {
      // No direct Connect found. Determine if it's truly pending/connected or just hidden.
      const scope = topCard || document;

      // Pending detection: explicit labels/buttons
      const pendingEl = Array.from(scope.querySelectorAll('button,[role="button"],a,span')).find((el) => /\b(pending|invited|withdraw|requested)\b/i.test(textOf(el)));

      // 1st-degree badge detection
      const degreeEl = Array.from(scope.querySelectorAll('span,div,[aria-label]')).find((el) => /\b1st\b/i.test(textOf(el)) || /\b1st\b/i.test(el.getAttribute('aria-label') || ''));

      // Message CTA without any Connect available strongly implies already connected
      const messageEl = (findClickableByText(scope, 'button,[role="button"],a,span', /^message$/i) || findClickableByText(scope, 'button,[role="button"],a,span', /^(message|open message)$/i));

      // Any evidence of a Connect action anywhere in top card or menus?
      // Use word-bounded regex + filter to avoid matching "See N mutual connections".
      const hasAnyConnect = !!(
        findClickableByText(scope, 'button,[role="button"]', /\bconnect\b/i) ||
        Array.from(scope.querySelectorAll('button[aria-label], a[aria-label]'))
          .some((el) => {
            if (isBadConnectCandidate(el)) return false;
            const a = (el.getAttribute('aria-label') || '').toLowerCase();
            return /\bconnect\b/.test(a) && !/\b(mutual|connections?)\b/.test(a);
          })
      );

      try {
        console.log('[HirePilot Extension] Connect not found; evaluating status', {
          hasAnyConnect: !!hasAnyConnect,
          pendingDetected: !!pendingEl,
          firstDegreeBadge: !!degreeEl,
          messageCta: !!messageEl
        });
      } catch {}

      if (pendingEl) {
        try { console.log('[HirePilot Extension] Skip: Pending detected via element:', textOf(pendingEl).slice(0, 120)); } catch {}
        return { skipped: true, reason: 'Pending invitation' };
      }
      if (degreeEl) {
        try { console.log('[HirePilot Extension] Skip: Already connected (1st-degree badge visible)'); } catch {}
        return { skipped: true, reason: 'Already connected (1st)' };
      }
      if (messageEl && !hasAnyConnect) {
        try { console.log('[HirePilot Extension] Skip: Message CTA present and no Connect action available'); } catch {}
        return { skipped: true, reason: 'Already connected (Message only, no Connect)' };
      }

      return { error: 'Connect button not found (no More menu)' };
    }
    try {
      console.log('[HirePilot Extension] Clicking Connect target:', (target.getAttribute('aria-label') || textOf(target) || '').slice(0, 120));
    } catch {}
    dispatchClick(target);
    await wait(800);

    // 3) Ensure we are in the Add-a-note flow
    const findAddNoteButton = () => {
      const dlg = document.querySelector('div[role="dialog"], .artdeco-modal') || document;
      return (
        findClickableByText(dlg, 'button,[role="button"],a,span', /^add a note$/i) ||
        findClickableByText(dlg, 'button,[role="button"],a,span', /add a note/i) ||
        document.querySelector('button[aria-label*="Add a note" i]')
      );
    };

    let addNote = findAddNoteButton();
    if (addNote) { dispatchClick(addNote); await wait(600); }

    // 4) Fill the note (wait adaptively for the textarea to appear)
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
      // If the initial confirmation modal is open, click Add a note again
      addNote = findAddNoteButton();
      if (addNote) { dispatchClick(addNote); await wait(800); }
      // Retry to locate inputs with a short wait loop
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

    // 5) Click Send
    const sendBtn = findClickableByText(modal, 'button,[role="button"],a,span', /^send$/i) ||
                    findClickableByText(modal, 'button,[role="button"],a,span', /send/i) ||
                    modal.querySelector('button[aria-label*="Send" i]') ||
                    modal.querySelector('button.artdeco-button--primary');
    if (!sendBtn) return { error: 'Send button not found' };
    dispatchClick(sendBtn);
    await wait(600);
    return { ok: true };
  } catch (e) {
    return { error: e?.message || 'Failed to connect and send' };
  } finally {
    window.__HP_CONNECT_RUNNING__ = false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[HirePilot Extension] Received message:', msg);
  if (msg.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }

  // Step 1: Auto-scraper entrypoint (content script) — start signal from popup/background/app
  if (msg.action === 'START_SCRAPE') {
    (async () => {
      try {
        const { pageLimit = 1, campaignId = null } = msg || {};
        // Show overlay if autopilot mode is set
        try {
          const st = await chrome.storage.session.get(['hp_autopilot_mode']);
          if (st && st.hp_autopilot_mode) {
            __hp_showOverlay('HirePilot is gathering leads… keep this tab open.');
          }
        } catch {}
        console.debug('[HP Content] START_SCRAPE: initiating loop with', { pageLimit, campaignId });
        console.log('[HirePilot Extension] START_SCRAPE received', { pageLimit, campaignId });
        const result = await runAutoScrapeLoop({ pageLimit, campaignId });
        __hp_hideOverlay();
        sendResponse(result || { ok: true });
      } catch (e) {
        __hp_hideOverlay();
        console.error('[HirePilot Extension] START_SCRAPE failed:', e);
        sendResponse({ error: e?.message || 'Failed to start scrape' });
      }
    })();
    return true; // async
  }

  if (msg.action === 'STOP_SCRAPE') {
    try {
      window.__HP_SCRAPE_STOP__ = true;
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ error: e?.message || 'Failed to stop' });
    }
    return true;
  }
  
  if (msg.action === 'getFullCookie') {
    try {
      // Get full document.cookie
      const fullCookie = document.cookie;
      console.log('[HirePilot Extension] Cookie captured, length:', fullCookie.length);
      sendResponse({ fullCookie });
    } catch (error) {
      console.error('[HirePilot Extension] Cookie capture error:', error);
      sendResponse({ error: error.message });
    }
    return true;  // Keep channel open for async
  }

  if (msg.action === 'scrapeSalesNav') {
    console.log('[HirePilot Extension] Sales Nav scrape requested');
    
    // Check if on Sales Nav search page - prioritize URL-based detection
    const url = window.location.href;
    const isSalesNavSearch = (
      /linkedin\.com\/sales\/search/i.test(url) ||
      /linkedin\.com\/sales\//i.test(url)
    );
    console.log('[HirePilot Extension] URL check:', url);
    console.log('[HirePilot Extension] Is Sales Nav search page?', isSalesNavSearch);
    
    if (isSalesNavSearch) {
      console.log('[HirePilot Extension] ✅ On Sales Nav page, preloading without scroll');
      (async () => {
        try {
          const leads = await preloadLeads();
          sendResponse({ leads, mode: 'sn_preload_single_page' });
        } catch (err) {
          console.error('[HirePilot Extension] Preload scrape error:', err);
          sendResponse({ error: err.message });
        }
      })();
    } else {
      const error = 'Not on Sales Navigator search page. Current URL: ' + url;
      console.warn('[HirePilot Extension] ❌', error);
      sendResponse({ error });
    }
    return true;  // Async response
  }

  if (msg.action === 'scrapeLinkedInSearch') {
    (async () => {
      try {
        const url = window.location.href || '';
        // Accept multiple patterns and fallback to DOM detection
        const urlLooksRight = /linkedin\.com\/search\/results\/(people|all)/i.test(url);
        const domHasResults = !!document.querySelector('div.reusable-search__result-container, li.reusable-search__result-container, ul.reusable-search__entity-results-list');
        if (!(urlLooksRight || domHasResults)) {
          sendResponse({ error: 'Not on LinkedIn People Search results', url });
          return;
        }

        const selector = 'div.reusable-search__result-container, li.reusable-search__result-container, ul.reusable-search__entity-results-list > li';
        const wait = (ms) => new Promise(r=>setTimeout(r, ms));
        let items = document.querySelectorAll(selector);
        if (!items.length) {
          for (let i=0; i<4 && !items.length; i++) {
            window.scrollBy(0, Math.round(window.innerHeight * 0.6));
            await wait(600);
            items = document.querySelectorAll(selector);
          }
        }

        const leads = [];
        const toText = (el) => (el && el.textContent ? el.textContent.trim() : '');
        const absUrl = (href) => {
          if (!href) return '';
          const cleaned = href.split('?')[0];
          if (/^https?:\/\//i.test(cleaned)) return cleaned;
          if (cleaned.startsWith('/')) return `https://www.linkedin.com${cleaned}`;
          return `https://www.linkedin.com/${cleaned}`;
        };
        items.forEach((el) => {
          const linkEl = el.querySelector('a[href*="/in/"], a.app-aware-link[href*="/in/"]');
          const nameEl = el.querySelector('span.entity-result__title-text a span[aria-hidden="true"], a.app-aware-link span[aria-hidden="true"], span[dir="ltr"]');
          const titleEl = el.querySelector('.entity-result__primary-subtitle, .entity-result__summary');
          const companyEl = el.querySelector('.entity-result__secondary-subtitle');
          const avatarEl = el.querySelector('img');
          const profileUrl = absUrl(linkEl && linkEl.getAttribute('href'));
          const name = toText(nameEl);
          const title = toText(titleEl);
          const company = toText(companyEl);
          const avatarUrl = avatarEl && avatarEl.getAttribute('src') ? avatarEl.getAttribute('src') : '';
          if (profileUrl && name && !/LinkedIn Member/i.test(name)) {
            leads.push({ name, title, company, profileUrl, avatarUrl });
          }
        });
        if (!leads.length) {
          sendResponse({ error: 'No leads found on this page', url });
          return;
        }

        chrome.runtime.sendMessage({ action: 'bulkAddLeads', leads }, (resp) => {
          sendResponse({ leads, result: resp, mode: 'li_search' });
        });
      } catch (e) {
        sendResponse({ error: e.message || 'Failed to scrape LinkedIn search' });
      }
    })();
    return true;
  }

  if (msg.action === 'connectAndSend') {
    (async () => {
      const result = await hpConnectAndSendDOM(msg.message || '');
      sendResponse(result);
    })();
    return true;
  }

  if (msg.action === 'scrapeSingleProfile') {
    (async () => {
      try {
        const url = window.location.href;
        const isLiProfile = /linkedin\.com\/in\//i.test(url);
        const isSalesNavProfile = /linkedin\.com\/sales\/(people|profile)/i.test(url) || !!document.querySelector('.profile-topcard, .profile-topcard__content, [data-anonymize="person-name"]');
        if (!(isLiProfile || isSalesNavProfile)) {
          sendResponse({ error: 'Not on a LinkedIn or Sales Navigator profile page' });
          return;
        }

        const waitFor = (pred, timeoutMs = 12000) => new Promise((resolve) => {
          const start = Date.now();
          if (pred()) return resolve(true);
          const obs = new MutationObserver(() => {
            if (pred()) { obs.disconnect(); resolve(true); }
            else if (Date.now() - start > timeoutMs) { obs.disconnect(); resolve(false); }
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
          setTimeout(()=>{ obs.disconnect(); resolve(false); }, timeoutMs + 50);
        });

        // ── Selector-based approach (legacy, kept as fallback) ──
        const nameSelectorsLegacy = isSalesNavProfile ? [
          '.profile-topcard-person-entity__name',
          'h1.profile-topcard__title',
          '.profile-topcard__content h1',
          'dd[data-anonymize="person-name"]',
          'h1[data-anonymize="person-name"]',
          '.artdeco-entity-lockup__title'
        ] : [
          '.text-heading-xlarge',
          'h1[data-anonymize="person-name"]',
          'h1[dir="auto"]',
          '.pv-top-card h1',
          '.pv-text-details__left-panel h1',
          'section.artdeco-card h1',
          'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words'
        ];

        // ── NEW: Structural approach for LinkedIn's obfuscated DOM (2025+) ──
        // LinkedIn now uses hashed CSS class names. We use structural selectors:
        // - Profile name is in an h1 or h2 within the first <section> in <main>
        // - Paragraphs in the top section contain headline, company, location
        const structuralNameSelectors = ['main section h1', 'main section h2'];
        const allNameSelectors = [...structuralNameSelectors, ...nameSelectorsLegacy];

        await waitFor(() => allNameSelectors.some(s => {
          const el = document.querySelector(s);
          return el && el.textContent && el.textContent.trim().length > 1;
        }), 12000);

        const tryText = (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
          }
          return '';
        };

        const tryAttr = (selectors, attr) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.getAttribute(attr)) return el.getAttribute(attr);
          }
          return '';
        };

        // JSON-LD first (LinkedIn used to embed Person schema, may return)
        const getJSONLD = () => {
          try {
            const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const n of nodes) {
              try {
                const json = JSON.parse(n.textContent || '{}');
                if (!json) continue;
                if (json['@type'] === 'Person') return json;
                if (json.mainEntity && json.mainEntity['@type'] === 'Person') return json.mainEntity;
                if (Array.isArray(json['@graph'])) {
                  const p = json['@graph'].find(g => g['@type'] === 'Person');
                  if (p) return p;
                }
              } catch {}
            }
          } catch {}
          return null;
        };

        const ld = getJSONLD();

        // ── Try structural extraction first (works with obfuscated classes) ──
        let name = ld?.name || '';
        let headline = '';
        let company = '';
        let avatar = ld?.image?.contentUrl || ld?.image || '';

        if (!name) {
          // Try legacy selectors first
          name = tryText(nameSelectorsLegacy);
        }

        if (!name) {
          // Structural: first h1 or h2 in the top section of main
          const topSection = document.querySelector('main section');
          if (topSection) {
            const nameEl = topSection.querySelector('h1') || topSection.querySelector('h2');
            const candidateName = (nameEl?.textContent || '').trim();
            // Validate it's a real name (not "0 notifications" etc)
            if (candidateName && candidateName.length > 1 && !/^\d/.test(candidateName) && !/notification/i.test(candidateName)) {
              name = candidateName;
            }

            // Extract headline, company, location from <p> tags in the section
            const paragraphs = Array.from(topSection.querySelectorAll('p'))
              .map(p => (p.textContent || '').trim())
              .filter(t => t.length > 0);

            for (const text of paragraphs) {
              // Skip pronouns and connection indicators
              if (/^(He\/Him|She\/Her|They\/Them|·\s*\d)/i.test(text)) continue;
              if (/^\d[\d,]*\s+followers?$/i.test(text)) continue;
              if (text === '·' || text === 'Contact info') continue;

              if (!headline) {
                headline = text;
              } else if (!company && text.includes('·')) {
                company = text.split('·')[0].trim();
              } else if (!company) {
                company = text;
              }
            }

            // Avatar from top section
            if (!avatar) {
              const img = topSection.querySelector('img[src*="licdn"], img[src*="profile"]');
              if (img) avatar = img.getAttribute('src') || '';
            }
          }
        }

        // ── Fallback to legacy selectors if structural didn't work ──
        if (!headline) {
          headline = isSalesNavProfile ? tryText([
            '.profile-topcard__summary-position-title',
            'dd[data-anonymize="headline"]',
            '.profile-topcard__current-positions .t-14'
          ]) : tryText([
            '.text-body-medium.break-words',
            'div.ph5 .text-body-medium',
            '.pv-text-details__left-panel .text-body-medium'
          ]);
        }

        if (!company) {
          company = isSalesNavProfile ? tryText([
            'a[data-anonymize="company-name"]',
            '.profile-topcard__current-positions a',
            'dd[data-anonymize="company-name"]'
          ]) : tryText([
            '[data-anonymize="company-name"]',
            'button[aria-label*="Current company"] span',
            '.pv-entity__secondary-title',
            '.pv-entity__company-summary-info h2',
            '.pv-text-details__left-panel .inline-show-more-text',
            '.experience-item:first-child .t-bold span'
          ]);
        }

        if (!avatar) {
          avatar = isSalesNavProfile ? tryAttr([
            'img.profile-topcard__profile-image',
            'img.presence-entity__image',
            '.artdeco-entity-image img'
          ], 'src') : tryAttr([
            '.pv-top-card-profile-picture__image',
            '.pv-top-card--photo img',
            '.pv-top-card__photo img',
            'img.evi-image[alt*="photo" i]',
            'img.pv-top-card-profile-picture__image'
          ], 'src');
        }

        // If company not found, attempt from headline pattern
        let companyFinal = company;
        if (!companyFinal && headline && /\bat\b/i.test(headline)) {
          const m = headline.match(/\bat\s+([^|•,]+)\b/i);
          if (m) companyFinal = m[1].trim();
        }

        console.log('[HirePilot Extension] Scraped profile:', { name, headline, company: companyFinal, avatar: !!avatar });

        const profile = {
          name: name || '',
          title: headline || '',
          company: companyFinal || '',
          profileUrl: url,
          avatarUrl: avatar || ''
        };

        sendResponse({ profile });
      } catch (err) {
        console.error('[HirePilot Extension] Single profile scrape error:', err);
        sendResponse({ error: err.message || 'Failed to scrape profile' });
      }
    })();
    return true;
  }

  if (msg.action === 'prefillLinkedInMessage') {
    try {
      const { text } = msg;
      // Try to find LinkedIn message compose textarea
      const candidates = [
        'textarea',
        'div[contenteditable="true"]'
      ];
      let filled = false;
      for (const sel of candidates) {
        const box = document.querySelector(sel);
        if (box) {
          if (box.tagName.toLowerCase() === 'textarea') {
            box.value = text;
            box.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            box.textContent = text;
            box.dispatchEvent(new Event('input', { bubbles: true }));
          }
          filled = true;
          break;
        }
      }
      if (!filled) return sendResponse({ error: 'Could not find LinkedIn message box' });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ error: e.message || 'Failed to prefill' });
    }
    return true;
  }
});

// Auto-trigger connect when hirepilot_connect=1 in URL
if (window.top === window) {
  (async () => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('hirepilot_connect') === '1') {
        // Adaptive wait for profile readiness
        const waitFor = (pred, timeoutMs = 15000) => new Promise((resolve) => {
          const start = Date.now();
          if (pred()) return resolve(true);
          const obs = new MutationObserver(() => {
            if (pred()) { obs.disconnect(); resolve(true); }
            else if (Date.now() - start > timeoutMs) { obs.disconnect(); resolve(false); }
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
          setTimeout(() => { obs.disconnect(); resolve(false); }, timeoutMs + 50);
        });

        // Prefill source: hp_msg OR hp_tpl (future: resolve tpl via API/storage)
        let message = params.get('hp_msg') || '';
        // TODO: if hp_tpl provided, fetch template by ID from storage/API

        // Wait until a Connect/Invite is actionable
        const ready = await waitFor(() => {
          return !!document.querySelector('button,[role="button"],a');
        }, 15000);
        if (!ready) {
          console.warn('[HirePilot Extension] Profile not ready for connect');
        }

        // If background dispatched a page event, also listen here (defensive)
        window.addEventListener('hirepilot:auto-connect-start', async (e) => {
          const m = (e && e.detail && e.detail.message) || message || '';
          const resp = await hpConnectAndSendDOM(m);
          console.log('[HirePilot Extension] (event) connect result:', resp);
        }, { once: true });

        // Proactively trigger connect entirely in content (no background dependency)
        const resp = await hpConnectAndSendDOM(message);
        console.log('[HirePilot Extension] (auto) connect result:', resp);
      }
    } catch (e) {
      console.warn('[HirePilot Extension] Auto-connect error:', e?.message);
    }
  })();
}

// Function to scrape leads from Sales Nav page
async function scrapeLeads() {
  console.log('[HirePilot Extension] Starting scrapeLeads function');
  
  // Try multiple possible selectors for search results
  const possibleSelectors = [
    '.search-results__result-list',
    '[data-test-id="search-results"]',
    '.search-results-container',
    '.search-results',
    '.reusable-search-results-list',
    '.entity-result',
    '.artdeco-list',
    'main .list-style-none',
    '[data-view-name="search-results"]'
  ];
  
  let resultsContainer = null;
  for (const selector of possibleSelectors) {
    console.log('[HirePilot Extension] Trying selector:', selector);
    try {
      await waitForElement(selector, 3000);
      resultsContainer = document.querySelector(selector);
      if (resultsContainer) {
        console.log('[HirePilot Extension] Found results container with:', selector);
        break;
      }
    } catch (e) {
      console.log('[HirePilot Extension] Selector failed:', selector, e.message);
    }
  }
  
  // Check how many results we have before scrolling
  const initialResults = document.querySelectorAll('.artdeco-entity-lockup') || document.querySelectorAll('main li');
  console.log('[HirePilot Extension] Results found BEFORE scrolling:', initialResults.length);

  // Scroll to load all results on the page using shared autoScrollPage for robustness
  console.log('[HirePilot Extension] autoScrollPage to load all results...');
  await autoScrollPage({ maxRetries: 3 });

  // Check again after scrolling
  const finalResults = document.querySelectorAll('.artdeco-entity-lockup') || document.querySelectorAll('main li');
  console.log('[HirePilot Extension] Results found AFTER scrolling:', finalResults.length);

  // Try multiple possible selectors for individual result items (with or without container)
  const resultSelectors = [
    '.search-result__info',
    '[data-chameleon-result-urn]',
    '.result-card',
    '.search-result',
    '.entity-result',
    '.reusable-search-result',
    '.artdeco-entity-lockup',
    'li[data-row]',
    '.list-style-none > li',
    '[data-view-name="search-result"]'
  ];
  
  let results = [];
  
  // If we found a container, search within it first
  if (resultsContainer) {
    for (const selector of resultSelectors) {
      results = resultsContainer.querySelectorAll(selector);
      if (results.length > 0) {
        console.log('[HirePilot Extension] Found', results.length, 'results in container with selector:', selector);
        break;
      }
    }
  }
  
  // If no results in container or no container found, try searching the entire document
  if (results.length === 0) {
    console.log('[HirePilot Extension] No results in container, searching entire document');
    for (const selector of resultSelectors) {
      results = document.querySelectorAll(selector);
      if (results.length > 0) {
        console.log('[HirePilot Extension] Found', results.length, 'results with selector:', selector);
        break;
      }
    }
  }
  
  if (results.length === 0) {
    throw new Error('No search results found on this page. Make sure you have performed a search and results are visible.');
  }

  const leads = [];
  console.log('[HirePilot Extension] Processing', results.length, 'total results found');

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log('[HirePilot Extension] ====== Processing result', i + 1, 'of', results.length, '======');
    console.log('[HirePilot Extension] Result element:', result);
    
    // Debug: Show all text content in this result
    const allTextElements = result.querySelectorAll('*');
    const textContents = Array.from(allTextElements)
      .filter(el => el.children.length === 0 && el.textContent.trim())
      .map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}: "${el.textContent.trim()}"`)
      .slice(0, 15); // Show first 15 text elements for better debugging
    console.log('[HirePilot Extension] All text elements found:', textContents);
    
    // Special debug: Look for potential location patterns
    const potentialLocations = Array.from(allTextElements)
      .filter(el => el.children.length === 0 && el.textContent.trim())
      .map(el => el.textContent.trim())
      .filter(text => 
        text.includes('Area') || 
        text.includes('United States') || 
        text.includes('California') || 
        text.includes('New York') || 
        text.includes('Texas') || 
        text.includes(', ') || 
        text.match(/\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/) // City, State pattern
      );
    console.log('[HirePilot Extension] Potential location texts found:', potentialLocations);
    
    // Try multiple selectors for name
    const nameSelectors = [
      '.actor-name',
      '.result-lockup__name',
      '[data-chameleon-result-urn] .name',
      '.name-link',
      'a[data-control-name="search_srp_result"] span[aria-hidden="true"]',
      '.entity-result__title-text a span[aria-hidden="true"]',
      '.artdeco-entity-lockup__title a span',
      '.t-16 .t-black .t-bold',
      '.search-result__result-link span[aria-hidden="true"]',
      'h3 a span[aria-hidden="true"]',
      '.entity-result__title-line a span'
    ];
    
    let nameEl = null;
    for (const selector of nameSelectors) {
      nameEl = result.querySelector(selector);
      if (nameEl && nameEl.textContent.trim()) {
        console.log('[HirePilot Extension] Found name with selector:', selector);
        break;
      }
    }
    console.log('[HirePilot Extension] Name element found:', !!nameEl, nameEl?.textContent?.trim());
    
    // Try multiple selectors for title/company
    const titleSelectors = [
      '.result-lockup__position-company',
      '.people-badge',
      '.result-context',
      '.subline-level-1',
      '.entity-result__primary-subtitle',
      '.entity-result__secondary-subtitle',
      '.artdeco-entity-lockup__subtitle',
      '.t-14 .t-black--light',
      '.search-result__details .t-14',
      '.entity-result__summary'
    ];

    // Try multiple selectors for location (Sales Navigator specific)
    const locationSelectors = [
      // Sales Navigator specific selectors - most likely to have location
      '.result-lockup__highlight-keyword + .text-body-small',
      '.result-lockup__misc-item:last-child',
      '.search-result__details .text-body-small:last-child',
      '.artdeco-entity-lockup__subtitle:last-child',
      '.people-badge + .text-body-small',
      '.result-context .text-body-small:last-child',
      // Try looking for elements after company/title
      '.result-lockup__name + * .text-body-small',
      '.result-lockup__name ~ * .text-body-small',
      // General location selectors
      '.subline-level-2',
      '.search-result__result-metadata .t-12:last-child', 
      '.actor-meta:last-child',
      '.entity-result__summary .t-12:last-child',
      '.search-result__details .t-12:last-child',
      '.entity-result__summary .entity-result__summary-location',
      '.result-context .t-12:last-child',
      // Broader selectors
      '.text-body-small',
      '.t-12'
    ];
    
    let titleEl = null;
    for (const selector of titleSelectors) {
      titleEl = result.querySelector(selector);
      if (titleEl && titleEl.textContent.trim()) {
        console.log('[HirePilot Extension] Found title with selector:', selector);
        break;
      }
    }
    console.log('[HirePilot Extension] Title element found:', !!titleEl, titleEl?.textContent?.trim());

    // Extract location (skip if element is already used for title or name)
    let locationEl = null;
    let bestLocationText = '';
    
    // First, try specific selectors
    for (const selector of locationSelectors) {
      const candidateEls = result.querySelectorAll(selector);
      for (const candidateEl of candidateEls) {
        if (!candidateEl || !candidateEl.textContent.trim()) continue;
        if (candidateEl === titleEl || candidateEl === nameEl) continue;
        
        const text = candidateEl.textContent.trim();
        console.log('[HirePilot Extension] Checking location candidate:', text, 'with selector:', selector);
        
        // Smart location detection - look for location patterns
        const isLocation = (
          text.includes('Area') || 
          text.includes('United States') || 
          text.includes('USA') ||
          text.includes('California') || 
          text.includes('New York') || 
          text.includes('Texas') || 
          text.includes('Florida') ||
          text.includes('Illinois') ||
          text.includes('Washington') ||
          text.match(/\b[A-Z][a-z]+,\s*[A-Z][A-Za-z\s]+\b/) || // City, State pattern
          text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+Area\b/) || // San Francisco Area
          text.match(/\b[A-Z][a-z]+,\s*[A-Z]{2}\b/) || // City, CA
          (text.includes(',') && text.length > 5 && text.length < 50) // General comma-separated location
        );
        
        // Exclude things that are clearly not locations
        const isNotLocation = (
          text.includes('@') || // emails
          text.includes('http') || // urls
          text.includes('VP') || text.includes('Director') || text.includes('Manager') || // titles
          text.includes('President') || text.includes('CEO') || text.includes('CTO') ||
          text.includes('Sales') || text.includes('Marketing') || text.includes('Engineer') ||
          text.includes('at ') || // "at Company" pattern
          text.length < 3 || text.length > 60 // too short or too long
        );
        
        if (isLocation && !isNotLocation) {
          console.log('[HirePilot Extension] ✅ Found valid location:', text, 'with selector:', selector);
          locationEl = candidateEl;
          bestLocationText = text;
          break;
        } else {
          console.log('[HirePilot Extension] ❌ Rejected location candidate:', text, 'isLocation:', isLocation, 'isNotLocation:', isNotLocation);
        }
      }
      if (locationEl) break;
    }
    
    // If no location found with specific selectors, use pattern matching on all text
    if (!bestLocationText && potentialLocations.length > 0) {
      console.log('[HirePilot Extension] No location found with selectors, trying pattern matching...');
      for (const text of potentialLocations) {
        const isNotLocation = (
          text.includes('@') || text.includes('http') || 
          text.includes('VP') || text.includes('Director') || text.includes('Manager') ||
          text.includes('President') || text.includes('CEO') || text.includes('at ')
        );
        if (!isNotLocation) {
          bestLocationText = text;
          console.log('[HirePilot Extension] ✅ Found location via pattern matching:', text);
          break;
        }
      }
    }
    console.log('[HirePilot Extension] Location element found:', !!locationEl, locationEl?.textContent?.trim());
    
    // Try to find profile link
    const linkSelectors = [
      'a.search-result__result-link',
      'a[data-control-name="search_srp_result"]',
      '.result-lockup__name a',
      'a.name-link',
      '.entity-result__title-text a',
      '.artdeco-entity-lockup__title a',
      'h3 a',
      '.entity-result__title-line a',
      'a[href*="/in/"]'
    ];
    
    let profileLink = null;
    for (const selector of linkSelectors) {
      const linkEl = result.querySelector(selector);
      if (linkEl && linkEl.href) {
        profileLink = linkEl.href;
        break;
      }
    }
    
    const name = nameEl?.textContent.trim() || '';
    const titleText = titleEl?.textContent.trim() || '';
    const locationText = bestLocationText || locationEl?.textContent.trim() || '';

    // Try to find company in separate elements if title doesn't contain it
    const companySelectors = [
      '.entity-result__secondary-subtitle .text-body-small',
      '.entity-result__summary .text-body-small',
      '.search-result__details .text-body-small', 
      '.result-lockup__position-company .text-body-small',
      // Sometimes company is in a link
      'a[href*="/company/"]',
      '.entity-result__secondary-subtitle a',
      '.search-result__details a[href*="/company/"]'
    ];
    
    // Parse title and company from the text
    let title = '';
    let company = '';
    let location = '';
    
    if (titleText) {
      console.log('[HirePilot Extension] Raw title text for parsing:', JSON.stringify(titleText));
      // Common patterns: "Title at Company" or "Title\nCompany"
      if (titleText.includes(' at ')) {
        const parts = titleText.split(' at ');
        title = parts[0].trim();
        company = parts[1].trim();
        console.log('[HirePilot Extension] Parsed using "at" pattern - Title:', title, 'Company:', company);
      } else if (titleText.includes('\n')) {
        const parts = titleText.split('\n');
        title = parts[0].trim();
        company = parts[1]?.trim() || '';
        console.log('[HirePilot Extension] Parsed using newline pattern - Title:', title, 'Company:', company);
      } else {
        title = titleText;
        console.log('[HirePilot Extension] No company pattern found, using full text as title:', title);
      }
    }

    if (locationText) {
      location = locationText;
      console.log('[HirePilot Extension] 🌍 Final location text:', location);
    } else {
      console.log('[HirePilot Extension] ❌ No location text found');
    }

    // If no company found in title parsing, try dedicated company selectors
    if (!company) {
      for (const selector of companySelectors) {
        const companyEl = result.querySelector(selector);
        if (companyEl && companyEl.textContent.trim() && companyEl !== titleEl && companyEl !== locationEl) {
          company = companyEl.textContent.trim();
          console.log('[HirePilot Extension] Found company with dedicated selector:', selector, 'Company:', company);
          break;
        }
      }
    }

    console.log('[HirePilot Extension] Extracted data for result', i + 1, ':', {
      name,
      title, 
      company,
      location,
      profileUrl: profileLink
    });
    
    if (name) {  // Only add if we have a name
      const lead = {
        name,
        title,
        company,
        location,
        profileUrl: profileLink
      };
      
      console.log('[HirePilot Extension] ✅ ADDING lead:', lead);
      leads.push(lead);
    } else {
      console.log('[HirePilot Extension] ❌ SKIPPING result', i + 1, '- no name found');
    }
  }

  console.log('[HirePilot Extension] SUMMARY:');
  console.log('- Total results found on page:', results.length);
  console.log('- Valid leads extracted:', leads.length);
  console.log('- Leads to send to HirePilot:', leads);
  
  if (leads.length === 0) {
    throw new Error('No leads found to scrape. Make sure there are search results visible.');
  }

  // Send leads to background script for API call (avoids CORS issues)
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'bulkAddLeads', leads },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to communicate with background script: ' + chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          console.log('[HirePilot Extension] Background script response:', response);
          resolve(leads);
        }
      }
    );
  });
}

// Helper to wait for element
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = 100;
    let elapsed = 0;
    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      elapsed += interval;
      if (elapsed >= timeout) return reject(new Error(`Timeout waiting for ${selector}`));
      setTimeout(check, interval);
    };
    check();
  });
}

// Helper to scroll and load all results - mimics manual user scrolling
async function scrollToLoadAllResults() {
  console.log('[HirePilot Extension] 🚀 Starting aggressive scroll to load ALL results...');
  
  const initialCount = document.querySelectorAll('.artdeco-entity-lockup').length;
  console.log(`[HirePilot Extension] Starting with ${initialCount} visible results`);
  
  // Strategy: Gradual scroll down like a user would do
  const scrollStep = 400; // pixels to scroll each time (increased from 300)
  const maxScrollAttempts = 100; // Maximum scroll attempts (increased from 50)
  let scrollPosition = 0;
  let stableCount = 0; // Count how many times result count stayed the same
  let lastResultCount = initialCount;
  
  for (let attempt = 1; attempt <= maxScrollAttempts; attempt++) {
    console.log(`[HirePilot Extension] 📍 Scroll attempt ${attempt}/${maxScrollAttempts}`);
    
    // Gradual scroll down (like user scrolling)
    scrollPosition += scrollStep;
    window.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
    
    // Wait for content to load after scrolling (increased from 1500ms to 2500ms)
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Check current result count
    const currentCount = document.querySelectorAll('.artdeco-entity-lockup').length;
    console.log(`[HirePilot Extension] After scroll ${attempt}: ${currentCount} results visible`);
    
    // If no new results loaded, increment stable counter
    if (currentCount === lastResultCount) {
      stableCount++;
      console.log(`[HirePilot Extension] No new results (stable count: ${stableCount})`);
    } else {
      console.log(`[HirePilot Extension] ✅ New results loaded! ${lastResultCount} -> ${currentCount}`);
      stableCount = 0; // Reset stable counter
      lastResultCount = currentCount;
    }
    
    // If results haven't changed for 6 consecutive attempts, try final push (was 3, now 6)
    if (stableCount >= 6) {
      console.log('[HirePilot Extension] 🏁 No new results for 6 attempts, doing final scroll to bottom...');
      
      // Final aggressive scroll to absolute bottom
      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      
      window.scrollTo({
        top: maxScroll,
        behavior: 'smooth'
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for final load
      
      const finalCount = document.querySelectorAll('.artdeco-entity-lockup').length;
      console.log(`[HirePilot Extension] After final scroll: ${finalCount} results`);
      
      if (finalCount > lastResultCount) {
        console.log(`[HirePilot Extension] ✅ Final scroll loaded more results!`);
        lastResultCount = finalCount;
      }
      
      break; // Exit the loop
    }
    
    // If we've reached the bottom of the page, break
    if (scrollPosition >= document.body.scrollHeight - window.innerHeight) {
      console.log('[HirePilot Extension] 🏁 Reached bottom of page');
      break;
    }
  }
  
  // Scroll back to top to start processing from beginning
  console.log('[HirePilot Extension] 🔝 Scrolling back to top for processing...');
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const finalResultCount = document.querySelectorAll('.artdeco-entity-lockup').length;
  console.log(`[HirePilot Extension] ✅ SCROLL COMPLETE: ${initialCount} -> ${finalResultCount} results loaded`);
  
  return finalResultCount;
}

// ===== New modular Auto-Scraper functions (Step 1) =====

// Random helpers
const __hp_randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const __hp_wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Detects a resilient set of selectors for result items
function __hp_pickResultSelectors() {
  const containerCandidates = [
    'ul.reusable-search__entity-result-list',
    'ul.search-results__result-list',
    'div.search-results__content',
    'main ul',       // Structural fallback: first <ul> in <main>
    'main ol',       // Structural fallback: first <ol> in <main>
    'main',
    'div.artdeco-card',
  ];
  const itemCandidates = [
    'li.reusable-search__result-container',
    'div.reusable-search__result-container',
    'ul.reusable-search__entity-result-list > li',
    'li.entity-result',
    'div.entity-result__item',
    'div.result-lockup',
    '.artdeco-entity-lockup',
    '.artdeco-entity-lockup--size-4',
    '[data-view-name="search-result"]',
    '[data-anonymize="entity-result"]',
    'main ul > li',  // Structural fallback for obfuscated DOM
    'main ol > li',  // Structural fallback for obfuscated DOM
  ];
  let container = null;
  for (const c of containerCandidates) {
    const el = document.querySelector(c);
    if (el) { container = el; break; }
  }
  return { container, itemCandidates };
}

// Find the best-matching list of result items by scanning multiple selectors
function __hp_findResultItems() {
  const { container, itemCandidates } = __hp_pickResultSelectors();
  const scope = container || document;
  let best = [];
  let bestSel = '';
  const counts = {};
  for (const sel of itemCandidates) {
    try {
      const list = Array.from(scope.querySelectorAll(sel));
      counts[sel] = list.length;
      if (list.length > best.length) { best = list; bestSel = sel; }
    } catch {}
  }
  try { console.log('[HP-CS] Item selector counts:', counts, 'chosen=', bestSel, 'count=', best.length); } catch {}
  return best.length ? best : Array.from(document.querySelectorAll('li, .entity-result__item, .reusable-search__result-container, .artdeco-entity-lockup, .artdeco-entity-lockup--size-4'));
}

// Checks if a global/loading spinner is present
function __hp_isLoading() {
  const spinners = [
    '.artdeco-loader',
    'div[role="progressbar"]',
    '[data-test-spinner]',
    '.search-marvel-srp__loading',
  ];
  return spinners.some((s) => !!document.querySelector(s));
}

// Checks if the page indicates there are no more results
function __hp_noMoreResultsVisible() {
  const texts = [
    'No more results',
    'No results found',
    'Try adjusting your filters',
  ];
  const nodes = Array.from(document.querySelectorAll('div,span,p,h2,h3')); 
  return nodes.some((n) => texts.some((t) => (n.textContent || '').trim().toLowerCase().includes(t.toLowerCase())));
}

// Auto-scroll the page until results finish lazy-loading
async function autoScrollPage(options = {}) {
  const { maxRetries = 3 } = options;
  console.log('[HP-CS] Auto-scroll starting');
  return new Promise((resolve) => {
    const maxTimeMs = 20000 + (maxRetries * 3000);
    const start = Date.now();

    const hasLoader = () => !!document.querySelector('.artdeco-loader, .search-reusables__loading-spinner, .reusable-search__entity-result-list--loading, [role="progressbar"]');

    const resultsContainer = document.querySelector('ul.reusable-search__entity-result-list, .search-results__result-list, .reusable-search-results-list, .artdeco-list, main');
    if (!resultsContainer) {
      console.warn('[HP-CS] No results container found');
    }

    let lastHeight = document.documentElement.scrollHeight;
    let stable = 0;

    const onTick = () => {
      window.scrollBy(0, 400 + __hp_randBetween(100, 300));
      const h = document.documentElement.scrollHeight;
      if (h > lastHeight) { lastHeight = h; stable = 0; }
      else if (!hasLoader()) { stable += 1; }

      if (stable >= 3 || (Date.now() - start) > maxTimeMs) {
        clearInterval(tick);
        if (obs) try { obs.disconnect(); } catch {}
        console.log('[HP-CS] Scroll complete; height:', h, 'stable checks:', stable);
        resolve();
      }
    };

    // IntersectionObserver to kick lazy loads as last item appears
    let obs = null;
    try {
      obs = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          window.scrollBy(0, Math.round(window.innerHeight * 0.8));
          stable = 0; // reset to allow more loads
          // Re-observe new last child when list grows
          const lc = resultsContainer && resultsContainer.lastElementChild;
          if (lc) { obs.unobserve(e.target); obs.observe(lc); }
        }
      }, { threshold: 0.1 });
      const lastChild = resultsContainer && resultsContainer.lastElementChild;
      if (lastChild) obs.observe(lastChild);
    } catch {}

    const tick = setInterval(onTick, 300 + __hp_randBetween(0, 300));
  });
}

function startNavigationMonitor(pageLimit, onPageChange) {
  let lastPage = 0;
  const getPageFromUrl = () => {
    try { const u = new URL(location.href); return Number(u.searchParams.get('page') || '1') || 1; } catch { return 1; }
  };
  const interval = setInterval(() => {
    const p = getPageFromUrl();
    if (p !== lastPage) {
      if (p > lastPage) console.debug(`[HP-CS] Detected navigation to page ${p}`);
      lastPage = p;
      onPageChange?.(p);
      if (p >= pageLimit) { clearInterval(interval); }
    }
  }, 1000 + __hp_randBetween(0, 500));
  return () => clearInterval(interval);
}

// Extract visible leads from the DOM using resilient selectors
async function scrapeResults() {
  const items = __hp_findResultItems();
  console.log('[HP-CS] Found result items:', items.length);

  const toText = (el) => (el && el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '');
  const abs = (href) => {
    if (!href) return '';
    const cleaned = (href.split('#')[0] || '').split('?')[0];
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (cleaned.startsWith('/')) return `https://www.linkedin.com${cleaned}`;
    return `https://www.linkedin.com/${cleaned}`;
  };

  const leads = [];

  const nameSelectors = [
    '.entity-result__title-text span[dir="ltr"] > span[aria-hidden="true"]',
    '.artdeco-entity-lockup__title a span',
    '[data-testid="search-result-name"]',
    '[data-anonymize="person-name"]',
    '.result-lockup__name',
    'a.app-aware-link span[aria-hidden="true"]',
    'a[href*="/in/"] span',  // Structural fallback for obfuscated DOM
  ];
  const titleSelectors = [
    '.entity-result__primary-subtitle',
    '.artdeco-entity-lockup__subtitle',
    '[data-testid="search-result-headline"]',
    '[data-anonymize="headline"]',
    '.result-lockup__highlight',
  ];
  const companySelectors = [
    '.entity-result__secondary-subtitle',
    '.artdeco-entity-lockup__caption',
    '[data-testid="search-result-company-name"]',
    '[data-anonymize="company-name"]',
    '.result-lockup__misc',
    'a[href*="/company/"]',
  ];
  const linkSelectors = [
    '.entity-result__title-text a[href]',
    '.artdeco-entity-lockup__link',
    'a.app-aware-link[href*="/in/"]',
    'a[href*="/in/"]',
    'a.app-aware-link[href*="/sales/people/"]',
    'a[href*="/sales/people/"]',
    'a[href*="/sales/lead/"]',
    'a.result-lockup__name',
  ];

  const pick = (root, sels) => {
    for (const s of sels) { const el = root.querySelector(s); const t = toText(el); if (t) return t; }
    return '';
  };
  const pickHref = (root, sels) => {
    for (const s of sels) { const el = root.querySelector(s); const href = el && (el.getAttribute('href') || el.href); if (href) return abs(href); }
    return '';
  };

  for (const el of items) {
    try {
      let name = pick(el, nameSelectors);
      if (!name) {
        const a = el.querySelector('a[href*="/in/"]') || el.querySelector('a.app-aware-link');
        if (a && a.textContent) name = a.textContent.trim();
      }
      // Clean noisy tags from names
      name = (name || '')
        .replace(/\bis reachable\b/gi, '')
        .replace(/\bwas last active.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      const title = pick(el, titleSelectors);
      let company = pick(el, companySelectors);
      if (!company && /\bat\b/i.test(title)) { const m = title.match(/\bat\s+([^|•,]+)\b/i); if (m) company = m[1].trim(); }
      const profileUrl = pickHref(el, linkSelectors);
      if (name && profileUrl) { leads.push({ name, title, company, profileLink: profileUrl }); }
    } catch (e) { console.warn('[HirePilot Extension] scrapeResults item error:', e?.message); }
  }

  // Fallback: scan anchors if nothing matched
  if (!leads.length) {
    const anchorSel = 'a[href*="/in/"], a[href*="/sales/people/"], a[href*="/sales/lead/"]';
    const anchors = Array.from(document.querySelectorAll(anchorSel));
    const seen = new Set();
    const getNameFrom = (a) => {
      const aria = (a.getAttribute('aria-label') || '').trim();
      if (aria) return aria;
      const titleAttr = (a.getAttribute('title') || '').trim();
      if (titleAttr) return titleAttr;
      const text = (a.textContent || '').trim();
      if (text) return text;
      const parent = a.closest('.entity-result__title-text, .artdeco-entity-lockup__title');
      if (parent && parent.textContent) return parent.textContent.trim();
      return '';
    };
    for (const a of anchors) {
      const href = abs(a.getAttribute('href') || a.href);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      const name = getNameFrom(a).slice(0, 120);
      if (name) {
        // Try to infer title/company nearby
        let title = '';
        let company = '';
        const root = a.closest('.entity-result__item, .reusable-search__result-container, .artdeco-entity-lockup') || a.parentElement;
        if (root) {
          const tEl = root.querySelector('.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle');
          const cEl = root.querySelector('.entity-result__secondary-subtitle, .artdeco-entity-lockup__caption');
          title = tEl ? tEl.textContent.trim() : '';
          company = cEl ? cEl.textContent.trim() : '';
        }
        leads.push({ name, title, company, profileLink: href });
      }
      if (leads.length >= 25) break;
    }
    if (leads.length) console.warn('[HP-CS] Fallback anchor-based extraction used:', leads.length);
  }

  if (!leads.length) console.warn('[HirePilot Extension] scrapeResults found 0 leads – verify selectors against current DOM');
  return leads;
}

// Helper to get the scrollable container for aggressive scrolling
function __hp_getScrollableContainer() {
  // Find the nearest scrollable ancestor of the first result item
  try {
    const firstItem = __hp_findResultItems()[0];
    let node = firstItem ? firstItem.parentElement : null;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const overY = style.overflowY;
      const scrollable = node.scrollHeight > node.clientHeight && (overY === 'auto' || overY === 'scroll');
      if (scrollable) return node;
      node = node.parentElement;
    }
  } catch {}
  // Fallbacks: common containers
  return document.querySelector('div.search-results-container, div.search-results__content, ul.reusable-search__entity-result-list, main') || document.scrollingElement || document.documentElement;
}

// Ensure all results are rendered by scrolling only the results container (no window scroll)
async function __hp_ensureAllResultsRendered(maxMs = 9000, target = 25) {
  try {
    const container = __hp_getScrollableContainer();
    if (!container) return;
    const start = Date.now();
    let lastCount = 0;
    let stableTicks = 0;

    // Focus container to ensure wheel/PageDown events target it
    try { container.focus?.(); } catch {}

    while (Date.now() - start < maxMs) {
      // Scroll container in large steps to bottom
      container.scrollTop = Math.min(container.scrollTop + Math.max(600, Math.round(container.clientHeight * 0.8)), container.scrollHeight);
      // Send a PageDown key to reinforce virtualization triggers
      try {
        container.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
      } catch {}

      await __hp_wait(220 + __hp_randBetween(0, 160));
      const current = __hp_findResultItems().length;
      if (current >= target) break;
      if (current > lastCount) { lastCount = current; stableTicks = 0; }
      else { stableTicks += 1; }
      // If we are stable for a while, try a big jump to bottom
      if (stableTicks >= 6) {
        container.scrollTop = container.scrollHeight;
        await __hp_wait(250);
        const c2 = __hp_findResultItems().length;
        if (c2 <= lastCount) break; // really stable
        lastCount = c2; stableTicks = 0;
      }
    }
    // Return to top to normalize scraping order
    try { container.scrollTop = 0; } catch {}
  } catch {}
}

// Preload leads without scrolling: wait for results to render and parse them
async function preloadLeads() {
  console.log('[HP-CS] Preloading leads');
  return new Promise((resolve) => {
    const finish = async () => {
      try { observer.disconnect(); } catch {}
      // short initial wait to allow list to hydrate
      await __hp_wait(1000 + __hp_randBetween(0, 800));
      await __hp_ensureAllResultsRendered(10000, 25);
      setTimeout(() => resolve(scrapeResults()), 200);
    };

    const checkLoaded = () => {
      const items = __hp_findResultItems();
      if (items && items.length >= 1) {
        console.log('[HP-CS] Results detected, items:', items.length);
        finish();
      }
    };

    const observer = new MutationObserver(() => { checkLoaded(); });
    observer.observe(document.body, { childList: true, subtree: true });

    checkLoaded();
    setTimeout(() => {
      console.warn('[HP-CS] Preload timeout fallback');
      finish();
    }, 8000 + __hp_randBetween(0, 3000));
  });
}

// Locate and click the Next button (human-like), but do not loop pages here
async function clickNextPageHumanLike() {
  const candidates = [
    'button[aria-label="Next"]',
    'a[aria-label="Next"]',
    'li[aria-label="Next"] button',
    'button[aria-label*="Next" i]',
    'button[aria-label*="Next page" i]'
  ];
  let next = null;
  for (const sel of candidates) { const el = document.querySelector(sel); if (el) { next = el; break; } }
  if (!next) return { clicked: false, reason: 'Next not found' };
  const disabled = next.getAttribute('aria-disabled') === 'true' || next.disabled;
  if (disabled) return { clicked: false, reason: 'Next disabled' };

  // Randomized delay 3–7s before navigating
  const delay = __hp_randBetween(3000, 7000);
  await __hp_wait(delay);

  try {
    next.focus?.();
    next.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    next.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    next.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    next.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    next.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { clicked: true, delayMs: delay };
  } catch (e) {
    return { clicked: false, error: e?.message || 'Failed to click Next' };
  }
}

// Expose for tests
try {
  if (typeof window !== 'undefined') {
    window.__HP = window.__HP || {};
    window.__HP.autoScrollPage = autoScrollPage;
    window.__HP.scrapeResults = scrapeResults;
    window.__HP.clickNextPageHumanLike = clickNextPageHumanLike;
  }
} catch {}

// Lightweight in-page overlay for autopilot
function __hp_showOverlay(text) {
  try {
    let el = document.getElementById('hp-scrape-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hp-scrape-overlay';
      el.style.position = 'fixed';
      el.style.bottom = '16px';
      el.style.right = '16px';
      el.style.zIndex = '2147483647';
      el.style.background = 'rgba(20,23,26,0.95)';
      el.style.color = '#fff';
      el.style.padding = '10px 12px';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      el.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
      el.style.fontSize = '13px';
      el.style.maxWidth = '340px';
      el.style.lineHeight = '1.35';
      document.body.appendChild(el);
    }
    el.textContent = text || 'HirePilot is gathering leads. Please keep this tab open.';
    el.style.display = 'block';
  } catch {}
}
function __hp_updateOverlay(text) {
  try { const el = document.getElementById('hp-scrape-overlay'); if (el && text) el.textContent = text; } catch {}
}
function __hp_hideOverlay() {
  try { const el = document.getElementById('hp-scrape-overlay'); if (el) el.style.display = 'none'; } catch {}
}

// ===== Full loop controller =====
async function runAutoScrapeLoop(opts) {
  const pageLimit = Number(opts?.pageLimit || 1);
  const campaignId = opts?.campaignId || null;
  const maxErrors = 3;
  window.__HP_SCRAPE_STOP__ = false;
  let maxHeap = 0;
  let lastHeap = null;

  const getCurrentPageFromUrl = () => {
    try {
      const u = new URL(location.href);
      const p = Number(u.searchParams.get('page') || u.searchParams.get('p') || '1');
      return Number.isFinite(p) && p > 0 ? p : 1;
    } catch { return 1; }
  };

  // Load persisted state
  const stateKey = `hp_scrape_state`;
  let persisted = {};
  try { persisted = (await chrome.storage.session.get(stateKey))[stateKey] || {}; } catch {}
  let currentPage = persisted.currentPage || getCurrentPageFromUrl();
  let totalLeads = persisted.totalLeads || 0;
  let errorCount = 0;

  const persist = async () => {
    try { await chrome.storage.session.set({ [stateKey]: { currentPage, totalLeads, campaignId } }); } catch {}
  };

  const waitForFocus = async () => {
    if (document.visibilityState === 'visible') return;
    await new Promise((resolve) => {
      const onVis = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', onVis); resolve(); } };
      document.addEventListener('visibilitychange', onVis);
    });
  };

  const randomDelay = async (min = 3000, max = 7000) => { await __hp_wait(__hp_randBetween(min, max)); };

  try {
    if (!/linkedin\.com\/sales\/search/i.test(location.href)) {
      throw new Error('Not on Sales Navigator search page');
    }

    // Small initial delay on first run so SN can stabilize
    await __hp_wait(1200 + __hp_randBetween(0, 800));

    for (;;) {
      if (window.__HP_SCRAPE_STOP__) return { ok: true, stopped: true, currentPage, totalLeads, maxHeap, lastHeap };
      if (currentPage > pageLimit) break;

      await waitForFocus();

      try {
        console.debug('[HP Content] Processing page', currentPage);
        const leads = await preloadLeads();
        console.log('[HirePilot Extension] Page', currentPage, 'leads:', leads.length);

        try {
          const h = (performance && performance.memory && performance.memory.usedJSHeapSize) ? performance.memory.usedJSHeapSize : null;
          lastHeap = h;
          if (h && h > maxHeap) maxHeap = h;
        } catch {}

        await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'HP_SCRAPE_CHUNK', page: currentPage, pageLimit, campaignId, leads, heap: lastHeap },
            () => resolve()
          );
        });

        totalLeads += leads.length;
        errorCount = 0;

        try { chrome.runtime.sendMessage({ action: 'SCRAPE_PROGRESS', page: currentPage, pageLimit, sentThisPage: leads.length, totalSent: totalLeads, pagesDone: currentPage, campaignId, heap: lastHeap, maxHeap }); } catch {}

        await persist();
      } catch (e) {
        console.warn('[HirePilot Extension] Page scrape error:', e?.message || e);
        errorCount += 1;
        if (errorCount >= maxErrors) {
          await logRunSummary({ status: 'error', error: e?.message || 'max errors', currentPage, totalLeads, campaignId, maxHeap, lastHeap });
          return { error: e?.message || 'Too many errors', currentPage, totalLeads };
        }
      }

      // Navigate to next page
      const next = await clickNextPageHumanLike();
      if (!next?.clicked) { console.log('[HirePilot Extension] No next page or click failed:', next?.reason || next?.error); break; }

      await randomDelay(3000, 7000);
      await waitForFocus();
      currentPage = getCurrentPageFromUrl() || (currentPage + 1);
      await persist();
    }

    await logRunSummary({ status: 'ok', currentPage, totalLeads, campaignId, maxHeap, lastHeap });
    __hp_updateOverlay(`Done. Found ${totalLeads} leads across ${currentPage - 1 + (totalLeads>0?1:0)} page(s).`);
    return { ok: true, currentPage, totalLeads };
  } catch (e) {
    await logRunSummary({ status: 'error', error: e?.message || 'loop failed', currentPage, totalLeads, campaignId, maxHeap, lastHeap });
    return { error: e?.message || 'Loop failed', currentPage, totalLeads };
  }
}

async function logRunSummary(summary) {
  try {
    chrome.runtime.sendMessage({ action: 'SCRAPE_RUN_SUMMARY', summary });
  } catch {}
}