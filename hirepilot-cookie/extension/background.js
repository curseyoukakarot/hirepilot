const API_BASE = 'http://localhost:8080/api';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getFullCookie' || msg.action === 'scrapeSalesNav') {
    // Forward to content script on active LinkedIn tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: 'Not on LinkedIn tab' });
      }
    });
    return true;  // Keep channel open
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

  console.log('[HirePilot Background] JWT token:', jwt.substring(0, 20) + '...');
  console.log('[HirePilot Background] API URL:', `${API_BASE}/leads/bulk-add`);
  console.log('[HirePilot Background] Request payload:', { leads: leads.slice(0, 2) }); // First 2 leads for debugging

  // First test: Try accessing a known working endpoint to test auth
  try {
    console.log('[HirePilot Background] Testing auth with import endpoint...');
    const testResponse = await fetch(`${API_BASE}/leads/import`, {
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

  const response = await fetch(`${API_BASE}/leads/bulk-add`, {
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
