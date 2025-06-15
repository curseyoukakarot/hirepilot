import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lqcsassinqfruvpgcooo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxY3Nhc3NpbnFmcnV2cGdjb29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NTYzNTQsImV4cCI6MjA1OTAzMjM1NH0._s3bVTIJCDQCS2WCgOqE5WvMvMDtJ9tjgslR5om7DHw'
);

const q = id => document.getElementById(id) || console.warn(`#${id} not found`);

const loginSection = q('loginSection');
const mainSection  = q('mainSection');
const statusEl     = q('status');
const helloEl      = q('hello');

const loginBtn  = q('loginBtn');
const uploadBtn = q('uploadBtn');
const logoutBtn = q('logoutBtn');

const API   = 'https://api.thehirepilot.com/api/linkedin/save-cookie';

const emailInput = q('email');
const pwInput = q('password');
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
  statusEl.textContent = '';
  if (userEmail && email) userEmail.textContent = email;
}

function isLoggedIn() {
  return !!localStorage.getItem('hp_user_id');
}

// On load, show correct section
if (isLoggedIn()) {
  showMain(localStorage.getItem('hp_user_email'));
} else {
  showLogin();
}

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
    showStatus(error.message, true);
    btnState('loginBtn', 'Log In', false);
    return;
  }
  localStorage.setItem('hp_user_id', data.user.id);
  localStorage.setItem('hp_jwt', data.session.access_token);
  localStorage.setItem('hp_user_email', data.user.email);
  flipToMain(data.user.email);
};

logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('hp_user_id');
  localStorage.removeItem('hp_jwt');
  localStorage.removeItem('hp_user_email');
  showLogin();
});

if (uploadBtn) uploadBtn.onclick = async () => {
  btnState('uploadBtn', 'Uploading…', true, true);
  statusEl.textContent = '⏳ grabbing cookie…';
  const { li_at, ua } = await chrome.runtime.sendMessage('getCookie').catch(() => ({}));
  if (!li_at) {
    showStatus('❌ No li_at cookie – open linkedin.com & log-in first', true);
    btnState('uploadBtn', 'Copy & Upload LinkedIn Cookie', false, false);
    return;
  }
  await navigator.clipboard.writeText(li_at).catch(()=>{});
  const userId = localStorage.getItem('hp_user_id');
  const jwt = localStorage.getItem('hp_jwt');
  if (!userId || !jwt) {
    showStatus('❌ No user ID or token found – please log in first.', true);
    btnState('uploadBtn', 'Copy & Upload LinkedIn Cookie', false, false);
    return;
  }
  try {
    const res = await fetch(API, {
      method : 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body   : JSON.stringify({ user_id: userId, session_cookie: li_at, user_agent: ua || navigator.userAgent })
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`${res.status}: ${msg}`);
    }
    showStatus('✅ Cookie saved!', false);
  } catch (e) {
    showStatus('❌ Upload failed – ' + e.message, true);
  } finally {
    btnState('uploadBtn', 'Copy & Upload LinkedIn Cookie', false, false);
  }
};

function flipToMain(email) {
  helloEl.textContent = `Logged in as ${email}`;
  loginSection.hidden = true;
  mainSection.hidden  = false;
  btnState('loginBtn', 'Log In', false);
}

function flipToLogin() {
  mainSection.hidden  = true;
  loginSection.hidden = false;
  showStatus('');
}

function showStatus(msg = '', isErr = false) {
  const el = statusEl;
  if (!el) {
    console.warn('#status element missing');
    return;
  }
  el.textContent = msg;
  el.className = msg ? (isErr ? 'err' : 'ok') : '';
}

// On load, show correct section
if (localStorage.getItem('hp_user_id')) {
  flipToMain(localStorage.getItem('hp_user_email'));
} else {
  flipToLogin();
}