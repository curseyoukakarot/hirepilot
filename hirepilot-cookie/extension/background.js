const API_BASE = 'https://api.thehirepilot.com/api';
// Resolve backend API base dynamically so the extension works in prod and local
const DEFAULT_API_BASES = [
  'https://api.thehirepilot.com/api',
  'http://127.0.0.1:8080/api',
  'http://localhost:8080/api'
];

async function getApiBase() {
  try {
    const { hp_api_base } = await chrome.storage.local.get('hp_api_base');
    if (hp_api_base) return hp_api_base;
  } catch {}

  for (const base of DEFAULT_API_BASES) {
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${base}/health`, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        try { await chrome.storage.local.set({ hp_api_base: base }); } catch {}
        return base;
      }
    } catch {}
  }

  return DEFAULT_API_BASES[0];
}
let lastLinkedInTabId = null;
const portsByTab = new Map();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url?.includes('linkedin.com')) {
    lastLinkedInTabId = tabId;
    chrome.storage.local.set({ lastLinkedInTabId });

    // Auto-connect trigger from URL params (works when user navigates directly)
    try {
      const url = new URL(tab.url);
      if (url.searchParams.get('hirepilot_connect') === '1') {
        const msg = url.searchParams.get('hp_msg') || '';
        // Prefer page-context execution to avoid content script race
        chrome.scripting.executeScript({
          target: { tabId },
          func: (message) => {
            const ev = new CustomEvent('hirepilot:auto-connect-start', { detail: { message } });
            window.dispatchEvent(ev);
          },
          args: [msg],
          world: 'MAIN'
        }).catch(()=>{
          // Fallback to sendMessage to content script
          chrome.tabs.sendMessage(tabId, { action: 'connectAndSend', message: msg });
        });
      }
    } catch {}
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url?.includes('linkedin.com')) {
      lastLinkedInTabId = tab.id;
      chrome.storage.local.set({ lastLinkedInTabId });
    }
  } catch {}
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'scrape-channel') return;
  port.onMessage.addListener(async (msg) => {
    try {
      const tabId = msg.tabId || lastLinkedInTabId || (await (async()=>{ try { const s = await chrome.storage.local.get('lastLinkedInTabId'); return s.lastLinkedInTabId; } catch { return null; } })());
      if (!tabId) return port.postMessage({ error: 'No LinkedIn tab detected' });
      portsByTab.set(tabId, port);
      if (msg.action === 'scrapeLinkedInSearch') {
        const resp = await scrapeLinkedInSearchInjected(tabId);
        port.postMessage(resp);
      }
      if (msg.action === 'scrapeSalesNav') {
        const resp = await scrapeSalesNavInjected(tabId);
        port.postMessage(resp);
      }
      if (msg.action === 'scrapeSingleProfile') {
        const resp = await scrapeSingleProfileInjected(tabId);
        port.postMessage(resp);
      }
    } catch (e) {
      port.postMessage({ error: e.message || 'Operation failed' });
    }
  });
  port.onDisconnect.addListener(() => {
    for (const [tabId, p] of portsByTab.entries()) {
      if (p === port) portsByTab.delete(tabId);
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getFullCookie') {
    // Use chrome.cookies API to get ALL cookies including HttpOnly ones
    chrome.cookies.getAll({ domain: '.linkedin.com' }, (cookies) => {
      console.log('[HirePilot Background] Found', cookies.length, 'LinkedIn cookies');
      
      // Convert cookies to document.cookie format
      const cookieString = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      
      console.log('[HirePilot Background] Generated cookie string length:', cookieString.length);
      console.log('[HirePilot Background] Has li_at:', cookieString.includes('li_at='));
      console.log('[HirePilot Background] Has JSESSIONID:', cookieString.includes('JSESSIONID='));
      
      sendResponse({ fullCookie: cookieString });
    });
    return true;  // Keep channel open
  }
  
  if (msg.action === 'scrapeSalesNav') {
    // Use injected scraper for Sales Navigator People search results
    (async () => {
      try {
        // Prefer the last known LinkedIn tab because the popup window may be the active window
        let tab = null;
        try {
          const act = await chrome.tabs.query({ active: true, currentWindow: true });
          if (act && act[0] && /linkedin\.com/i.test(act[0].url || '')) tab = act[0];
        } catch {}
        if (!tab) {
          const stored = await chrome.storage.local.get('lastLinkedInTabId');
          const lastId = stored?.lastLinkedInTabId || lastLinkedInTabId || null;
          if (lastId) {
            try { const t = await chrome.tabs.get(lastId); if (t?.url && /linkedin\.com/i.test(t.url)) tab = t; } catch {}
          }
        }
        if (!tab) {
          const liTabs = await chrome.tabs.query({ url: ['*://*.linkedin.com/*'] });
          if (liTabs && liTabs.length) tab = liTabs[0];
        }
        if (!tab || !/linkedin\.com\/sales\//i.test(tab.url || '')) {
          return sendResponse({ error: 'Open a Sales Navigator search page' });
        }
        const resp = await scrapeSalesNavListInjected(tab.id);
        return sendResponse(resp);
      } catch (e) {
        return sendResponse({ error: e.message || 'Failed to scrape Sales Nav' });
      }
    })();
    return true; // keep channel open
  }
  // scrapeLinkedInSearch disabled for now

  if (msg.action === 'connectAndSend') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.url?.includes('linkedin.com')) return sendResponse({ error: 'Not on LinkedIn tab' });
      try {
        // Prefer executing in page context to avoid missing content script
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: connectAndSendInjected,
          args: [msg.message],
          world: 'MAIN'
        });
        // On success, record credit usage in backend
        if (result && result.ok) {
          try {
            const apiBase = await getApiBase();
            const { hp_jwt } = await chrome.storage.local.get('hp_jwt');
            if (hp_jwt && apiBase) {
              await fetch(`${apiBase.replace(/\/api$/, '')}/api/linkedin/record-connect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${hp_jwt}` }
              });
            }
          } catch (e) {
            console.warn('[HirePilot Background] record-connect failed:', e);
          }
        }
        sendResponse(result || { error: 'No result from injected connect' });
      } catch (e) {
        // As a fallback, try messaging the content script
        try {
          chrome.tabs.sendMessage(tab.id, msg, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message || 'Failed to message content script' });
            } else {
              sendResponse(response);
            }
          });
        } catch (err) {
          sendResponse({ error: err?.message || 'Failed to auto-connect' });
        }
      }
    });
    return true;
  }

  if (msg.action === 'navAndConnect') {
    const { url, message } = msg;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return sendResponse({ error: 'No active tab' });

      const onUpdated = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.sendMessage(tabId, { action: 'connectAndSend', message }, (resp) => {
            sendResponse(resp);
          });
        }
      };

      try {
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.update(tabId, { url });
      } catch (e) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        sendResponse({ error: e.message || 'Failed to navigate' });
      }
    });
    return true;
  }

  if (msg.action === 'scrapeSingleProfile') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.url?.includes('linkedin.com')) return sendResponse({ error: 'Not on LinkedIn tab' });
      try {
        // Route SN profile pages to dedicated scraper with MAIN world
        if (/linkedin\.com\/sales\/(people|lead)\//i.test(tab.url)) {
          const [{ result: prof } = {}] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeSalesNavProfileInjected,
            world: 'MAIN'
          });
          if (!prof || !prof.ok) return sendResponse({ error: 'Profile not detected' });
          return sendResponse({ profile: {
            name: prof.name,
            title: prof.headline,
            company: prof.company,
            profileUrl: prof.linkedinUrl,
            avatarUrl: prof.avatarUrl
          }});
        }
        // Standard LinkedIn profile: prefer MAIN-world injected scraper first, then fallback to content script
        if (/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(tab.url)) {
          console.debug('[HP-BG] route: standard /in/');
          try {
            const [{ result: prof } = {}] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: scrapeLinkedInProfileInjected,
              world: 'MAIN'
            });
            console.debug('[HP-BG] source injected, hasName:', !!(prof && prof.name));
            if (prof && prof.ok) {
              return sendResponse({ profile: {
                name: prof.name,
                title: prof.headline,
                company: prof.company,
                profileUrl: prof.linkedinUrl,
                avatarUrl: prof.avatarUrl
              }});
            }
          } catch (e) {
            // fall through to content
          }
          // Fallback to content script scrape
          chrome.tabs.sendMessage(tab.id, { action: 'scrapeSingleProfile' }, async (r) => {
            console.debug('[HP-BG] source content, hasName:', !!(r && r.profile && r.profile.name));
            if (chrome.runtime.lastError || !r || !r.profile || !r.profile.name) {
              // Last-chance fallback: use older injected LI scraper
              const inj = await scrapeSingleProfileInjected(tab.id);
              return sendResponse(inj && inj.profile ? inj : { error: 'Profile not detected' });
            }
            return sendResponse(r);
          });
          return true; // keep channel open while waiting for content
        }
        // Unknown LinkedIn page: try injected first, then content
        let resp = await scrapeSingleProfileInjected(tab.id);
        if (resp && resp.profile) return sendResponse(resp);
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeSingleProfile' }, (r) => {
          if (chrome.runtime.lastError) return sendResponse({ error: 'Profile not detected' });
          return sendResponse(r || { error: 'Profile not detected' });
        });
        return true;
      } catch (e) {
        sendResponse({ error: e.message || 'Failed to scrape profile' });
      }
    });
    return true;
  }

  if (msg.action === 'prefillLinkedInMessage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: 'Not on LinkedIn tab' });
      }
    });
    return true;
  }

  if (msg.action === 'getCredits') {
    (async () => {
      try {
        const storage = await chrome.storage.local.get('hp_jwt');
        const jwt = storage.hp_jwt;
        if (!jwt) return sendResponse({ error: 'Not logged in' });
        const api = await getApiBase();
        const res = await fetch(`${api}/credits/status`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });
        const data = await res.json();
        sendResponse({ data });
      } catch (e) {
        sendResponse({ error: e.message || 'Failed to fetch credits' });
      }
    })();
    return true;
  }

  if (msg.action === 'bulkAddLeads') {
    // Handle API call for bulk adding leads (avoids CORS issues)
    handleBulkAddLeads(msg.leads)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ error: error.message }));
    return true;  // Keep channel open for async
  }
});

async function handleBulkAddLeads(leads) {
  console.log('[HirePilot Background] Handling bulk add for', leads.length, 'leads');
  
  // Get JWT from storage
  const storage = await chrome.storage.local.get('hp_jwt');
  const jwt = storage.hp_jwt;
  
  if (!jwt) {
    throw new Error('No JWT found - please log in to the extension first');
  }

  const api = await getApiBase();
  console.log('[HirePilot Background] JWT token:', jwt.substring(0, 20) + '...');
  console.log('[HirePilot Background] API URL:', `${api}/leads/bulk-add`);
  console.log('[HirePilot Background] Request payload:', { leads: leads.slice(0, 2) }); // First 2 leads for debugging

  // First test: Try accessing a known working endpoint to test auth
  try {
    console.log('[HirePilot Background] Testing auth with import endpoint...');
    const testResponse = await fetch(`${api}/leads/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ campaignId: 'test', leads: [] })
    });
    console.log('[HirePilot Background] Test response status:', testResponse.status);
  } catch (testError) {
    console.error('[HirePilot Background] Test request failed:', testError);
  }

  const response = await fetch(`${api}/leads/bulk-add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({ leads })
  });

  console.log('[HirePilot Background] Response status:', response.status);
  console.log('[HirePilot Background] Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[HirePilot Background] Error response:', errorText);
    
    // Handle specific error cases
    if (response.status === 402) {
      throw new Error(`Insufficient credits: ${errorText}`);
    }
    
    throw new Error(`Backend error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[HirePilot Background] API response:', result);
  return result;
}

