import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lqcsassinqfruvpgcooo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3Nhc3NpbnFmcnV2cGdjb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NTYzNTQsImV4cCI6MjA1OTAzMjM1NH0._s3bVTIJCDQCS2WCgOqE5WvMvMDtJ9tjgslR5om7DHw'
);

const q = id => document.getElementById(id) || console.warn(`#${id} not found`);

const loginSection = q('loginSection');
const mainSection  = q('mainSection');
const loginStatusEl = q('loginStatus');
const mainStatusEl  = q('mainStatus');

const loginBtn  = q('loginBtn');
const uploadBtn = q('uploadBtn');
const scrapeBtn = q('scrapeBtn');
const logoutBtn = q('logoutBtn');

const API   = 'http://localhost:8080/api/linkedin/save-cookie';

const emailInput = q('email');
const pwInput = q('pw');
const userEmail = q('userEmail');

function showLogin() {
  loginSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
  emailInput.value = '';
  pwInput.value = '';
}

function showMain(email) {
  loginSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
  mainStatusEl.textContent = '';
  if (userEmail && email) userEmail.textContent = email;
}

async function isLoggedIn() {
  const result = await chrome.storage.local.get('hp_user_id');
  return !!result.hp_user_id;
}

// On load, show correct section (now async)
async function initializeUI() {
  if (await isLoggedIn()) {
    const result = await chrome.storage.local.get('hp_user_email');
    showMain(result.hp_user_email);
  } else {
    showLogin();
  }
}
initializeUI();

function btnState(id, text, disabled, loading = false) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`#${id} not found`);
    return;
  }
  el.textContent = text;
  el.disabled = disabled;
  el.classList.toggle('loading', loading);
}

if (loginBtn) loginBtn.onclick = async () => {
  const email = emailInput.value;
  const password = pwInput.value;
  btnState('loginBtn', 'Logging in…', true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log('login result', { data, error });
  if (error) {
    showStatus(error.message, true, true);  // Login section status
    btnState('loginBtn', 'Log In', false);
    return;
  }
      await chrome.storage.local.set({
      hp_user_id: data.user.id,
      hp_jwt: data.session.access_token,
      hp_user_email: data.user.email
    });
    btnState('loginBtn', 'Sign In', false);
    showMain(data.user.email);
};

logoutBtn?.addEventListener('click', async () => {
  await chrome.storage.local.remove(['hp_user_id', 'hp_jwt', 'hp_user_email']);
  showLogin();
});

if (uploadBtn) uploadBtn.onclick = async () => {
  btnState('uploadBtn', 'Uploading…', true, true);
  showStatus('⌛ Grabbing full cookie...', false);  // Main section status
  
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getFullCookie' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Please open a LinkedIn page first'));
        } else {
          resolve(response);
        }
      });
    });
    
    // Handle case where content script isn't available
    if (!response) {
      showStatus('❌ Please open a LinkedIn page first', true);
      btnState('uploadBtn', 'Upload Full LinkedIn Cookie', false, false);
      return;
    }
    
    if (response.error) {
      showStatus(`❌ ${response.error}`, true);
      btnState('uploadBtn', 'Upload Full LinkedIn Cookie', false, false);
      return;
    }
    
    if (!response.fullCookie) {
      showStatus('❌ No cookie found - log in to LinkedIn first', true);
      btnState('uploadBtn', 'Upload Full LinkedIn Cookie', false, false);
      return;
    }
    
    const storage = await chrome.storage.local.get(['hp_user_id', 'hp_jwt']);
    const userId = storage.hp_user_id;
    const jwt = storage.hp_jwt;
    if (!userId || !jwt) {
      showStatus('❌ No user ID or token - log in first', true);
      btnState('uploadBtn', 'Upload Full LinkedIn Cookie', false, false);
      return;
    }
    
    const res = await fetch(API, {
      method : 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body   : JSON.stringify({ 
        user_id: userId, 
        session_cookie: response.fullCookie,  // Now full cookie string
        user_agent: navigator.userAgent 
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${res.status}: ${errorText}`);
    }
    
    showStatus('✅ Full cookie saved!', false);
  } catch (e) {
    console.error('Upload error:', e);
    showStatus('❌ Upload failed - ' + e.message, true);
  } finally {
    btnState('uploadBtn', 'Upload Full LinkedIn Cookie', false, false);
  }
};

// Sales Navigator scraping functionality
if (scrapeBtn) scrapeBtn.onclick = async () => {
  btnState('scrapeBtn', 'Scraping...', true);
  showStatus('⌛ Scraping leads...', false);  // Main section status

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'scrapeSalesNav' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Please open a Sales Navigator search page first'));
        } else {
          resolve(response);
        }
      });
    });
    console.log('Scrape response:', response);
    
    // Handle case where content script isn't available
    if (!response) {
      showStatus('❌ Please open a Sales Navigator search page first', true);
    } else if (response.error) {
      showStatus(`❌ ${response.error}`, true);
    } else if (response.leads) {
      const result = response.result || {};
      const creditsCharged = result.creditsCharged || response.leads.length;
      showStatus(`✅ Added ${response.leads.length} leads to HirePilot! (${creditsCharged} credits charged)`, false);
    } else {
      showStatus('❌ No response from content script', true);
    }
  } catch (e) {
    console.error('Scrape error:', e);
    showStatus('❌ Scraping failed - ' + e.message, true);
  } finally {
    btnState('scrapeBtn', 'Scrape Sales Nav Leads', false);
  }
};



function showStatus(msg = '', isErr = false, isLogin = false) {
  const el = isLogin ? loginStatusEl : mainStatusEl;
  if (!el) {
    console.warn(`#${isLogin ? 'loginStatus' : 'mainStatus'} element missing`);
    return;
  }
  
  if (isLogin) {
    // Login status (simple styling)
    el.textContent = msg;
    el.className = msg ? (isErr ? 'status-message err' : 'status-message ok') : 'status-message';
  } else {
    // Main status (with enhanced styling and status section parent)
    el.textContent = msg;
    const statusSection = el.closest('.status-section');
    
    if (statusSection) {
      statusSection.className = 'status-section';
      
      if (msg) {
        if (isErr) {
          statusSection.classList.add('error');
        } else if (msg.includes('⌛') || msg.includes('Scraping') || msg.includes('Grabbing')) {
          statusSection.classList.add('loading');
        } else if (msg.includes('✅') || msg.includes('Added') || msg.includes('saved')) {
          statusSection.classList.add('success');
        }
      }
    }
    
    // Update default message when cleared
    if (!msg) {
      el.textContent = 'Ready to extract leads';
    }
  }
}

// On load, show correct section (handled by initializeUI above)