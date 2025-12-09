(function () {
  if (window.__offrChatWidgetLoaded) return;
  window.__offrChatWidgetLoaded = true;

  const currentScript = document.currentScript;
  const apiBaseAttr = currentScript?.getAttribute('data-api-base');
  const calendlyAttr = currentScript?.getAttribute('data-calendly-url');
  const supabaseUrlAttr = currentScript?.getAttribute('data-supabase-url');
  const supabaseKeyAttr = currentScript?.getAttribute('data-supabase-key');

  const config = {
    apiBase: apiBaseAttr || 'https://api.thehirepilot.com',
    calendlyUrl: calendlyAttr || 'https://calendly.com/offrgroup/introduction',
    supabaseUrl: supabaseUrlAttr || 'https://lqcsassinqfruvpgcooo.supabase.co',
    supabaseKey: supabaseKeyAttr || (typeof window !== 'undefined' ? window.NEXT_PUBLIC_SUPABASE_ANON_KEY : '') || '',
  };

  window.offrChatConfig = config;

  const deps = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve(null);
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve(null);
      script.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(script);
    });
  }

  function ensureRoot() {
    let root = document.getElementById('offr-chat-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'offr-chat-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function injectStyles() {
    const fontPreconnect1 = document.createElement('link');
    fontPreconnect1.rel = 'preconnect';
    fontPreconnect1.href = 'https://fonts.googleapis.com';
    const fontPreconnect2 = document.createElement('link');
    fontPreconnect2.rel = 'preconnect';
    fontPreconnect2.href = 'https://fonts.gstatic.com';
    fontPreconnect2.crossOrigin = 'anonymous';
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontPreconnect1);
    document.head.appendChild(fontPreconnect2);
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
      * { font-family: 'Inter', sans-serif; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: #1e293b; }
      ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #64748b; }
      .chat-bubble-enter { animation: bubbleIn 0.3s ease-out; }
      @keyframes bubbleIn {
        from { opacity: 0; transform: translateY(10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .panel-enter { animation: panelIn 0.3s ease-out; }
      @keyframes panelIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  function mountWidget() {
    const widgetCode = [
      "const { useState, useEffect, useRef } = React;",
      "const ChatWidget = () => {",
      "  const cfg = window.offrChatConfig || {};",
      "  const API_BASE = (cfg.apiBase || 'https://api.thehirepilot.com').replace(/\\/$/, '');",
      "  const CHAT_ENDPOINT = API_BASE + '/api/public-chat/offr';",
      "  const LIVE_ENDPOINT = API_BASE + '/api/offr-livechat/messages';",
      "  const LEAD_ENDPOINT = API_BASE + '/api/public-leads/offr';",
      "  const CALENDLY_URL = cfg.calendlyUrl || 'https://calendly.com/offrgroup/introduction';",
      "  const supabaseClient = (window.supabase && cfg.supabaseUrl && cfg.supabaseKey)",
      "    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)",
      "    : null;",
      "  const sessionKey = 'offr:sessionId';",
      "  const initialSession = () => {",
      "    try {",
      "      const existing = localStorage.getItem(sessionKey);",
      "      if (existing) return existing;",
      "      const fresh = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'session_' + Date.now();",
      "      localStorage.setItem(sessionKey, fresh);",
      "      return fresh;",
      "    } catch {",
      "      return 'session_' + Date.now();",
      "    }",
      "  };",
      "  const [sessionId, setSessionId] = useState(initialSession);",
      "  const [isOpen, setIsOpen] = useState(false);",
      "  const [activeTab, setActiveTab] = useState('ai');",
      "  const [messages, setMessages] = useState([]);",
      "  const [inputValue, setInputValue] = useState('');",
      "  const [isTyping, setIsTyping] = useState(false);",
      "  const [showLeadForm, setShowLeadForm] = useState(false);",
      "  const [leadData, setLeadData] = useState({ firstName: '', lastName: '', email: '', phone: '', linkedin: '', company: '', hiringFor: '' });",
      "  const messagesEndRef = useRef(null);",
      "  const inputRef = useRef(null);",
      "",
      "  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };",
      "  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);",
      "",
      "  useEffect(() => {",
      "    if (isOpen && messages.length === 0) {",
      "      setTimeout(() => {",
      "        setMessages([",
      "          { id: 1, type: 'assistant', text: \"Hey, I'm the Offr Group assistant. I can walk you through contingency, executive, RPO, BPO, and staffing options — or help you figure out what you actually need.\", timestamp: new Date() },",
      "        ]);",
      "      }, 300);",
      "    }",
      "  }, [isOpen, messages.length]);",
      "",
      "  useEffect(() => {",
      "    if (!supabaseClient || !sessionId) return;",
      "    const channel = supabaseClient",
      "      .channel('rex_widget:' + sessionId)",
      "      .on('broadcast', { event: 'human_reply' }, (payload) => {",
      "        try {",
      "          const p = payload?.payload || payload;",
      "          const text = p?.message || p?.text || '';",
      "          if (!text) return;",
      "          const name = p?.name ? p.name + ': ' : '';",
      "          setMessages(prev => prev.concat([{ id: 'hr_' + Date.now(), type: 'assistant', text: name + text, timestamp: new Date() }]));",
      "          setActiveTab('live');",
      "        } catch (e) { console.warn('supabase human_reply parse err', e); }",
      "      })",
      "      .subscribe();",
      "    return () => { try { channel.unsubscribe(); } catch {} };",
      "  }, [supabaseClient, sessionId]);",
      "",
      "  const handleSendMessage = async () => {",
      "    if (!inputValue.trim()) return;",
      "    const userMessage = { id: Date.now(), type: 'user', text: inputValue, timestamp: new Date() };",
      "    setMessages(prev => prev.concat([userMessage]));",
      "    setInputValue('');",
      "    setIsTyping(true);",
      "    try {",
      "      const history = messages.concat([userMessage]).slice(-10).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', text: m.text }));",
      "      const endpoint = activeTab === 'ai' ? CHAT_ENDPOINT : LIVE_ENDPOINT;",
      "      const body = activeTab === 'ai'",
      "        ? { message: userMessage.text, session_id: sessionId, page_url: window.parent?.location?.href || window.location.href, history }",
      "        : { message: userMessage.text, session_id: sessionId, page_url: window.parent?.location?.href || window.location.href };",
      "      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });",
      "      const data = await response.json();",
      "      setIsTyping(false);",
      "      if (data?.session_id && data.session_id !== sessionId) { setSessionId(data.session_id); try { localStorage.setItem(sessionKey, data.session_id); } catch {} }",
      "      const assistantMessage = { id: Date.now() + 1, type: activeTab === 'ai' ? 'assistant' : 'agent', text: data.response || data.message || \"Thanks for your message. We'll get back to you shortly.\", timestamp: new Date(), showCalendly: !!data.calendly_link };",
      "      setMessages(prev => prev.concat([assistantMessage]));",
      "      if (data.capture_lead) { setTimeout(() => setShowLeadForm(true), 400); }",
      "    } catch (error) {",
      "      setIsTyping(false);",
      "      setMessages(prev => prev.concat([{ id: Date.now() + 2, type: 'assistant', text: \"Sorry, I'm having trouble connecting. Please try again.\", timestamp: new Date() }]));",
      "    }",
      "  };",
      "",
      "  const handleKeyPress = (e) => {",
      "    if (e.key === 'Enter' && !e.shiftKey) {",
      "      e.preventDefault();",
      "      handleSendMessage();",
      "    }",
      "  };",
      "",
      "  const handleLeadSubmit = async () => {",
      "    if (!leadData.firstName || !leadData.lastName || !leadData.email) {",
      "      alert('Please fill in required fields: First name, Last name, and Email');",
      "      return;",
      "    }",
      "    try {",
      "      const payload = {",
      "        firstName: leadData.firstName,",
      "        lastName: leadData.lastName,",
      "        email: leadData.email,",
      "        phone: leadData.phone || null,",
      "        linkedin: leadData.linkedin || null,",
      "        company: leadData.company || null,",
      "        hiringFor: leadData.hiringFor || null,",
      "        session_id: sessionId,",
      "        source: 'website_chat',",
      "      };",
      "      const resp = await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });",
      "      if (resp.ok) {",
      "        setShowLeadForm(false);",
      "        const confirmMessage = { id: Date.now(), type: 'assistant', text: \"Perfect! I've got your details. Ready to book a quick intro call?\", timestamp: new Date(), showCalendly: true };",
      "        setMessages(prev => prev.concat([confirmMessage]));",
      "      } else { alert('Error submitting details. Please try again.'); }",
      "    } catch (error) {",
      "      alert('Error submitting details. Please try again.');",
      "    }",
      "  };",
      "",
      "  const openCalendly = () => { window.open(CALENDLY_URL, '_blank'); };",
      "",
      "  return (",
      "    <React.Fragment>",
      "      {!isOpen && (",
      "        <button",
      "          id=\"chat-bubble-btn\"",
      "          onClick={() => setIsOpen(true)}",
      "          className=\"fixed bottom-6 right-6 md:bottom-6 md:right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200 z-50 chat-bubble-enter\"",
      "        >",
      "          <i className=\"fas fa-comments text-white text-2xl\"></i>",
      "        </button>",
      "      )}",
      "",
      "      {isOpen && (",
      "        <div",
      "          id=\"chat-panel\"",
      "          className=\"fixed bottom-6 right-6 w-[360px] h-[520px] md:w-[360px] md:h-[520px] max-w-full max-h-[80vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700 flex flex-col z-50 panel-enter\"",
      "        >",
      "          <div id=\"chat-header\" className=\"bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl px-4 py-3 flex items-center justify-between\">",
      "            <div className=\"flex items-center gap-3\">",
      "              <div className=\"w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-slate-900 text-sm\">",
      "                OG",
      "              </div>",
      "              <div>",
      "                <h3 className=\"text-white font-semibold text-sm\">Offr Group Assistant</h3>",
      "                <p className=\"text-blue-100 text-xs\">Ask about hiring & services</p>",
      "              </div>",
      "            </div>",
      "            <button",
      "              onClick={() => setIsOpen(false)}",
      "              className=\"text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors\"",
      "            >",
      "              <i className=\"fas fa-times\"></i>",
      "            </button>",
      "          </div>",
      "",
      "          <div id=\"chat-tabs\" className=\"bg-slate-800 px-4 py-2 flex gap-2 border-b border-slate-700\">",
      "            <button",
      "              onClick={() => setActiveTab('ai')}",
      "              className={(activeTab === 'ai' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600') + ' px-3 py-1 rounded-full text-xs font-medium transition-all'}",
      "            >",
      "              <i className=\"fas fa-robot mr-1\"></i>",
      "              AI Assistant",
      "            </button>",
      "            <button",
      "              onClick={() => setActiveTab('live')}",
      "              className={(activeTab === 'live' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600') + ' px-3 py-1 rounded-full text-xs font-medium transition-all'}",
      "            >",
      "              <i className=\"fas fa-user-headset mr-1\"></i>",
      "              Live Chat",
      "            </button>",
      "          </div>",
      "",
      "          {activeTab === 'live' && messages.length === 0 && (",
      "            <div className=\"px-4 py-2 bg-slate-800/50 border-b border-slate-700\">",
      "              <p className=\"text-xs text-slate-400 flex items-center gap-2\">",
      "                <i className=\"fas fa-info-circle\"></i>",
      "                If no one's available live, we'll follow up by email.",
      "              </p>",
      "            </div>",
      "          )}",
      "",
      "          <div id=\"chat-messages\" className=\"flex-1 overflow-y-auto px-3 py-3 space-y-3\">",
      "            {messages.map((message) => (",
      "              <div key={message.id} className={'flex ' + (message.type === 'user' ? 'justify-end' : 'justify-start') + ' chat-bubble-enter'}>",
      "                <div className={(message.type === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-100 rounded-bl-sm') + ' max-w-[80%] px-4 py-2 rounded-2xl'}>",
      "                  <p className=\"text-sm leading-relaxed\">{message.text}</p>",
      "                  {message.showCalendly && (",
      "                    <button",
      "                      onClick={openCalendly}",
      "                      className=\"mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors\"",
      "                    >",
      "                      <i className=\"fas fa-calendar-check mr-2\"></i>",
      "                      Book a call",
      "                    </button>",
      "                  )}",
      "                </div>",
      "              </div>",
      "            ))}",
      "",
      "            {isTyping && (",
      "              <div className=\"flex justify-start chat-bubble-enter\">",
      "                <div className=\"bg-slate-700 text-slate-100 px-4 py-2 rounded-2xl rounded-bl-sm\">",
      "                  <div className=\"flex gap-1\">",
      "                    <div className=\"w-2 h-2 bg-slate-400 rounded-full animate-bounce\" style={{ animationDelay: '0ms' }}></div>",
      "                    <div className=\"w-2 h-2 bg-slate-400 rounded-full animate-bounce\" style={{ animationDelay: '150ms' }}></div>",
      "                    <div className=\"w-2 h-2 bg-slate-400 rounded-full animate-bounce\" style={{ animationDelay: '300ms' }}></div>",
      "                  </div>",
      "                </div>",
      "              </div>",
      "            )}",
      "",
      "            {showLeadForm && (",
      "              <div className=\"bg-slate-700 rounded-xl p-4 space-y-3 chat-bubble-enter\">",
      "                <h4 className=\"text-white font-semibold text-sm mb-3\">Let's connect you with the right person</h4>",
      "                <input",
      "                  type=\"text\"",
      "                  placeholder=\"First name *\"",
      "                  value={leadData.firstName}",
      "                  onChange={(e) => setLeadData({ ...leadData, firstName: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <input",
      "                  type=\"text\"",
      "                  placeholder=\"Last name *\"",
      "                  value={leadData.lastName}",
      "                  onChange={(e) => setLeadData({ ...leadData, lastName: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <input",
      "                  type=\"email\"",
      "                  placeholder=\"Email *\"",
      "                  value={leadData.email}",
      "                  onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <input",
      "                  type=\"tel\"",
      "                  placeholder=\"Phone\"",
      "                  value={leadData.phone}",
      "                  onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <input",
      "                  type=\"text\"",
      "                  placeholder=\"LinkedIn\"",
      "                  value={leadData.linkedin}",
      "                  onChange={(e) => setLeadData({ ...leadData, linkedin: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <input",
      "                  type=\"text\"",
      "                  placeholder=\"Company\"",
      "                  value={leadData.company}",
      "                  onChange={(e) => setLeadData({ ...leadData, company: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none\"",
      "                />",
      "                <textarea",
      "                  placeholder=\"What are you hiring for?\"",
      "                  value={leadData.hiringFor}",
      "                  onChange={(e) => setLeadData({ ...leadData, hiringFor: e.target.value })}",
      "                  className=\"w-full bg-slate-800 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 focus:border-blue-500 focus:outline-none resize-none\"",
      "                  rows=\"2\"",
      "                />",
      "                <button",
      "                  onClick={handleLeadSubmit}",
      "                  className=\"w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all\"",
      "                >",
      "                  Submit details",
      "                </button>",
      "              </div>",
      "            )}",
      "",
      "            <div ref={messagesEndRef} />",
      "          </div>",
      "",
      "          <div id=\"chat-composer\" className=\"bg-slate-800 rounded-b-2xl px-3 py-3 border-t border-slate-700\">",
      "            <div className=\"flex items-end gap-2\">",
      "              <textarea",
      "                ref={inputRef}",
      "                value={inputValue}",
      "                onChange={(e) => setInputValue(e.target.value)}",
      "                onKeyPress={handleKeyPress}",
      "                placeholder=\"Type your message...\"",
      "                className=\"flex-1 bg-slate-700 text-white px-4 py-2 rounded-xl text-sm border border-slate-600 focus:border-blue-500 focus:outline-none resize-none\"",
      "                rows=\"1\"",
      "                style={{ maxHeight: '80px' }}",
      "              />",
      "              <button",
      "                onClick={handleSendMessage}",
      "                disabled={!inputValue.trim()}",
      "                className={(inputValue.trim() ? 'from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : 'from-slate-700 to-slate-700 disabled:cursor-not-allowed') + ' bg-gradient-to-r text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all'}",
      "              >",
      "                <i className=\"fas fa-paper-plane\"></i>",
      "              </button>",
      "            </div>",
      "          </div>",
      "        </div>",
      "      )}",
      "    </React.Fragment>",
      "  );",
      "};",
      "ReactDOM.render(<ChatWidget />, document.getElementById('offr-chat-root'));",
    ].join('\\n');

    const babelScript = document.createElement('script');
    babelScript.type = 'text/babel';
    babelScript.setAttribute('data-presets', 'react');
    babelScript.textContent = widgetCode;
    document.body.appendChild(babelScript);
    if (window.Babel && typeof window.Babel.transformScriptTags === 'function') {
      window.Babel.transformScriptTags();
    }
  }

  Promise.all(deps.map(loadScript))
    .then(() => {
      injectStyles();
      ensureRoot();
      mountWidget();
    })
    .catch(err => {
      console.error('Offr chat widget failed to load dependencies', err);
    });
})();