async function scrapeLinkedInSearchInjected(tabId) {
  const [{ result: leads = [] } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      try {
        console.log('Current URL:', location.href);
        const isPeople = /\/search\/results\/people/i.test(location.href);
        if (!isPeople) console.log('Not on People Search page - continuing');

        // Enhanced Readiness for broader parent
        await new Promise((res) => {
          const targetContainer = '.search-results-container, .reusable-search__entity-result-list';
          const observer = new MutationObserver(() => {
            if (document.querySelector(targetContainer)) {
              console.log('Results container detected');
              observer.disconnect();
              res();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          setTimeout(() => { observer.disconnect(); console.log('Readiness timeout'); res(); }, 20000);
        });

        // Extended scroll with height checks
        let lastHeight = document.documentElement.scrollHeight;
        for (let i = 0; i < 15; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 2000));
          const newHeight = document.documentElement.scrollHeight;
          console.log(`Scrolled page ${i + 1}, height: ${newHeight}`);
          if (newHeight === lastHeight) {
            console.log('No more results loading - stopping scroll');
            break;
          }
          lastHeight = newHeight;
        }

        // Try multiple container selectors with logs
        const containerSelectors = [
          'li.reusable-search__result-container',
          'div.reusable-search__result-container',
          'ul.reusable-search__entity-result-list > li',
          'li.entity-result',
          'div.entity-result__item'
        ];
        let items = [];
        for (const sel of containerSelectors) {
          const nodeList = document.querySelectorAll(sel);
          console.log(`Tried selector '${sel}' - found ${nodeList.length} items`);
          if (nodeList.length > 0) { items = nodeList; break; }
        }
        if (items.length === 0) console.log('No containers found - inspect DOM for new classes');

        const toText = (el) => (el && el.textContent ? el.textContent.trim() : '');
        const normalizeUrl = (href) => {
          if (!href) return '';
          let cleaned = href.split('#')[0];
          const q = cleaned.indexOf('?');
          if (q > -1) cleaned = cleaned.substring(0, q);
          if (/^https?:\/\//i.test(cleaned)) return cleaned;
          if (cleaned.startsWith('/')) return `https://www.linkedin.com${cleaned}`;
          return `https://www.linkedin.com/${cleaned}`;
        };

        const leads = [];
        const seen = new Set();
        items.forEach((item, index) => {
          console.log(`Processing item ${index + 1}`);
          const nameEl = item.querySelector('span.entity-result__title-text span[aria-hidden="true"]')
            || item.querySelector('span[dir="ltr"] > span[aria-hidden="true"]')
            || item.querySelector('.entity-result__title-line span[dir="ltr"]')
            || item.querySelector('.actor-name')
            || item.querySelector('span[aria-hidden="true"]');
          const name = nameEl ? nameEl.innerText.trim() : null;
          if (!name) console.log('No name for this item');

          const titleEl = item.querySelector('.entity-result__primary-subtitle')
            || item.querySelector('.subline-level-1')
            || item.querySelector('span.entity-result__summary')
            || item.querySelector('dd.t-black--light')
            || item.querySelector('.entity-result__title-line');
          const title = titleEl ? titleEl.innerText.trim() : null;

          let company = null;
          const summaryEl = item.querySelector('p.entity-result__summary, div.entity-result__secondary-subtitle, .entity-result__simple-insight-text, .subline-level-2');
          if (summaryEl) {
            const summaryText = summaryEl.innerText.trim();
            const companyMatch = summaryText.match(/\bat\s+([\w\s&.,-]+)(?:$|\s·|\sin)/i) || summaryText.match(/Current:.*?at\s+([\w\s&.,-]+)/i);
            company = companyMatch ? companyMatch[1].trim() : summaryText.split(' at ')[1]?.split(' · ')[0]?.trim();
          }
          if (!company) console.log('No company for this item');

          const linkEl = item.querySelector('a.app-aware-link[href*="/in/"], a.entity-result__content-entity[href*="/in/"], a.search-result__result-link');
          const link = linkEl ? normalizeUrl(linkEl.href || linkEl.getAttribute('href')) : null;

          const avatarEl = item.querySelector('img.entity-result__image, img.presence-entity__image, img');
          const avatar = avatarEl ? avatarEl.src : null;

          if (name && link) {
            if (!seen.has(link)) {
              seen.add(link);
              leads.push({ name, title, company, link, avatar });
            }
          } else {
            console.log('Skipped incomplete lead:', { name, title, company, link });
          }
        });
        console.log(`Total extracted leads: ${leads.length}`);
        return leads;
      } catch (e) {
        console.error('Scrape error:', e);
        return [];
      }
    }
  });
  if (!leads.length) return { error: 'No visible results on this page. Try scrolling or refining search.' };
  const result = await handleBulkAddLeads(leads);
  return { leads, result, mode: 'li_search_injected' };
}

