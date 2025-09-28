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
  const tabSingle = qs('#tabSingle');
  const tabBulk = qs('#tabBulk');
  const bulkMode = qs('#bulkMode');
  const bulkList = qs('#bulkList');
  const progressSeen = {};
  const pageCounts = {};
  let bulkPreview = [];

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

  function showTab(mode){
    if (mode === 'bulk') {
      tabBulk?.classList.add('active');
      tabSingle?.classList.remove('active');
      bulkMode?.classList.remove('hidden');
      scraperSection?.classList.remove('hidden');
      // Render any existing preview
      renderBulkList(bulkPreview);
    } else {
      tabSingle?.classList.add('active');
      tabBulk?.classList.remove('active');
      bulkMode?.classList.add('hidden');
      scraperSection?.classList.add('hidden');
    }
  }
  tabBulk?.addEventListener('click', ()=> showTab('bulk'));
  tabSingle?.addEventListener('click', ()=> showTab('single'));

  function renderBulkList(leads){
    if (!bulkList) return;
    bulkList.innerHTML = '';
    const frag = document.createDocumentFragment();
    (leads || []).forEach((lead, idx)=>{
      const row = document.createElement('div');
      row.className = 'list-row';
      const safeName = (lead.name || '').replace(/</g,'&lt;');
      const safeTitle = (lead.title || '').replace(/</g,'&lt;');
      const safeCompany = (lead.company || '').replace(/</g,'&lt;');
      const profile = lead.profileLink || '#';
      row.innerHTML = `
        <label class="row align-center gap" style="padding:6px 0;">
          <input type="checkbox" class="chk" data-i="${idx}" checked>
          <img src="img/icon48.png" class="avatar" style="width:24px;height:24px;border-radius:12px;">
          <div style="flex:1; min-width:0;">
            <div class="lead-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>
            <div class="lead-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeTitle}${safeCompany? ' • '+safeCompany:''}</div>
          </div>
          <a href="${profile}" target="_blank" rel="noreferrer" class="btn" style="padding:2px 6px;">↗</a>
        </label>`;
      frag.appendChild(row);
    });
    bulkList.appendChild(frag);
  }

  async function getCampaignId() {
    // Prefer storage, fallback to query param provided by app wizard, then a test default
    try {
      const st = await chrome.storage.local.get(['hp_campaign_id','currentCampaignId']);
      if (st && st.hp_campaign_id) return st.hp_campaign_id;
      if (st && st.currentCampaignId) return st.currentCampaignId;
    } catch {}
    try {
      const url = new URL(location.href);
      const p = url.searchParams.get('campaignId');
      if (p) return p;
    } catch {}
    console.warn('[HP Popup] No campaignId found; using default-campaign');
    return 'default-campaign';
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
      console.debug('[HP Popup] Start clicked, sending START_SCRAPE with', { pageLimit, campaignId });
      chrome.runtime.sendMessage({ action: 'START_SCRAPE', pageLimit, campaignId }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn('[HP Popup] Start error:', chrome.runtime.lastError.message);
          if (progressText) progressText.textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        console.debug('[HP Popup] Start response:', resp);
        if (resp && resp.error) {
          if (progressText) progressText.textContent = `Error: ${resp.error}`;
        } else if (progressText) {
          progressText.textContent = 'Started. Preloading…';
        }
      });
    } catch (e) {
      console.warn('[HP Popup] Start failed:', e);
      if (progressText) progressText.textContent = `Error: ${e?.message || e}`;
    }
  });

  stopBtn?.addEventListener('click', async () => {
    try {
      console.debug('[HP Popup] Stop clicked, sending STOP_SCRAPE');
      chrome.runtime.sendMessage({ action: 'STOP_SCRAPE' });
    } catch (e) {
      console.warn('[HP Popup] Stop failed:', e);
    }
  });

  // Listen for progress updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'SCRAPE_PROGRESS') {
      if (!Number.isFinite(msg.page)) return;
      if (progressSeen[msg.page]) return; // de-dupe simple
      progressSeen[msg.page] = true;
      pageCounts[msg.page] = Number(msg.sentThisPage || 0);
      // Store preview
      if (Array.isArray(msg.leads) && msg.leads.length) {
        bulkPreview = msg.leads;
        if (!scraperSection?.classList.contains('hidden') && bulkMode && !bulkMode.classList.contains('hidden')) {
          renderBulkList(bulkPreview);
        }
      }
      console.debug('[HP Popup] Progress update:', msg);
      const pages = `${msg.pagesDone || 0}/${msg.pageLimit || 0}`;
      const leads = `${msg.totalSent || 0}`;
      if (progressText) progressText.textContent = `Pages: ${pages} • Leads: ${leads}`;
    }
    if (msg && msg.action === 'SCRAPE_RUN_SUMMARY') {
      const total = msg?.totalLeads || msg?.totalSent || 0;
      const pagesDone = msg?.pagesDone || msg?.currentPage || 0;
      const orderedPages = Object.keys(pageCounts).map(n=>Number(n)).sort((a,b)=>a-b);
      const breakdown = orderedPages.map(p=>pageCounts[p]).join(', ');
      if (progressText) progressText.textContent = `Done. Found ${total} leads across ${pagesDone} page${pagesDone===1?'':'s'}${breakdown?` (per-page: [${breakdown}])`:''}.`;
    }
  });

  // Default to Single tab on load; Bulk tab reveals scraper controls on demand
  showTab('single');

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


