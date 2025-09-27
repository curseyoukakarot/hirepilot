// Minimal controller for Sales Navigator Auto-Scraper UI
(function(){
  const qs = (s)=>document.querySelector(s);
  const pageSlider = qs('#pageSlider');
  const pageSliderValue = qs('#pageSliderValue');
  const startBtn = qs('#startScrapeBtn');
  const stopBtn = qs('#stopScrapeBtn');
  const preset1 = qs('#preset1');
  const preset5 = qs('#preset5');
  const preset10 = qs('#preset10');
  const progressText = qs('#scrapeProgressText');
  const scraperSection = qs('#scraperSection');
  const scraperModeText = qs('#scraperModeText');

  // Reflect slider value
  if (pageSlider && pageSliderValue) {
    const reflect = () => { pageSliderValue.textContent = String(pageSlider.value); };
    reflect();
    pageSlider.addEventListener('input', reflect);
  }

  // Presets
  function setSlider(v) { if (!pageSlider) return; pageSlider.value = String(v); pageSlider.dispatchEvent(new Event('input')); }
  preset1?.addEventListener('click', ()=> setSlider(1));
  preset5?.addEventListener('click', ()=> setSlider(5));
  preset10?.addEventListener('click', ()=> setSlider(10));

  async function getCampaignId() {
    // Prefer storage, fallback to query param provided by app wizard
    try {
      const st = await chrome.storage.local.get(['hp_campaign_id']);
      if (st && st.hp_campaign_id) return st.hp_campaign_id;
    } catch {}
    try {
      const url = new URL(location.href);
      const p = url.searchParams.get('campaignId');
      if (p) return p;
    } catch {}
    return null;
  }

  async function isAutopilotMode() {
    try {
      const st = await chrome.storage.session.get(['hp_autopilot_mode']);
      return !!st.hp_autopilot_mode;
    } catch { return false; }
  }

  // Start/Stop actions
  startBtn?.addEventListener('click', async () => {
    try {
      const pageLimit = Number(pageSlider?.value || 1);
      const campaignId = await getCampaignId();
      chrome.runtime.sendMessage({ action: 'START_SCRAPE', pageLimit, campaignId });
    } catch (e) {
      console.warn('[HP Popup] Start failed:', e);
    }
  });

  stopBtn?.addEventListener('click', async () => {
    try {
      chrome.runtime.sendMessage({ action: 'STOP_SCRAPE' });
    } catch (e) {
      console.warn('[HP Popup] Stop failed:', e);
    }
  });

  // Listen for progress updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'SCRAPE_PROGRESS') {
      const pages = `${msg.pagesDone || 0}/${msg.pageLimit || 0}`;
      const leads = `${msg.totalSent || 0}`;
      if (progressText) progressText.textContent = `Pages: ${pages} • Leads: ${leads}`;
    }
  });

  // Autopilot UI mode: hide controls when triggered externally
  (async () => {
    const auto = await isAutopilotMode();
    if (auto && scraperSection) {
      scraperModeText && (scraperModeText.textContent = 'Autopilot');
      // Keep progress visible, hide Start/Stop and inputs
      startBtn?.classList.add('hidden');
      stopBtn?.classList.add('hidden');
      qs('#preset1')?.classList.add('hidden');
      qs('#preset5')?.classList.add('hidden');
      qs('#preset10')?.classList.add('hidden');
      qs('#pageSlider')?.classList.add('hidden');
      qs('label[for="pageSlider"]')?.classList.add('hidden');
      qs('#pageSliderValue')?.classList.add('hidden');
    }
  })();
})();


