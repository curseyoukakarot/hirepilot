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

async function resolveLinkedInTab(preferredTab) {
  const isLinkedIn = (tab) => !!(tab && /linkedin\.com/i.test(tab.url || ''));
  if (isLinkedIn(preferredTab)) return preferredTab;
  if (lastLinkedInTabId) {
    try {
      const tab = await chrome.tabs.get(lastLinkedInTabId);
      if (isLinkedIn(tab)) return tab;
    } catch {}
  }
  try {
    const salesTabs = await chrome.tabs.query({ url: ['*://*.linkedin.com/sales/search/*', '*://*.linkedin.com/sales/*'] });
    if (salesTabs && salesTabs.length) return salesTabs[0];
  } catch {}
  try {
    const liTabs = await chrome.tabs.query({ url: ['*://*.linkedin.com/*', '*://linkedin.com/*'] });
    if (liTabs && liTabs.length) return liTabs[0];
  } catch {}
  return null;
}

async function ensureContentScriptReady(tabId) {
  if (!tabId) throw new Error('No LinkedIn tab available');
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  } catch (e) {
    console.warn('[HP-BG] content.js injection warning:', e?.message || e);
  }
  await new Promise((r) => setTimeout(r, 200));
  const pingResp = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ error: chrome.runtime.lastError.message });
      resolve(resp || {});
    });
  });
  if (pingResp && pingResp.ok) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  } catch {}
  await new Promise((r) => setTimeout(r, 150));
}

async function relayToLinkedInTab(tab, message) {
  if (!tab?.id) throw new Error('No LinkedIn tab available');
  await ensureContentScriptReady(tab.id);
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(resp || { ok: true });
    });
  });
}

// --- Helpers for API posting with retry/backoff and error reporting ---
async function postLeadsScrape(leads, campaignId) {
  const api = await getApiBase();
  const isUuid = (v) => typeof v === 'string' && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(v);
  const useImport = isUuid(campaignId);
  const endpoints = useImport ? [`${api}/leads/import`, `${api}/leads/bulk-add`] : [`${api}/leads/bulk-add`];
  // Normalize leads to expected shape
  const normalizedLeads = Array.isArray(leads) ? leads.map((l) => {
    const rawLink = l?.profileLink || l?.profileUrl || l?.link || l?.profile || '';
    const cleanName = (l?.name || '')
      .replace(/\bis reachable\b/gi, '')
      .replace(/\bwas last active.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      name: cleanName,
      title: l?.title || '',
      company: l?.company || '',
      profileLink: rawLink,
      profileUrl: rawLink,
      linkedin_url: rawLink
    };
  }).filter(l => l.name && l.profileLink) : [];

  // Build payloads
  const payloadImport = { leads: normalizedLeads, source: 'sales_nav', campaignId };
  const payloadBulk = { leads: normalizedLeads };

  const maxAttempts = 3;
  let delay = 800;
  let lastErr = null;

  // Fetch auth token if available
  let jwt = null;
  try { const st = await chrome.storage.local.get('hp_jwt'); jwt = st?.hp_jwt || null; } catch {}

  for (const url of endpoints) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const isImportEndpoint = url.endsWith('/import');
        const bodyPayload = isImportEndpoint ? payloadImport : payloadBulk;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {})
          },
          body: JSON.stringify(bodyPayload)
        });
        if (res.status === 404) {
          throw new Error('HTTP 404');
        }
        if (!res.ok) {
          let bodyText = '';
          try { bodyText = await res.text(); } catch {}
          if (res.status === 402) {
            console.error('[HP-BG] Insufficient credits:', bodyText);
            await reportClientError(`[upload] 402 insufficient credits body=${bodyText.slice(0,500)}`);
          } else {
            console.error('[HP-BG] Upload failed', url, 'status=', res.status, 'body=', bodyText.slice(0, 500));
            await reportClientError(`[upload] ${url} failed status=${res.status} body=${bodyText.slice(0,500)} sample=${JSON.stringify(normalizedLeads[0]||{})}`);
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn(`[HP-BG] scrape upload ${url} attempt ${attempt}/${maxAttempts} failed:`, e?.message || e);
        if (e?.message === 'HTTP 404') break; // move to next endpoint candidate
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
    }
  }
  try { await reportClientError(`leads upload persistent failure: ${lastErr?.message || lastErr}`); } catch {}
  throw lastErr || new Error('Upload failed');
}

