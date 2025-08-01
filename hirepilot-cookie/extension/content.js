// content.js - Injected into LinkedIn pages to handle full cookie access and Sales Nav scraping

console.log('[HirePilot Extension] Content script loaded on:', window.location.href);

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[HirePilot Extension] Received message:', msg);
  
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
      url.includes('/sales/search/people') ||
      url.includes('/sales/search/') ||
      url.includes('linkedin.com/sales/') ||
      url.includes('salesnavigator') ||
      (url.includes('linkedin.com') && url.includes('search'))
    );
    
    console.log('[HirePilot Extension] URL check:', url);
    console.log('[HirePilot Extension] Is Sales Nav search page?', isSalesNavSearch);
    
    if (isSalesNavSearch) {
      console.log('[HirePilot Extension] ✅ On Sales Nav page, starting scrape');
      scrapeLeads()
        .then(leads => {
          console.log('[HirePilot Extension] Scrape successful:', leads.length, 'leads');
          sendResponse({ leads });
        })
        .catch(err => {
          console.error('[HirePilot Extension] Scrape error:', err);
          sendResponse({ error: err.message });
        });
    } else {
      const error = 'Not on Sales Navigator search page. Current URL: ' + url;
      console.warn('[HirePilot Extension] ❌', error);
      sendResponse({ error });
    }
    return true;  // Async response
  }
});

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
  const initialResults = document.querySelectorAll('.artdeco-entity-lockup');
  console.log('[HirePilot Extension] Results found BEFORE scrolling:', initialResults.length);

  // Scroll to load all results on the page
  console.log('[HirePilot Extension] Scrolling to load all results...');
  await scrollToLoadAllResults();

  // Check again after scrolling
  const finalResults = document.querySelectorAll('.artdeco-entity-lockup');
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