async function scrapeSalesNavInjected(tabId) {
  // Placeholder: reuse search injected for now; can add SN-specific list scraping if desired
  return scrapeLinkedInSearchInjected(tabId);
}

async function scrapeSalesNavListInjected(tabId) {
  const [{ result: data = [] } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      // Sales Navigator People Search list scraping
      const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
      const debug = (...args) => { try { console.debug('[HP SN]', ...args); } catch {} };

      // Wait for any recognizable results container to appear
      const containerSelectors = [
        'ol.search-results__result-list > li',
        'div.search-results__result-item',
        'li.search-results__result-item',
        'li.artdeco-list__item',
        'div.entity-result__item',
        'div.search-results__content ol > li',
        '[data-anonymize="entity-result"]',
        'div.result-lockup',
      ];

      const waitForContainers = async (timeout = 15000) => new Promise((resolve) => {
        const start = Date.now();
        const found = () => containerSelectors.some(sel => document.querySelector(sel));
        if (found()) return resolve(true);
        const obs = new MutationObserver(() => { if (found()) { obs.disconnect(); resolve(true); } });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(false); }, timeout + 50);
      });
      await waitForContainers();

      // Scroll to load more results
      let lastH = 0; let stable = 0;
      for (let i=0;i<18 && stable < 3;i++) {
        window.scrollBy(0, Math.max(400, window.innerHeight/1.5));
        await wait(700);
        const h = document.documentElement.scrollHeight;
        if (h === lastH) stable++; else { stable = 0; lastH = h; }
      }

      // Collect items with broader selectors
      let items = [];
      const counts = {};
      for (const sel of containerSelectors) {
        const n = document.querySelectorAll(sel);
        counts[sel] = n.length;
        if (n.length && items.length === 0) items = n;
      }
      debug('container counts', counts);

      const leads = [];
      const toText = (el)=> (el && el.textContent ? el.textContent.trim() : '');
      const abs = (href)=>{ if(!href) return ''; const c=(href.split('#')[0]||'').split('?')[0]; return /^https?:\/\//.test(c)?c:(c.startsWith('/')?`https://www.linkedin.com${c}`:`https://www.linkedin.com/${c}`); };

      const linkSelectors = [
        'a[data-anonymize="person-name"]',
        'a.result-lockup__name',
        'a[href*="/in/"]',
        'a[href*="/sales/people/"]',
      ];
      const nameSelectors = [
        '[data-anonymize="person-name"]',
        '.result-lockup__name',
        '.artdeco-entity-lockup__title',
        'span[aria-hidden="true"]',
      ];
      const titleSelectors = [
        '[data-anonymize="headline"]',
        '.result-lockup__highlight',
        '.artdeco-entity-lockup__subtitle',
      ];
      const companySelectors = [
        '[data-anonymize="company-name"]',
        '.result-lockup__misc',
      ];
      const pick = (root, sels) => {
        for (const s of sels) { const el = root.querySelector(s); const t = toText(el); if (t) return t; }
        return '';
      };
      const pickHref = (root, sels) => {
        for (const s of sels) { const el = root.querySelector(s); const href = el && (el.getAttribute('href') || el.href); if (href) return abs(href); }
        return '';
      };

      items.forEach((el)=>{
        const profileUrl = pickHref(el, linkSelectors);
        const name = pick(el, nameSelectors);
        const title = pick(el, titleSelectors);
        let company = pick(el, companySelectors);
        if (!company && /\bat\b/i.test(title)) { const m=title.match(/\bat\s+([^|•,]+)\b/i); if (m) company = m[1].trim(); }
        if (profileUrl && name) leads.push({ name, title, company, profileUrl, avatarUrl: '' });
      });

      debug('extracted leads', leads.length);
      if (!leads.length) {
        // Return structured debug so the popup can display details
        return { __hp_debug__: { counts } };
      }
      return leads;
    }
  });
  if (!data.length) {
    // If we got structured debug, surface it for easier support
    const dbg = (data && data.__hp_debug__) ? ` | debug: ${JSON.stringify(data.__hp_debug__)}` : '';
    return { error: 'No Sales Nav leads found on this page' + dbg };
  }
  const result = await handleBulkAddLeads(data);
  return { leads: data, result };
}

