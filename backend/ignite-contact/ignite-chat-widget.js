/* ignite-bot — IgniteGTM website chat widget.
   Same architecture as the Offr Group widget: AI Assistant tab + Slack-bridged
   Live Chat tab. Embed with:
   <script src="https://contact.ignitegtm.com/ignite-chat-widget.js" defer></script>
   Optional overrides: data-api-base, data-calendly-url. */
(function () {
  if (window.__igniteChatWidgetLoaded) return;
  window.__igniteChatWidgetLoaded = true;

  var currentScript = document.currentScript;
  var apiBaseAttr = currentScript && currentScript.getAttribute('data-api-base');
  var calendlyAttr = currentScript && currentScript.getAttribute('data-calendly-url');

  var API_BASE = (apiBaseAttr || 'https://contact.ignitegtm.com').replace(/\/$/, '');
  var CHAT_ENDPOINT = API_BASE + '/api/public-chat/ignite';
  var LIVE_ENDPOINT = API_BASE + '/api/ignite-livechat/messages';
  var LEAD_ENDPOINT = API_BASE + '/api/public-leads/ignite';
  var OPEN_ENDPOINT = API_BASE + '/api/ignite-bot/chat-open';
  var CALENDLY_URL = calendlyAttr || 'https://calendly.com/ignitegtm/meeting-30m-with-bill-barry';

  // brand
  var C = {
    dark: '#0b0b0e',
    panel: '#121216',
    line: '#26262d',
    card: '#17171c',
    text: '#e7e7ea',
    dim: '#9a9aa3',
    yellow: '#FFC501',
    amber: '#FF8A00',
    ember: '#FF3D00',
    red: '#FF0000',
    ink: '#050506',
    grad: 'linear-gradient(100deg, #FF3D00 0%, #FF8A00 55%, #FFC501 100%)',
  };
  var SLASH_SVG = '<svg viewBox="0 0 100 100" width="22" height="22" aria-hidden="true"><polygon points="43,15 91,15 57,85 9,85" fill="' + C.red + '"/></svg>';

  var sessionKey = 'ignite:sessionId';
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
    var root = document.getElementById('ignite-chat-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'ignite-chat-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = "\n      #ignite-chat-root { position: relative; z-index: 2147483000; font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; }\n      #ignite-chat-root * { font-family: inherit; box-sizing: border-box; }\n      .ign-hidden { display: none !important; }\n      .ign-bubble-enter { animation: ignBubbleIn 0.25s ease-out; }\n      @keyframes ignBubbleIn { from { opacity: 0; transform: translateY(10px) scale(0.95);} to { opacity:1; transform: translateY(0) scale(1);} }\n      .ign-panel-enter { animation: ignPanelIn 0.25s ease-out; }\n      @keyframes ignPanelIn { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform: translateY(0);} }\n      .ign-scroll::-webkit-scrollbar { width: 6px; }\n      .ign-scroll::-webkit-scrollbar-track { background: " + C.panel + "; }\n      .ign-scroll::-webkit-scrollbar-thumb { background: #34343c; border-radius: 3px; }\n      .ign-scroll::-webkit-scrollbar-thumb:hover { background: #45454e; }\n      @keyframes ignDot { 0% { opacity: 0.4; transform: translateY(0);} 50% { opacity: 1; transform: translateY(-2px);} 100% { opacity: 0.4; transform: translateY(0);} }\n    ";
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

    // Launcher — dark disc, red IGN!TE slash, warm glow
    var launcher = createEl('button', 'ign-launcher ign-bubble-enter');
    launcher.setAttribute('aria-label', 'Open IgniteGTM chat');
    launcher.style.cssText = 'position:fixed;right:24px;bottom:24px;width:64px;height:64px;border-radius:50%;' +
      'border:1px solid #2a2a31;cursor:pointer;background:' + C.dark + ';display:flex;align-items:center;' +
      'justify-content:center;z-index:2147483001;box-shadow:0 10px 30px rgba(0,0,0,0.5), 0 0 24px rgba(255,138,0,0.25);';
    launcher.innerHTML = '<svg viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><polygon points="43,15 91,15 57,85 9,85" fill="' + C.red + '"/></svg>';
    launcher.onmouseenter = function () { launcher.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 34px rgba(255,197,1,0.4)'; };
    launcher.onmouseleave = function () { launcher.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 24px rgba(255,138,0,0.25)'; };
    root.appendChild(launcher);

    // Panel
    var panel = createEl('div', 'ign-panel ign-panel-enter ign-hidden');
    panel.style.cssText = 'position:fixed;right:16px;bottom:16px;width:360px;max-width:calc(100vw - 24px);height:540px;' +
      'max-height:80vh;background:' + C.dark + ';border-radius:14px;border:1px solid ' + C.line + ';' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.6);display:flex;flex-direction:column;z-index:2147483002;overflow:hidden;';
    root.appendChild(panel);

    // Header — bolt gradient
    var header = createEl('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:' + C.grad + ';';
    var left = createEl('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;';
    var avatar = createEl('div');
    avatar.style.cssText = 'width:36px;height:36px;border-radius:50%;background:' + C.ink + ';display:flex;align-items:center;justify-content:center;flex:none;';
    avatar.innerHTML = SLASH_SVG;
    var titles = createEl('div');
    var title = createEl('div', '', 'IGN!TE Assistant');
    title.style.cssText = 'color:' + C.ink + ';font-weight:800;font-size:13px;letter-spacing:0.02em;';
    var subtitle = createEl('div', '', 'Events · Studio · Advisory');
    subtitle.style.cssText = 'color:rgba(5,5,6,0.72);font-size:12px;font-weight:600;';
    titles.appendChild(title);
    titles.appendChild(subtitle);
    left.appendChild(avatar);
    left.appendChild(titles);
    var closeBtn = createEl('button', '', '×');
    closeBtn.style.cssText = 'color:' + C.ink + ';background:transparent;border:none;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:50%;line-height:1;';
    closeBtn.onmouseenter = function () { closeBtn.style.background = 'rgba(5,5,6,0.12)'; };
    closeBtn.onmouseleave = function () { closeBtn.style.background = 'transparent'; };
    header.appendChild(left);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Tabs
    var tabs = createEl('div');
    tabs.style.cssText = 'display:flex;gap:8px;padding:10px 12px;background:' + C.dark + ';border-bottom:1px solid ' + C.line + ';';
    var aiTab = createEl('button', '', 'AI Assistant');
    var liveTab = createEl('button', '', 'Live Chat');
    [aiTab, liveTab].forEach(function (btn) {
      btn.style.border = 'none';
      btn.style.borderRadius = '4px';
      btn.style.padding = '6px 12px';
      btn.style.fontSize = '12px';
      btn.style.fontWeight = '700';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 120ms ease';
      btn.style.letterSpacing = '0.02em';
    });
    tabs.appendChild(aiTab);
    tabs.appendChild(liveTab);
    panel.appendChild(tabs);

    // Messages
    var messagesWrap = createEl('div', 'ign-scroll');
    messagesWrap.style.cssText = 'flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:' + C.dark + ';';
    panel.appendChild(messagesWrap);

    // Lead form card
    var leadCard = createEl('div', 'ign-hidden');
    leadCard.style.cssText = 'background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px;';
    var leadTitle = createEl('div', '', 'Tell us where to find you');
    leadTitle.style.cssText = 'color:#fff;font-weight:700;font-size:13px;';
    leadCard.appendChild(leadTitle);
    function leadInput(placeholder, key, type) {
      var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type || 'text';
      input.placeholder = placeholder;
      input.dataset.key = key;
      input.style.cssText = 'width:100%;background:' + C.dark + ';color:#fff;border:1px solid ' + C.line + ';border-radius:6px;padding:8px;font-size:13px;outline:none;';
      input.onfocus = function () { input.style.borderColor = C.yellow; };
      input.onblur = function () { input.style.borderColor = C.line; };
      if (type === 'textarea') { input.rows = 2; input.style.resize = 'none'; }
      return input;
    }
    var fields = [
      leadInput('First name *', 'firstName', 'text'),
      leadInput('Last name', 'lastName', 'text'),
      leadInput('Work email *', 'email', 'email'),
      leadInput('Company', 'company', 'text'),
      leadInput('What are you interested in?', 'interestedIn', 'textarea'),
    ];
    fields.forEach(function (f) { leadCard.appendChild(f); });
    var leadSubmit = createEl('button', '', 'Submit details');
    leadSubmit.style.cssText = 'border:none;border-radius:6px;padding:10px;background:' + C.yellow + ';color:' + C.ink + ';font-weight:800;cursor:pointer;letter-spacing:0.02em;';
    leadCard.appendChild(leadSubmit);
    messagesWrap.appendChild(leadCard);

    // Composer
    var composer = createEl('div');
    composer.style.cssText = 'padding:10px;border-top:1px solid ' + C.line + ';background:' + C.dark + ';';
    var form = createEl('div');
    form.style.cssText = 'display:flex;gap:8px;';
    var textarea = document.createElement('textarea');
    textarea.rows = 1;
    textarea.placeholder = 'Type your message...';
    textarea.style.cssText = 'flex:1;resize:none;background:' + C.card + ';color:#fff;border:1px solid ' + C.line + ';border-radius:8px;padding:10px;font-size:13px;outline:none;';
    textarea.onfocus = function () { textarea.style.borderColor = C.yellow; };
    textarea.onblur = function () { textarea.style.borderColor = C.line; };
    var sendBtn = createEl('button', '', '➤');
    sendBtn.style.cssText = 'border:none;width:42px;height:42px;border-radius:8px;background:' + C.grad + ';color:' + C.ink + ';font-size:16px;cursor:pointer;flex:none;';
    form.appendChild(textarea);
    form.appendChild(sendBtn);
    composer.appendChild(form);
    panel.appendChild(composer);

    return {
      launcher: launcher, panel: panel, closeBtn: closeBtn,
      aiTab: aiTab, liveTab: liveTab, messagesWrap: messagesWrap,
      leadCard: leadCard, leadFields: fields, leadSubmit: leadSubmit,
      textarea: textarea, sendBtn: sendBtn,
    };
  }

  function renderMessage(container, message) {
    var row = createEl('div');
    row.style.display = 'flex';
    row.style.justifyContent = message.type === 'user' ? 'flex-end' : 'flex-start';
    var bubble = createEl('div');
    bubble.style.cssText = 'max-width:80%;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5;word-break:break-word;';
    if (message.type === 'user') {
      bubble.style.background = C.yellow;
      bubble.style.color = C.ink;
      bubble.style.fontWeight = '600';
      bubble.style.borderBottomRightRadius = '3px';
    } else {
      bubble.style.background = C.card;
      bubble.style.color = C.text;
      bubble.style.border = '1px solid ' + C.line;
      bubble.style.borderBottomLeftRadius = '3px';
    }
    bubble.textContent = message.text || '';
    if (message.showCalendly) {
      var btn = createEl('button', '', 'Book a call with Bill');
      btn.style.cssText = 'margin-top:8px;width:100%;border:none;border-radius:6px;padding:10px;background:' + C.amber + ';color:' + C.ink + ';font-weight:800;cursor:pointer;letter-spacing:0.02em;';
      btn.onclick = function () { window.open(CALENDLY_URL, '_blank'); };
      bubble.appendChild(btn);
    }
    row.appendChild(bubble);
    container.appendChild(row);
  }

  function renderTyping(container, show) {
    var existing = container.querySelector('.ign-typing');
    if (existing) existing.remove();
    if (!show) return;
    var wrap = createEl('div', 'ign-typing');
    wrap.style.cssText = 'display:flex;justify-content:flex-start;';
    var bubble = createEl('div');
    bubble.style.cssText = 'background:' + C.card + ';border:1px solid ' + C.line + ';padding:8px 10px;border-radius:10px;border-bottom-left-radius:3px;display:flex;gap:4px;align-items:center;';
    function dot(delay) {
      var d = createEl('div');
      d.style.cssText = 'width:6px;height:6px;border-radius:50%;background:' + C.dim + ';animation:ignDot 1s infinite;animation-delay:' + delay + ';';
      return d;
    }
    bubble.appendChild(dot('0ms'));
    bubble.appendChild(dot('150ms'));
    bubble.appendChild(dot('300ms'));
    wrap.appendChild(bubble);
    container.appendChild(wrap);
  }

  function main() {
    injectStyles();
    var ui = buildUi();
    var isOpen = false;
    var activeTab = 'ai';
    var messages = [];
    var sessionId = getSessionId();
    var showLeadForm = false;
    var leadCaptured = false;
    var openedNotified = false;

    function togglePanel(show) {
      isOpen = show;
      ui.panel.classList.toggle('ign-hidden', !isOpen);
    }

    var liveNoticeShown = false;
    var livePingSent = false;
    var livePollTimer = null;
    var seenTeamMsgIds = new Set();

    function setTab(tab) {
      activeTab = tab;
      ui.aiTab.style.background = tab === 'ai' ? C.yellow : C.card;
      ui.aiTab.style.color = tab === 'ai' ? C.ink : C.dim;
      ui.liveTab.style.background = tab === 'live' ? C.ember : C.card;
      ui.liveTab.style.color = tab === 'live' ? '#fff' : C.dim;
      if (tab === 'live' && !liveNoticeShown) {
        addMessage({
          id: 'live_notice',
          type: 'assistant',
          text: 'You switched to live chat — hang tight, the IgniteGTM team is being pinged.',
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
                page_url: window.location.href,
              }),
            }).catch(function () {});
          } catch {}
        }
      }
      if (tab === 'live') { startLivePolling(); } else { stopLivePolling(); }
    }

    function scrollBottom() {
      setTimeout(function () {
        ui.messagesWrap.scrollTop = ui.messagesWrap.scrollHeight + 200;
      }, 20);
    }

    function renderAll() {
      ui.messagesWrap.innerHTML = '';
      messages.forEach(function (m) { renderMessage(ui.messagesWrap, m); });
      if (showLeadForm && !leadCaptured) {
        ui.leadCard.classList.remove('ign-hidden');
        ui.messagesWrap.appendChild(ui.leadCard);
      } else {
        ui.leadCard.classList.add('ign-hidden');
      }
      scrollBottom();
    }

    function addMessage(msg) {
      messages.push(msg);
      renderAll();
    }

    function startLivePolling() {
      if (livePollTimer) return;
      var poll = function () {
        fetch(LIVE_ENDPOINT + '?session_id=' + encodeURIComponent(sessionId), { method: 'GET' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var arr = (data && data.messages) || [];
            arr.forEach(function (m) {
              if (m.sender !== 'team') return;
              var id = 'team_' + (m.id || m.created_at || Math.random());
              if (seenTeamMsgIds.has(id)) return;
              seenTeamMsgIds.add(id);
              addMessage({
                id: id,
                type: 'assistant',
                text: (m.name ? m.name + ': ' : '') + (m.text || ''),
              });
            });
          })
          .catch(function () { /* ignore */ });
      };
      poll();
      livePollTimer = setInterval(poll, 5000);
    }
    function stopLivePolling() {
      if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
    }

    function welcome() {
      addMessage({
        id: 'welcome',
        type: 'assistant',
        text: "Hey — I'm ignite-bot. Ask me about the AI INFRA SUMMIT, NeoCloud Summit, Ignite Studio, or GTM Advisory — or tell me what you're building and I'll point you to the right room.",
      });
    }

    ui.launcher.onclick = function () {
      togglePanel(true);
      if (!openedNotified) {
        openedNotified = true;
        try {
          fetch(OPEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, page_url: window.location.href }),
          }).catch(function () {});
        } catch {}
      }
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
      var body = { message: text, session_id: sessionId, page_url: window.location.href };
      if (activeTab === 'ai') {
        body.history = messages.slice(-9).map(function (m) {
          return { role: m.type === 'user' ? 'user' : 'assistant', text: m.text };
        });
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
            text: data.response || data.message || "Thanks for your message — we'll get back to you shortly.",
            showCalendly: !!data.calendly_link,
          });
          if (data.capture_lead) {
            leadCaptured = true;
            showLeadForm = false;
          }
        })
        .catch(function () {
          renderTyping(ui.messagesWrap, false);
          addMessage({ id: 'err_' + Date.now(), type: 'assistant', text: "Sorry — I'm having trouble connecting. Please try again, or email hello@ignitegtm.com." });
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
      ui.leadFields.forEach(function (f) { payload[f.dataset.key] = f.value.trim(); });
      if (!payload.firstName || !payload.email) {
        alert('Please fill in First name and Email');
        return;
      }
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName || null,
          email: payload.email,
          company: payload.company || null,
          interestedIn: payload.interestedIn || null,
          session_id: sessionId,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function () {
          showLeadForm = false;
          leadCaptured = true;
          addMessage({
            id: 'lead_' + Date.now(),
            type: 'assistant',
            text: "Perfect — I've got your details. Want to grab time with Bill now?",
            showCalendly: true,
          });
        })
        .catch(function () {
          alert('Error submitting details. Please try again.');
        });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
