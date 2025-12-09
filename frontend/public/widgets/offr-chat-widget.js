(function () {
  if (window.__offrChatWidgetLoaded) return;
  window.__offrChatWidgetLoaded = true;

  var currentScript = document.currentScript;
  var apiBaseAttr = currentScript && currentScript.getAttribute('data-api-base');
  var calendlyAttr = currentScript && currentScript.getAttribute('data-calendly-url');

  var API_BASE = (apiBaseAttr || 'https://api.thehirepilot.com').replace(/\/$/, '');
  var CHAT_ENDPOINT = API_BASE + '/api/public-chat/offr';
  var LIVE_ENDPOINT = API_BASE + '/api/offr-livechat/messages';
  var LEAD_ENDPOINT = API_BASE + '/api/public-leads/offr';
  var CALENDLY_URL = calendlyAttr || 'https://calendly.com/offr-group/introductory-call';

  var sessionKey = 'offr:sessionId';
  function getSessionId() {
    try {
      var existing = localStorage.getItem(sessionKey);
      if (existing) return existing;
    } catch {}
    var id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'session_' + Date.now();
    try { localStorage.setItem(sessionKey, id); } catch {}
    return id;
  }

  function ensureRoot() {
    var root = document.getElementById('offr-chat-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'offr-chat-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = "\n      * { font-family: 'Inter', sans-serif; }\n      #offr-chat-root { position: relative; z-index: 2147483000; }\n      .offr-hidden { display: none !important; }\n      .offr-chat-bubble-enter { animation: offrBubbleIn 0.25s ease-out; }\n      @keyframes offrBubbleIn { from { opacity: 0; transform: translateY(10px) scale(0.95);} to { opacity:1; transform: translateY(0) scale(1);} }\n      .offr-panel-enter { animation: offrPanelIn 0.25s ease-out; }\n      @keyframes offrPanelIn { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform: translateY(0);} }\n      .offr-scroll::-webkit-scrollbar { width: 6px; }\n      .offr-scroll::-webkit-scrollbar-track { background: #1e293b; }\n      .offr-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }\n      .offr-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }\n    ";
    document.head.appendChild(style);
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === 'string') el.textContent = text;
    return el;
  }

  function buildUi() {
    var root = ensureRoot();
    // Launcher
    var launcher = createEl('button', 'offr-launcher offr-chat-bubble-enter');
    launcher.setAttribute('aria-label', 'Open Offr chat');
    launcher.style.position = 'fixed';
    launcher.style.right = '24px';
    launcher.style.bottom = '24px';
    launcher.style.width = '64px';
    launcher.style.height = '64px';
    launcher.style.borderRadius = '50%';
    launcher.style.border = 'none';
    launcher.style.cursor = 'pointer';
    launcher.style.boxShadow = '0 20px 40px rgba(0,0,0,0.25)';
    launcher.style.background = 'linear-gradient(135deg, #2563eb, #7c3aed)';
    launcher.style.color = '#fff';
    launcher.style.display = 'flex';
    launcher.style.alignItems = 'center';
    launcher.style.justifyContent = 'center';
    launcher.style.fontSize = '24px';
    launcher.style.zIndex = '2147483001';
    launcher.innerHTML = '💬';
    root.appendChild(launcher);

    // Panel
    var panel = createEl('div', 'offr-panel offr-panel-enter offr-hidden');
    panel.style.position = 'fixed';
    panel.style.right = '16px';
    panel.style.bottom = '16px';
    panel.style.width = '360px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    panel.style.height = '520px';
    panel.style.maxHeight = '80vh';
    panel.style.background = 'linear-gradient(135deg, #0f172a, #111827)';
    panel.style.borderRadius = '18px';
    panel.style.border = '1px solid #1f2937';
    panel.style.boxShadow = '0 20px 60px rgba(0,0,0,0.45)';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.zIndex = '2147483002';
    root.appendChild(panel);

    // Header
    var header = createEl('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '12px 14px';
    header.style.background = 'linear-gradient(90deg, #2563eb, #7c3aed)';
    header.style.borderTopLeftRadius = '18px';
    header.style.borderTopRightRadius = '18px';
    var left = createEl('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '10px';
    var avatar = createEl('div', '', 'OG');
    avatar.style.width = '36px';
    avatar.style.height = '36px';
    avatar.style.borderRadius = '50%';
    avatar.style.background = '#fff';
    avatar.style.color = '#0f172a';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.fontWeight = '700';
    avatar.style.fontSize = '13px';
    var titles = createEl('div');
    var title = createEl('div', '', 'Offr Group Assistant');
    title.style.color = '#fff';
    title.style.fontWeight = '600';
    title.style.fontSize = '13px';
    var subtitle = createEl('div', '', 'Ask about hiring & services');
    subtitle.style.color = 'rgba(255,255,255,0.8)';
    subtitle.style.fontSize = '12px';
    titles.appendChild(title);
    titles.appendChild(subtitle);
    left.appendChild(avatar);
    left.appendChild(titles);
    var closeBtn = createEl('button', '', '×');
    closeBtn.style.color = '#fff';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.onmouseenter = function () { closeBtn.style.background = 'rgba(255,255,255,0.1)'; };
    closeBtn.onmouseleave = function () { closeBtn.style.background = 'transparent'; };
    header.appendChild(left);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Tabs
    var tabs = createEl('div');
    tabs.style.display = 'flex';
    tabs.style.gap = '8px';
    tabs.style.padding = '10px 12px';
    tabs.style.background = '#0f172a';
    tabs.style.borderBottom = '1px solid #1f2937';
    var aiTab = createEl('button', '', 'AI Assistant');
    var liveTab = createEl('button', '', 'Live Chat');
    [aiTab, liveTab].forEach(function (btn) {
      btn.style.border = 'none';
      btn.style.borderRadius = '999px';
      btn.style.padding = '6px 12px';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 120ms ease';
    });
    aiTab.style.background = '#2563eb';
    aiTab.style.color = '#fff';
    liveTab.style.background = '#1f2937';
    liveTab.style.color = '#cbd5e1';
    tabs.appendChild(aiTab);
    tabs.appendChild(liveTab);
    panel.appendChild(tabs);

    // Messages
    var messagesWrap = createEl('div', 'offr-scroll');
    messagesWrap.style.flex = '1';
    messagesWrap.style.overflowY = 'auto';
    messagesWrap.style.padding = '12px';
    messagesWrap.style.display = 'flex';
    messagesWrap.style.flexDirection = 'column';
    messagesWrap.style.gap = '10px';
    panel.appendChild(messagesWrap);

    // Lead form
    var leadCard = createEl('div', 'offr-hidden');
    leadCard.style.background = '#1f2937';
    leadCard.style.border = '1px solid #273449';
    leadCard.style.borderRadius = '12px';
    leadCard.style.padding = '12px';
    leadCard.style.display = 'flex';
    leadCard.style.flexDirection = 'column';
    leadCard.style.gap = '8px';
    var leadTitle = createEl('div', '', "Let's connect you with the right person");
    leadTitle.style.color = '#fff';
    leadTitle.style.fontWeight = '600';
    leadTitle.style.fontSize = '13px';
    leadCard.appendChild(leadTitle);
    function leadInput(placeholder, key, type) {
      var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type || 'text';
      input.placeholder = placeholder;
      input.dataset.key = key;
      input.style.width = '100%';
      input.style.background = '#111827';
      input.style.color = '#fff';
      input.style.border = '1px solid #273449';
      input.style.borderRadius = '8px';
      input.style.padding = '8px';
      input.style.fontSize = '13px';
      input.style.outline = 'none';
      input.onfocus = function () { input.style.borderColor = '#2563eb'; };
      input.onblur = function () { input.style.borderColor = '#273449'; };
      if (type === 'textarea') {
        input.rows = 2;
        input.style.resize = 'none';
      }
      return input;
    }
    var fields = [
      leadInput('First name *', 'firstName', 'text'),
      leadInput('Last name *', 'lastName', 'text'),
      leadInput('Email *', 'email', 'email'),
      leadInput('Phone', 'phone', 'tel'),
      leadInput('LinkedIn', 'linkedin', 'text'),
      leadInput('Company', 'company', 'text'),
      leadInput('What are you hiring for?', 'hiringFor', 'textarea'),
    ];
    fields.forEach(function (f) { leadCard.appendChild(f); });
    var leadSubmit = createEl('button', '', 'Submit details');
    leadSubmit.style.border = 'none';
    leadSubmit.style.borderRadius = '10px';
    leadSubmit.style.padding = '10px';
    leadSubmit.style.background = 'linear-gradient(90deg, #2563eb, #7c3aed)';
    leadSubmit.style.color = '#fff';
    leadSubmit.style.fontWeight = '600';
    leadSubmit.style.cursor = 'pointer';
    leadCard.appendChild(leadSubmit);
    messagesWrap.appendChild(leadCard);

    // Composer
    var composer = createEl('div');
    composer.style.padding = '10px';
    composer.style.borderTop = '1px solid #1f2937';
    composer.style.background = '#0f172a';
    var form = createEl('div');
    form.style.display = 'flex';
    form.style.gap = '8px';
    var textarea = document.createElement('textarea');
    textarea.rows = 1;
    textarea.placeholder = 'Type your message...';
    textarea.style.flex = '1';
    textarea.style.resize = 'none';
    textarea.style.background = '#1f2937';
    textarea.style.color = '#fff';
    textarea.style.border = '1px solid #273449';
    textarea.style.borderRadius = '10px';
    textarea.style.padding = '10px';
    textarea.style.fontSize = '13px';
    textarea.style.outline = 'none';
    textarea.onfocus = function () { textarea.style.borderColor = '#2563eb'; };
    textarea.onblur = function () { textarea.style.borderColor = '#273449'; };
    var sendBtn = createEl('button', '', '➤');
    sendBtn.style.border = 'none';
    sendBtn.style.width = '42px';
    sendBtn.style.height = '42px';
    sendBtn.style.borderRadius = '12px';
    sendBtn.style.background = 'linear-gradient(135deg, #2563eb, #7c3aed)';
    sendBtn.style.color = '#fff';
    sendBtn.style.fontSize = '16px';
    sendBtn.style.cursor = 'pointer';
    form.appendChild(textarea);
    form.appendChild(sendBtn);
    composer.appendChild(form);
    panel.appendChild(composer);

    return {
      launcher: launcher,
      panel: panel,
      closeBtn: closeBtn,
      aiTab: aiTab,
      liveTab: liveTab,
      messagesWrap: messagesWrap,
      leadCard: leadCard,
      leadFields: fields,
      leadSubmit: leadSubmit,
      textarea: textarea,
      sendBtn: sendBtn,
    };
  }

  function renderMessage(container, message) {
    var row = createEl('div');
    row.style.display = 'flex';
    row.style.justifyContent = message.type === 'user' ? 'flex-end' : 'flex-start';
    var bubble = createEl('div');
    bubble.style.maxWidth = '80%';
    bubble.style.padding = '10px 12px';
    bubble.style.borderRadius = '14px';
    bubble.style.fontSize = '13px';
    bubble.style.lineHeight = '1.5';
    bubble.style.wordBreak = 'break-word';
    if (message.type === 'user') {
      bubble.style.background = '#2563eb';
      bubble.style.color = '#fff';
      bubble.style.borderBottomRightRadius = '4px';
    } else {
      bubble.style.background = '#1f2937';
      bubble.style.color = '#e5e7eb';
      bubble.style.borderBottomLeftRadius = '4px';
    }
    bubble.textContent = message.text || '';
    if (message.showCalendly) {
      var btn = createEl('button', '', 'Book a call');
      btn.style.marginTop = '8px';
      btn.style.width = '100%';
      btn.style.border = 'none';
      btn.style.borderRadius = '10px';
      btn.style.padding = '10px';
      btn.style.background = '#7c3aed';
      btn.style.color = '#fff';
      btn.style.fontWeight = '600';
      btn.style.cursor = 'pointer';
      btn.onclick = function () { window.open(CALENDLY_URL, '_blank'); };
      bubble.appendChild(btn);
    }
    row.appendChild(bubble);
    container.appendChild(row);
  }

  function renderTyping(container, show) {
    var existing = container.querySelector('.offr-typing');
    if (existing) existing.remove();
    if (!show) return;
    var wrap = createEl('div', 'offr-typing');
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'flex-start';
    var bubble = createEl('div');
    bubble.style.background = '#1f2937';
    bubble.style.color = '#e5e7eb';
    bubble.style.padding = '8px 10px';
    bubble.style.borderRadius = '12px';
    bubble.style.borderBottomLeftRadius = '4px';
    bubble.style.display = 'flex';
    bubble.style.gap = '4px';
    bubble.style.alignItems = 'center';
    function dot(delay) {
      var d = createEl('div');
      d.style.width = '6px';
      d.style.height = '6px';
      d.style.borderRadius = '50%';
      d.style.background = '#cbd5e1';
      d.style.animation = 'offrDot 1s infinite';
      d.style.animationDelay = delay;
      return d;
    }
    bubble.appendChild(dot('0ms'));
    bubble.appendChild(dot('150ms'));
    bubble.appendChild(dot('300ms'));
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    var style = document.getElementById('offr-dot-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'offr-dot-style';
      style.textContent = "@keyframes offrDot { 0% { opacity: 0.4; transform: translateY(0);} 50% { opacity: 1; transform: translateY(-2px);} 100% { opacity: 0.4; transform: translateY(0);} }";
      document.head.appendChild(style);
    }
  }

  function main() {
    injectStyles();
    var ui = buildUi();
    var isOpen = false;
    var activeTab = 'ai';
    var messages = [];
    var sessionId = getSessionId();
    var showLeadForm = false;

    function togglePanel(show) {
      isOpen = show;
      ui.panel.classList.toggle('offr-hidden', !isOpen);
    }

    var liveNoticeShown = false;
    var livePingSent = false;
    function setTab(tab) {
      activeTab = tab;
      ui.aiTab.style.background = tab === 'ai' ? '#2563eb' : '#1f2937';
      ui.aiTab.style.color = tab === 'ai' ? '#fff' : '#cbd5e1';
      ui.liveTab.style.background = tab === 'live' ? '#7c3aed' : '#1f2937';
      ui.liveTab.style.color = tab === 'live' ? '#fff' : '#cbd5e1';
      if (tab === 'live' && !liveNoticeShown) {
        addMessage({
          id: 'live_notice',
          type: 'assistant',
          text: 'You switched to live chat — please wait a moment while a team member is called.',
        });
        liveNoticeShown = true;
        if (!livePingSent) {
          livePingSent = true;
          try {
            fetch(LIVE_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: 'Visitor opened live chat',
                session_id: sessionId,
                page_url: (window.parent && window.parent.location ? window.parent.location.href : window.location.href)
              }),
            }).catch(() => {});
          } catch {}
        }
      }
    }

    function scrollBottom() {
      setTimeout(function () {
        ui.messagesWrap.scrollTop = ui.messagesWrap.scrollHeight + 200;
      }, 20);
    }

    function renderAll() {
      ui.messagesWrap.innerHTML = '';
      messages.forEach(function (m) { renderMessage(ui.messagesWrap, m); });
      if (showLeadForm) {
        ui.leadCard.classList.remove('offr-hidden');
        ui.messagesWrap.appendChild(ui.leadCard);
      } else {
        ui.leadCard.classList.add('offr-hidden');
      }
      scrollBottom();
    }

    function addMessage(msg) {
      messages.push(msg);
      renderAll();
    }

    function welcome() {
      addMessage({
        id: 'welcome',
        type: 'assistant',
        text: "Hey, I'm the Offr Group assistant. I can walk you through contingency, executive, RPO, BPO, and staffing options — or help you figure out what you actually need.",
      });
    }

    ui.launcher.onclick = function () {
      togglePanel(true);
      if (messages.length === 0) welcome();
    };
    ui.closeBtn.onclick = function () { togglePanel(false); };
    ui.aiTab.onclick = function () { setTab('ai'); };
    ui.liveTab.onclick = function () { setTab('live'); };

    function sendMessage() {
      var text = ui.textarea.value.trim();
      if (!text) return;
      ui.textarea.value = '';
      addMessage({ id: 'u_' + Date.now(), type: 'user', text: text });
      renderTyping(ui.messagesWrap, true);
      scrollBottom();
      var body = { message: text, session_id: sessionId, page_url: (window.parent && window.parent.location ? window.parent.location.href : window.location.href) };
      if (activeTab === 'ai') {
        var history = messages.slice(-9).map(function (m) { return { role: m.type === 'user' ? 'user' : 'assistant', text: m.text }; });
        body.history = history;
      }
      var endpoint = activeTab === 'ai' ? CHAT_ENDPOINT : LIVE_ENDPOINT;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          renderTyping(ui.messagesWrap, false);
          if (data && data.session_id && data.session_id !== sessionId) {
            sessionId = data.session_id;
            try { localStorage.setItem(sessionKey, sessionId); } catch {}
          }
          addMessage({
            id: 'a_' + Date.now(),
            type: activeTab === 'ai' ? 'assistant' : 'agent',
            text: data.response || data.message || "Thanks for your message. We'll get back to you shortly.",
            showCalendly: !!data.calendly_link,
          });
          if (data.capture_lead) {
            showLeadForm = true;
            renderAll();
          }
        })
        .catch(function () {
          renderTyping(ui.messagesWrap, false);
          addMessage({ id: 'err_' + Date.now(), type: 'assistant', text: "Sorry, I'm having trouble connecting. Please try again." });
        });
    }

    ui.sendBtn.onclick = sendMessage;
    ui.textarea.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    ui.leadSubmit.onclick = function () {
      var payload = {};
      ui.leadFields.forEach(function (f) {
        payload[f.dataset.key] = f.value.trim();
      });
      if (!payload.firstName || !payload.lastName || !payload.email) {
        alert('Please fill in First name, Last name, and Email');
        return;
      }
      payload.session_id = sessionId;
      payload.source = 'website_chat';
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone || null,
          linkedin: payload.linkedin || null,
          company: payload.company || null,
          hiringFor: payload.hiringFor || null,
          session_id: sessionId,
          source: 'website_chat',
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          showLeadForm = false;
          addMessage({
            id: 'lead_' + Date.now(),
            type: 'assistant',
            text: "Perfect! I've got your details. Ready to book a quick intro call?",
            showCalendly: true,
          });
        })
        .catch(function () {
          alert('Error submitting details. Please try again.');
        });
    };

    // Auto-open welcome on first load if desired
    // togglePanel(true); welcome();
  }

  main();
})();