async function scrapeSingleProfileInjected(tabId) {
  const [{ result: profile = null } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const waitForProfileReady = (timeoutMs = 12000) => new Promise((resolve) => {
        const start = Date.now();
        const selectors = [
          'h1.profile-topcard__name',
          '.profile-topcard-person-entity__name',
          'dd[data-anonymize="person-name"]',
          'h1.top-card-layout__title',
          '.text-heading-xlarge',
          '.pv-text-details__left-panel h1',
          'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
          'h1.inline.t-24.v-align-middle'
        ];
        const found = () => selectors.some(s => document.querySelector(s));
        if (found()) return resolve(true);
        const obs = new MutationObserver(() => {
          if (found()) { obs.disconnect(); resolve(true); }
          if (Date.now() - start > timeoutMs) { obs.disconnect(); resolve(false); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(()=>{ obs.disconnect(); resolve(false); }, timeoutMs);
      });

      // Wait for main profile sections to render
      await waitForProfileReady(15000);

      const tryText = (sels) => { for (const s of sels) { const el = document.querySelector(s); if (el?.textContent?.trim()) return el.textContent.trim(); } return ''; };
      const tryAttr = (sels, a) => { for (const s of sels) { const el = document.querySelector(s); const v = el?.getAttribute?.(a); if (v) return v; } return ''; };
      const url = location.href;
      const isSN = /linkedin\.com\/sales\//i.test(url);
      // Prefer JSON-LD for consistent profile data
      try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const sc of scripts) {
          try {
            const data = JSON.parse(sc.innerText);
            const choosePerson = (d) => {
              if (!d) return null;
              if (d['@type'] === 'Person') return d;
              if (d.mainEntity?.['@type'] === 'Person') return d.mainEntity;
              if (Array.isArray(d['@graph'])) return d['@graph'].find((g)=> g['@type'] === 'Person');
              return null;
            };
            const person = choosePerson(data);
            if (person) {
              const name = person.name || '';
              const title = person.jobTitle || person.headline || person.description || '';
              let company = (person.worksFor && (person.worksFor.name || (Array.isArray(person.worksFor) && person.worksFor[0]?.name))) || person.affiliation?.name || '';
              // Extra fallback: parse headline pattern "Title at Company"
              if (!company && title && /\bat\b/i.test(title)) {
                const m = title.match(/\bat\s+([^|•,]+)\b/i);
                if (m) company = m[1].trim();
              }
              return {
                name,
                title,
                company,
                profileUrl: person.url || url,
                avatarUrl: (person.image && (person.image.contentUrl || person.image.url || person.image)) || ''
              };
            }
          } catch {}
        }
      } catch {}
      // DOM fallbacks for both LI and Sales Nav
      const name = isSN
        ? tryText(['h1.profile-topcard__name', '.profile-topcard-person-entity__name', 'dd[data-anonymize="person-name"]', 'h1.top-card-layout__title', '.artdeco-entity-lockup__title'])
        : tryText(['h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words', '.text-heading-xlarge', '.pv-text-details__left-panel h1', 'h1.inline.t-24.v-align-middle']);
      const headline = isSN ? tryText(['dd.profile-topcard__headline', '.profile-topcard__summary-position-title', 'dd[data-anonymize="headline"]', '.artdeco-entity-lockup__subtitle']) : tryText(['.text-body-medium.break-words', '.pv-text-details__left-panel .text-body-medium']);
      let company = isSN ? tryText(['a.profile-topcard__current-position-company', 'a[data-anonymize="company-name"]', '.artdeco-entity-lockup__caption a']) : tryText(['.pv-entity__secondary-title', '.pv-entity__company-summary-info h2']);
      if (!company && headline && /\bat\b/i.test(headline)) {
        const m2 = headline.match(/\bat\s+([^|•,]+)\b/i);
        if (m2) company = m2[1].trim();
      }
      const avatarUrl = isSN ? tryAttr(['img.profile-topcard__profile-image', 'img[data-anonymize="headshot-photo"], img.top-card-layout__cta-button--photo'], 'src') : tryAttr(['.pv-top-card__photo img', 'img.pv-top-card-profile-picture__image'], 'src');
      if (!name && !headline) return null;
      return { name, title: headline, company, profileUrl: url, avatarUrl: avatarUrl || '' };
    }
  });
  if (!profile) return { error: 'Profile not detected' };
  return { profile };
}