async function reportClientError(message) {
  try {
    const api = await getApiBase();
    await fetch(`${api}/logs/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'extension-bg', message, when: new Date().toISOString() })
    });
  } catch {}
}

async function reportRunSummary(summary) {
  try {
    const api = await getApiBase();
    await fetch(`${api}/logs/scrape-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'extension-bg', when: new Date().toISOString(), ...summary })
    });
  } catch {}
}

// --- Injected single-profile scrapers (page-context) ---
// These run in the page's MAIN world and must not reference chrome.* APIs
function scrapeLinkedInProfileInjected() {
  try {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
    };
    const attr = (sel, a) => {
      const el = document.querySelector(sel);
      return el ? (el.getAttribute(a) || '') : '';
    };

    const name =
      text('h1.text-heading-xlarge') ||
      text('div.ph5 h1') ||
      text('div.pv-text-details__left-panel h1') ||
      text('h1');

    const headline =
      text('[data-test-id="hero__headline"]') ||
      text('.text-body-medium.break-words') ||
      text('.pv-text-details__left-panel .text-body-medium') ||
      '';

    // Best-effort company pick; may be empty depending on page structure
    const company =
      text('[data-anonymize="company-name"]') ||
      text('.pv-text-details__right-panel .pv-text-details__right-panel-item a') ||
      text('section.pv-top-card .pv-text-details__right-panel a') ||
      '';

    const avatarEl = document.querySelector(
      'img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview, img[alt*="profile" i]'
    );
    const avatarUrl = avatarEl ? (avatarEl.currentSrc || avatarEl.src || attr('img[alt*="profile" i]', 'src')) : '';

    return { ok: !!name, name, headline, company, linkedinUrl: location.href, avatarUrl };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function scrapeSalesNavProfileInjected() {
  try {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
    };
    const href = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.href || '' : '';
    };

    const name =
      text('h1.profile-topcard-person-entity__name') ||
      text('[data-anonymize="person-name"]') ||
      text('.profile-topcard__title') ||
      text('h1');

    const headline =
      text('[data-anonymize="headline"]') ||
      text('.profile-topcard__summary') ||
      '';

    const company =
      text('[data-anonymize="company-name"]') ||
      text('.profile-topcard__current-positions a') ||
      '';

    // Try to discover canonical /in/ URL on the page; fallback to current URL
    const profileLink =
      href('a[href*="/in/"]') ||
      href('a[data-control-name="contact_see_more"]') ||
      location.href;

    const avatarEl = document.querySelector('.profile-topcard-avatar__image, img[alt*="profile" i]');
    const avatarUrl = avatarEl ? (avatarEl.currentSrc || avatarEl.src || '') : '';

    return { ok: !!name, name, headline, company, linkedinUrl: profileLink, avatarUrl };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Wrapper used by background fallbacks to execute appropriate scraper based on URL
async function scrapeSingleProfileInjected(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab?.url || '';
    const fn = /linkedin\.com\/sales\/(people|lead)\//i.test(url)
      ? scrapeSalesNavProfileInjected
      : scrapeLinkedInProfileInjected;
    const [{ result: prof } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: fn,
      world: 'MAIN'
    });
    if (prof && prof.ok) {
      return {
        profile: {
          name: prof.name || '',
          title: prof.headline || '',
          company: prof.company || '',
          profileUrl: prof.linkedinUrl || url,
          avatarUrl: prof.avatarUrl || ''
        }
      };
    }
    return { error: 'Profile not detected' };
  } catch (e) {
    return { error: e?.message || 'Profile not detected' };
  }
}

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
  if (msg.action === 'SCRAPE_RUN_SUMMARY') {
    (async () => {
      try {
        const { summary } = msg || {};
        await reportRunSummary(summary || {});
        try { await chrome.storage.session.set({ hp_autopilot_mode: false, hp_autopilot_started_at: 0 }); } catch {}
        // Also forward a flat summary for popup completion message
        try {
          chrome.runtime.sendMessage({
            action: 'SCRAPE_RUN_SUMMARY',
            totalLeads: summary?.totalLeads || 0,
            pagesDone: summary?.currentPage || summary?.pagesDone || 0
          });
        } catch {}
        sendResponse({ ok: true });
      } catch (e) {
        try { await reportClientError(`run summary failed: ${e?.message || e}`); } catch {}
        sendResponse({ error: e?.message || 'Failed to log run summary' });
      }
    })();
    return true;
  }
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
  
  // Step 2: Receive per-page chunk from content, upload to API with retry/backoff, and notify popup
  if (msg.action === 'HP_SCRAPE_CHUNK' || msg.action === 'LEADS_SCRAPED') {
    (async () => {
      try {
        const tabId = sender?.tab?.id || null;
        const leads = Array.isArray(msg.leads) ? msg.leads : [];
        const campaignId = msg.campaignId || null;
        const page = Number(msg.page || 1);
        const pageLimit = Number(msg.pageLimit || 1);

        // Track progress state per tab
        const stateKey = `scrape_state_${tabId || 'global'}`;
        let state = (await chrome.storage.session.get(stateKey))[stateKey] || { totalSent: 0, pagesDone: 0 };

        // Upload leads for this page (skip if empty to avoid 400s)
        let result = null;
        if (!leads.length) {
          console.warn('[HP-BG] Skipping upload: No leads scraped for page', page);
          if (!campaignId) console.warn('[HP-BG] campaignId is null – backend may require it');
          result = { skipped: true, reason: 'empty leads' };
        } else {
          console.debug('[HP-BG] Upload payload preview:', JSON.stringify({ count: leads.length, campaignId }));
          result = await postLeadsScrape(leads, campaignId);
        }

        // Update progress
        state.totalSent += leads.length;
        state.pagesDone = Math.max(state.pagesDone, page);
        await chrome.storage.session.set({ [stateKey]: state });

        // Notify popup of progress
        try {
          chrome.runtime.sendMessage({
            action: 'SCRAPE_PROGRESS',
            page,
            pageLimit,
            sentThisPage: leads.length,
            totalSent: state.totalSent,
            pagesDone: state.pagesDone,
            campaignId,
            apiResult: result,
            leads // include for popup preview rendering
          });
        } catch {}

        sendResponse({ ok: true, uploaded: leads.length, result });
      } catch (e) {
        console.error('[HirePilot Background] HP_SCRAPE_CHUNK error:', e);
        try {
          await reportClientError(`HP_SCRAPE_CHUNK failed: ${e?.message || e}`);
        } catch {}
        sendResponse({ error: e?.message || 'Chunk upload failed' });
      }
    })();
    return true; // async
  }

  // Step 2: Relay START/STOP between popup/external and content script
  if (msg.action === 'START_SCRAPE' || msg.action === 'STOP_SCRAPE') {
    (async () => {
      try {
        const pageLimit = msg.pageLimit;
        const campaignId = msg.campaignId;
        try { await chrome.storage.session.set({ hp_autopilot_mode: false, hp_autopilot_started_at: 0 }); } catch {}
        const targetTab = await resolveLinkedInTab(sender?.tab);
        if (!targetTab) return sendResponse({ error: 'No LinkedIn tab available' });
        const resp = await relayToLinkedInTab(targetTab, { action: msg.action, pageLimit, campaignId });
        sendResponse(resp);
      } catch (e) {
        sendResponse({ error: e?.message || 'Failed to relay command' });
      }
    })();
    return true;
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
        // Check daily limit before attempting to send
        try {
          const apiBase = await getApiBase();
          const { hp_jwt } = await chrome.storage.local.get('hp_jwt');
          if (hp_jwt && apiBase) {
            const resp = await fetch(`${apiBase}/linkedin/daily-count`, { headers: { Authorization: `Bearer ${hp_jwt}` } });
            if (resp.ok) {
              const data = await resp.json();
              if (typeof data?.count === 'number' && typeof data?.limit === 'number' && data.count >= data.limit) {
                return sendResponse({ error: 'Daily LinkedIn request limit reached (20/20). Please try again tomorrow.' });
              }
            }
          }
        } catch {}

        // Ensure content script is present and responsive
        try { await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] }); } catch {}

        // Small delay to allow evaluation, then ping
        const pingResp = await new Promise((resolve) => {
          setTimeout(() => {
            try {
              chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (resp) => {
                if (chrome.runtime.lastError) return resolve({ error: chrome.runtime.lastError.message });
                resolve(resp || {});
              });
            } catch {
              resolve({ error: 'ping failed' });
            }
          }, 200);
        });
        if (pingResp && pingResp.error) {
          try { await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] }); } catch {}
        }

        // Relay to content script connect handler
        chrome.tabs.sendMessage(tab.id, { action: 'connectAndSend', message: msg.message }, async (response) => {
          if (chrome.runtime.lastError) return sendResponse({ error: chrome.runtime.lastError.message || 'Failed to message content script' });

          // On success, record credit usage in backend
          if (response && response.ok) {
            try {
              const apiBase = await getApiBase();
              const { hp_jwt } = await chrome.storage.local.get('hp_jwt');
              if (hp_jwt && apiBase) {
                const recordUrl = `${apiBase.replace(/\/api$/, '')}/api/linkedin/record-connect`;
                await fetch(recordUrl, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${hp_jwt}` }
                });
              }
            } catch (e) {
              console.warn('[HirePilot Background] record-connect failed:', e);
            }
          }
          sendResponse(response || { error: 'No response from content script' });
        });
      } catch (e) {
        sendResponse({ error: e?.message || 'Failed to auto-connect' });
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

// External messaging support (HirePilot app autopilot). Validate origin then forward.
chrome.runtime.onMessageExternal?.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const allowed = [
        'https://app.thehirepilot.com',
        'https://www.thehirepilot.com',
        'https://thehirepilot.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ];
      const origin = sender?.origin || sender?.url || '';
      const ok = allowed.some((p) => (origin || '').startsWith(p));
      if (!ok) return sendResponse({ error: 'Origin not allowed' });

      // Simple connectivity check
      if (request?.action === 'PING') {
        return sendResponse({ ok: true });
      }

      // One-time token provisioning from app
      if (request?.action === 'SET_TOKEN') {
        const token = request?.token || '';
        if (!token) return sendResponse({ error: 'Missing token' });
        try { await chrome.storage.local.set({ hp_ext_token: token }); } catch {}
        return sendResponse({ ok: true });
      }

      if (request?.action === 'START_SCRAPE' || request?.action === 'STOP_SCRAPE') {
        // Token validation: compare token with value stored in local storage (set by popup/app)
        try {
          const { hp_ext_token } = await chrome.storage.local.get('hp_ext_token');
          const tokenOk = !!hp_ext_token && hp_ext_token === (request?.token || '');
          if (!tokenOk) return sendResponse({ error: 'Invalid token' });
        } catch {
          return sendResponse({ error: 'Token validation failed' });
        }
        const pageLimit = request.pageLimit;
        const campaignId = request.campaignId;
        const autopilotOn = request.action === 'START_SCRAPE';
        try { await chrome.storage.session.set({ hp_autopilot_mode: autopilotOn, hp_autopilot_started_at: autopilotOn ? Date.now() : 0 }); } catch {}
        const targetTab = await resolveLinkedInTab();
        if (!targetTab) return sendResponse({ error: 'No LinkedIn tab available' });
        try {
          const resp = await relayToLinkedInTab(targetTab, { action: request.action, pageLimit, campaignId });
          sendResponse(resp);
        } catch (e) {
          sendResponse({ error: e?.message || 'Failed to relay command' });
        }
        return; // keep channel open
      }

      sendResponse({ error: 'Unsupported external action' });
    } catch (e) {
      sendResponse({ error: e?.message || 'External message failed' });
    }
  })();
  return true; // async
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
        'a.app-aware-link[href*="/sales/people/"]',
        'a[href*="/sales/people/"]',
        'a[href*="/sales/lead/"]',
        'a[data-anonymize="person-name"]',
        'a.result-lockup__name',
        'a[href*="/in/"]',
        'a.app-aware-link[href*="/in/"]',
        'a.app-aware-link'
      ];
      const nameSelectors = [
        '[data-anonymize="person-name"]',
        '.result-lockup__name',
        '.artdeco-entity-lockup__title',
        'a.app-aware-link span[aria-hidden="true"]',
        'a.app-aware-link strong',
        'span[aria-hidden="true"]',
      ];
      const titleSelectors = [
        '[data-anonymize="headline"]',
        '.result-lockup__highlight',
        '.artdeco-entity-lockup__subtitle',
        '.result-lockup__subtitle',
        'span.t-12, div.t-12'
      ];
      const companySelectors = [
        '[data-anonymize="company-name"]',
        '.result-lockup__misc',
        'span.t-12.t-black--light',
        '.artdeco-entity-lockup__caption',
      ];
      const pick = (root, sels) => {
        for (const s of sels) { const el = root.querySelector(s); const t = toText(el); if (t) return t; }
        return '';
      };
      const pickHref = (root, sels) => {
        for (const s of sels) { const el = root.querySelector(s); const href = el && (el.getAttribute('href') || el.href); if (href) return abs(href); }
        return '';
      };

      items.forEach((el, idx)=>{
        let profileUrl = pickHref(el, linkSelectors);
        let name = pick(el, nameSelectors);
        // Fallback: use anchor text if name not found
        if (!name) {
          const a = el.querySelector('a[href*="/sales/people/"], a[href*="/in/"]') || el.querySelector('a.app-aware-link');
          if (a && a.textContent) name = a.textContent.trim();
        }
        const title = pick(el, titleSelectors);
        let company = pick(el, companySelectors);
        if (!company && /\bat\b/i.test(title)) { const m=title.match(/\bat\s+([^|•,]+)\b/i); if (m) company = m[1].trim(); }
        // Normalize missing link by trying parent anchor
        if (!profileUrl) {
          const a2 = el.querySelector('a');
          if (a2) profileUrl = a2.href || a2.getAttribute('href') || '';
          profileUrl = abs(profileUrl);
        }
        if (profileUrl && name) {
          leads.push({ name, title, company, profileUrl, avatarUrl: '' });
        }
      });

      debug('extracted leads', leads.length);
      if (!leads.length) {
        // Return structured debug so the popup can display details
        const sample = items && items[0] ? (items[0].outerHTML || '').slice(0, 1200) : '';
        return { __hp_debug__: { counts, sample } };
      }
      return leads;
    }
  });
  const leads = Array.isArray(data) ? data : [];
  if (!leads.length) {
    const dbg = (!Array.isArray(data) && data && data.__hp_debug__) ? ` | debug: ${JSON.stringify(data.__hp_debug__)}` : '';
    return { error: 'No visible results on this page. Try scrolling or refining search.' + dbg };
  }
  const result = await handleBulkAddLeads(leads);
  return { leads, result, mode: 'sn_list_injected' };
}