// Page-context injected auto-connect flow (works even if content script not loaded yet)
function connectAndSendInjected(message) {
  const wait = (ms) => new Promise(r=>setTimeout(r, ms));
  const dispatchClick = (el) => { try { el && el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window })); el?.click?.(); return !!el; } catch { return false; } };
  const findByText = (root, sel, re) => Array.from((root||document).querySelectorAll(sel)).find(n=>re.test((n.textContent||'').trim())) || null;
  const clickableByText = (root, sel, re) => { const el = findByText(root, sel, re); return el ? (el.closest('button,a,[role="menuitem"],[role="button"]') || el) : null; };
  return (async () => {
    try {
      // Already connected?
      const connected = Array.from(document.querySelectorAll('span,button')).some(n=>/pending|message sent|connected/i.test(n.textContent||''));
      if (connected) return { skipped:true, reason:'Already pending/connected' };

      // Try direct connect
      let target = clickableByText(document, 'button,[role="button"],a', /^(connect|invite)$/i) || clickableByText(document, 'button,[role="button"],a', /(connect|invite)/i);
      if (!target) {
        // Open More
        const more = clickableByText(document, 'button,[role="button"],a', /^more$/i) || clickableByText(document, 'button,[role="button"],a', /more/i) || document.querySelector('button[aria-label*="More" i]');
        if (!more) return { error:'Connect button not found (no More menu)' };
        // Retry with jitter to ensure menu renders under slower pages
        let opened = false;
        for (let i=0; i<3 && !opened; i++) {
          dispatchClick(more);
          await wait(400 + Math.floor(Math.random()*300));
          const openMenu = Array.from(document.querySelectorAll('div[role="menu"], ul[role="menu"], .artdeco-dropdown__content-inner, .artdeco-dropdown__content')).find(m => (m.offsetParent !== null));
          if (openMenu) opened = true;
        }
        const menus = Array.from(document.querySelectorAll('div[role="menu"], ul[role="menu"], .artdeco-dropdown__content-inner, .artdeco-dropdown__content'));
        let menu = menus.find(m => (m.offsetParent !== null)) || menus[0] || document;
        target = clickableByText(menu, 'div[role="menuitem"],li,button,a,span', /connect|invite/i);
        if (!target) {
          const items = Array.from(menu.querySelectorAll('div[role="menuitem"], li, button, a')).filter(n => (n.offsetParent !== null));
          if (items.length >= 5) target = items[4];
        }
      }
      if (!target) return { error:'Connect button not found' };
      dispatchClick(target);
      await wait(700);

      // Add a note
      const add = clickableByText(document, 'button,[role="button"],a,span', /add a note/i);
      if (add) { dispatchClick(add); await wait(400); }

      // Fill note
      const modal = document.querySelector('div[role="dialog"], .artdeco-modal') || document;
      const inputs = Array.from(modal.querySelectorAll('textarea, div[contenteditable="true"]'));
      if (!inputs.length) return { error:'Could not find message input' };
      const input = inputs[0];
      const max = Number(input.getAttribute('maxlength') || 300);
      const text = (message || '').slice(0, max);
      if (input.tagName.toLowerCase() === 'textarea') input.value = text; else input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles:true }));
      await wait(300);

      // Send
      const send = clickableByText(modal, 'button,[role="button"],a,span', /^send$/i) || clickableByText(modal, 'button,[role="button"],a,span', /send/i);
      if (!send) return { error:'Send button not found' };
      dispatchClick(send);
      await wait(600);
      return { ok:true };
    } catch (e) {
      return { error: e?.message || 'Failed to auto-connect' };
    }
  })();
}

// Injected scraper for standard LinkedIn /in/ profiles
function scrapeLinkedInProfileInjected() {
  const debug = (...args) => console.debug('[HP-LI]', ...args);
  const text = (el) => (el ? el.textContent?.trim().replace(/\s+/g, ' ') : '');
  const first = (sels, tag) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      const val = text(el);
      if (val) { debug('matched', tag, s); return val; }
    }
    return '';
  };
  const firstAttr = (sels, attr, tag) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      const val = el?.getAttribute?.(attr) || '';
      if (val) { debug('matched', tag, s); return val; }
    }
    return '';
  };
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
  const waitFor = (pred, timeoutMs = 12000) => new Promise((resolve) => {
    const start = Date.now();
    if (pred()) return resolve(true);
    const target = document.querySelector('.pv-top-card') || document.head || document.documentElement;
    const obs = new MutationObserver(() => {
      requestAnimationFrame(() => {
        if (pred()) { obs.disconnect(); resolve(true); }
        else if (Date.now() - start > timeoutMs) { obs.disconnect(); resolve(false); }
      });
    });
    obs.observe(target, { childList: true, subtree: true, attributes: true });
    setTimeout(() => { obs.disconnect(); resolve(false); }, timeoutMs + 50);
  });

  return (async () => {
    try {
      const readiness = ['h1[data-test="profile"]','h1[dir="auto"]','.text-heading-xlarge','.pv-text-details__left-panel h1','[data-view-name="profile"] h1'];

      // Instant attempt (fast path)
      const instant = (() => {
        const ld0 = getJSONLD();
        const name0 = ld0?.name || first(['h1[dir="auto"]','.text-heading-xlarge','.pv-text-details__left-panel h1','h1[data-test="profile"]','[data-view-name="profile"] h1'],'name0');
        if (name0) {
          const headline0 = ld0?.jobTitle || ld0?.description || first(['.text-body-medium.break-words','.pv-text-details__left-panel .text-body-medium','[data-test-profile-subheader]'],'headline0');
          let company0 = (ld0 && (ld0.worksFor?.name || (Array.isArray(ld0.worksFor) && ld0.worksFor[0]?.name))) || first(['.pv-entity__company-summary-info','a[href*="/company/"]','.pv-text-details__left-panel span.pv-text-details__label'],'company0');
          if (!company0 && headline0 && /\bat\b/i.test(headline0)) { const m=headline0.match(/\bat\s+([^|•,]+)\b/i); if (m) company0=m[1].trim(); }
          const loc0 = ld0?.address?.addressLocality || '';
          const av0 = (ld0 && (ld0.image?.contentUrl || ld0.image)) || firstAttr(['.pv-top-card-profile-picture__image--show','.pv-top-card__photo img','img[alt*="photo"]','img.evi-image.lazy-loaded'],'src','avatar0');
          const url0 = ld0?.url || firstAttr(['meta[property="og:url"]'],'content','og:url0') || location.href;
          debug('instant success');
          return { ok:true, isSalesNav:false, name:name0, headline:headline0, company:company0, location:loc0, avatarUrl:av0, linkedinUrl:url0 };
        }
        return null;
      })();
      if (instant) return instant;

      await waitFor(() => !!getJSONLD() || readiness.some(s => !!document.querySelector(s)), 5000);
      debug('ready', readiness.find(s => !!document.querySelector(s)) || 'jsonld');

      const ld = getJSONLD();
      const name = ld?.name || first([
        'h1[dir="auto"]',
        '.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
        '.text-heading-xlarge',
        '.pv-text-details__left-panel h1',
        '.pv-top-card--list .text-heading-xlarge',
        'h1[data-test="profile"]',
        '[data-view-name="profile"] h1'
      ], 'name');

      const headline = ld?.jobTitle || ld?.description || first([
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '[data-test-profile-subheader]',
        'p.text-body-medium.break-words',
        'div.pv-text-details__left-panel div.text-body-medium'
      ], 'headline');

      let company = (ld && (ld.worksFor?.name || (Array.isArray(ld.worksFor) && ld.worksFor[0]?.name))) || first([
        '.pv-entity__company-summary-info',
        'a[href*="/company/"]',
        '.pv-text-details__left-panel span.pv-text-details__label'
      ], 'company');
      if (!company && headline && /\bat\b/i.test(headline)) {
        const m = headline.match(/\bat\s+([^|•,]+)\b/i);
        if (m) { company = m[1].trim(); debug('company from headline'); }
      }

      const locationText = ld?.address?.addressLocality || first([
        '.pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words',
        '[data-anonymize="location"]'
      ], 'location');

      const avatarUrl = (ld && (ld.image?.contentUrl || ld.image)) || firstAttr([
        '.pv-top-card-profile-picture__image--show',
        '.pv-top-card__photo img',
        'img[alt*="photo"]',
        'img.evi-image.lazy-loaded'
      ], 'src', 'avatar');

      const linkedinUrl = ld?.url || firstAttr(['meta[property="og:url"]'], 'content', 'og:url') || location.href;

      debug('url', location.href); debug('source', ld ? 'jsonld' : 'dom'); debug('final', { name, headline, company, avatar: !!avatarUrl });

      return { ok: !!name, isSalesNav: false, name, headline, company, location: locationText, avatarUrl, linkedinUrl };
    } catch (e) {
      return { ok:false, error: e?.message || 'scrape failed' };
    }
  })();
}
// Robust Sales Navigator profile scraper executed in page context (MAIN world)
function scrapeSalesNavProfileInjected() {
  const debug = (...args) => console.debug('[HP-SN]', ...args);

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

  const getApolloState = () => {
    try {
      const state = window.__APOLLO_STATE__ || window.__APOLLO_CLIENT__?.cache?.extract?.();
      if (!state) return null;
      const personKey = Object.keys(state).find(k => /Person|fsd_profile/i.test(k));
      if (!personKey) return null;
      const person = state[personKey];
      const name = person?.fullName || person?.miniProfile?.firstName && person?.miniProfile?.lastName ? `${person.miniProfile.firstName} ${person.miniProfile.lastName}` : '';
      const headline = person?.headline || person?.miniProfile?.occupation || '';
      const publicIdentifier = person?.publicIdentifier || person?.miniProfile?.publicIdentifier;
      const url = publicIdentifier ? `https://www.linkedin.com/in/${publicIdentifier}` : location.href;
      let avatar = '';
      try {
        const vec = person?.profilePicture?.displayImageReference?.vectorImage;
        if (vec?.rootUrl && vec?.artifacts?.length) {
          avatar = vec.rootUrl + vec.artifacts[0].fileIdentifyingUrlPathSegment;
        }
      } catch {}
      return { name, headline, url, avatar };
    } catch {}
    return null;
  };

  const waitFor = (pred, timeoutMs = 10000) => new Promise((resolve) => {
    const start = Date.now();
    if (pred()) return resolve(true);
    const obs = new MutationObserver(() => {
      if (pred()) { obs.disconnect(); resolve(true); }
      else if (Date.now() - start > timeoutMs) { obs.disconnect(); resolve(false); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(false); }, timeoutMs + 50);
  });

  const text = (el) => (el ? el.textContent?.trim().replace(/\s+/g, ' ') : '');
  const first = (sels) => { for (const s of sels) { const el = document.querySelector(s); const val = text(el); if (val) { debug('matched', s); return val; } } return ''; };
  const firstAttr = (sels, attr) => { for (const s of sels) { const el = document.querySelector(s); const val = el?.getAttribute?.(attr) || ''; if (val) { debug('matched', s); return val; } } return ''; };

  // Readiness
  waitFor(() => !!getJSONLD() || !!getApolloState() || !!document.querySelector('[data-anonymize="person-name"], h1[dir="auto"], h1.profile-topcard__name, .artdeco-entity-lockup__title'));

  const ap = getApolloState();
  const ld = getJSONLD();

  const name = ap?.name || ld?.name || first(['[data-anonymize="person-name"]','h1.profile-topcard__name','h1[dir="auto"]','.artdeco-entity-lockup__title']);
  const headline = ap?.headline || ld?.jobTitle || ld?.headline || first(['dd[data-anonymize="headline"]','.profile-topcard__summary-position-title','.artdeco-entity-lockup__subtitle']);
  let company = '';
  if (headline && /\bat\b/i.test(headline)) { const m = headline.match(/\bat\s+([^|•,]+)\b/i); if (m) company = m[1].trim(); }
  if (!company) company = first(['a.profile-topcard__current-position-company','a[data-anonymize="company-name"]','.artdeco-entity-lockup__caption a']);
  const avatarUrl = ap?.avatar || ld?.image?.contentUrl || ld?.image || firstAttr(['img.profile-topcard__profile-image','img[data-anonymize="headshot-photo"]','img[alt*="photo"]'],'src');
  const publicLink = firstAttr(['a[href*="www.linkedin.com/in/"]'],'href');
  const linkedinUrl = ap?.url || ld?.url || publicLink || location.href;

  return { ok: !!name, isSalesNav: true, name, headline, company, avatarUrl, linkedinUrl };
}
