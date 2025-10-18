import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRexAgent } from '../../hooks/useRexAgent';
import { supabase } from '../../lib/supabaseClient';

export default function REXConsole() {
  const location = useLocation();
  const personaId = new URLSearchParams(location.search).get('persona');
  const [persona, setPersona] = useState(null);
  const [loadingPersona, setLoadingPersona] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPersona() {
      if (!personaId) return;
      try {
        setLoadingPersona(true);
        const API_BASE = (typeof window !== 'undefined' && window['__HP_API_BASE__']) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
        const apiUrl = (p) => `${API_BASE}${p}`;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const resp = await fetch(apiUrl(`/api/personas/${personaId}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include'
        });
        if (!resp.ok) throw new Error('Failed to load persona');
        const data = await resp.json();
        if (!cancelled) setPersona(data);
      } catch {
        if (!cancelled) setPersona(null);
      } finally {
        if (!cancelled) setLoadingPersona(false);
      }
    }
    loadPersona();
    return () => { cancelled = true; };
  }, [personaId]);

  const personaContext = persona ? {
    name: persona.name,
    titles: persona.titles,
    include: persona.include_keywords,
    exclude: persona.exclude_keywords,
    locations: persona.locations,
    channels: persona.channels
  } : null; // TODO: Send this context to REX on first chat message

  // Calm mode system prompt (persona-aware)
  const systemPrompt = `You are REX, an AI Recruiting Agent inside HirePilot. Your mode is Calm Professional Assistant. \n\nGuidelines: Be concise, neutral. Ask briefly before acting. Use persona criteria for sourcing, outreach, and automations. Offer two clear next steps. Use acknowledgments like \'Understood\', \'Noted\', \'Certainly\'. Avoid slang. \n\nPersona Awareness: ${persona ? `Using persona '${persona.name}'.` : 'No persona active.'}`;

  // Keep latest persona available inside event handlers
  const personaRef = useRef(persona);
  useEffect(() => { personaRef.current = persona; }, [persona]);
  const { sendMessageToRex, triggerAction } = useRexAgent(persona || undefined);

  // When a persona is loaded via URL, seed an initial assistant message and update the banner pill
  useEffect(() => {
    if (!persona || seeded) return;
    try {
      const chatArea = document.getElementById('chat-area');
      const container = chatArea?.querySelector('.max-w-4xl');
      if (!container) return;
      // remove default welcome message if present
      const welcome = document.getElementById('welcome-message');
      if (welcome && welcome.parentNode) welcome.parentNode.removeChild(welcome);
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-start space-x-3';
      wrapper.innerHTML = `
        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">R</div>
        <div class="flex-1">
          <div class="bg-gray-800 rounded-2xl p-4 max-w-2xl border border-gray-700">
            <p class="text-gray-200 leading-relaxed">I'm using your <strong>${persona?.name || ''}</strong> persona. Would you like to start sourcing now or adjust criteria?</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button data-action-value="run_now" class="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Start Now</button>
              <button data-action-value="adjust_persona" class="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Adjust Persona</button>
              <button data-action-value="schedule" class="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Schedule</button>
            </div>
          </div>
          <span class="text-xs text-gray-500 mt-1 block">Just now</span>
        </div>
      `;
      container.appendChild(wrapper);
      wrapper.querySelectorAll('button[data-action-value]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const val = btn.getAttribute('data-action-value') || '';
          // Reuse existing helpers
          const chatInput = document.getElementById('chat-input');
          const typingIndicator = document.getElementById('typing-indicator');
          const addUserMessageDiv = (message) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'flex items-start space-x-3 justify-end';
            messageDiv.innerHTML = `<div class=\"flex-1 flex justify-end\"><div class=\"bg-blue-600 text-white rounded-2xl p-4 max-w-2xl\"><p class=\"leading-relaxed\">${val}</p></div></div><div class=\"w-8 h-8 bg-gray-600 rounded-full overflow-hidden\"><img src=\"https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg\" alt=\"User\" class=\"w-full h-full object-cover\"></div>`;
            const c = document.getElementById('chat-area').querySelector('.max-w-4xl');
            c.appendChild(messageDiv);
          };
          addUserMessageDiv(val);
          if (typingIndicator) typingIndicator.style.display = 'flex';
          try {
            const res = await triggerAction(val);
            if (typingIndicator) typingIndicator.style.display = 'none';
            const follow = document.createElement('div');
            follow.className = 'flex items-start space-x-3';
            follow.innerHTML = `<div class=\"w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold\">R</div><div class=\"flex-1\"><div class=\"bg-gray-800 rounded-2xl p-4 max-w-2xl border border-gray-700\"><p class=\"text-gray-200 leading-relaxed\">${res.message || ''}</p></div><span class=\"text-xs text-gray-500 mt-1 block\">Just now</span></div>`;
            container.appendChild(follow);
          } catch {
            if (typingIndicator) typingIndicator.style.display = 'none';
          }
        });
      });
      setSeeded(true);
    } catch {}
  }, [persona, seeded, triggerAction]);
  useEffect(() => {
    // Chat functionality (wired to DOM nodes by ID as provided)
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatArea = document.getElementById('chat-area');
    const typingIndicator = document.getElementById('typing-indicator');

    function addUserMessage(message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'flex items-start space-x-3 justify-end';
      messageDiv.innerHTML = `
        <div class="flex-1 flex justify-end">
            <div class="bg-blue-600 text-white rounded-2xl p-4 max-w-2xl">
                <p class="leading-relaxed">${message}</p>
            </div>
        </div>
        <div class="w-8 h-8 bg-gray-600 rounded-full overflow-hidden">
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" class="w-full h-full object-cover">
        </div>
      `;
      const container = chatArea.querySelector('.max-w-4xl');
      container.appendChild(messageDiv);
      scrollToBottom();
    }

    function addREXResponse(message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'flex items-start space-x-3';
      messageDiv.innerHTML = `
        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            R
        </div>
        <div class="flex-1">
            <div class="bg-gray-800 rounded-2xl p-4 max-w-2xl border border-gray-700">
                <p class="text-gray-200 leading-relaxed">${message}</p>
            </div>
            <span class="text-xs text-gray-500 mt-1 block">Just now</span>
        </div>
      `;
      const container = chatArea.querySelector('.max-w-4xl');
      container.appendChild(messageDiv);
      scrollToBottom();
    }

    function addREXResponseWithActions(cfg) {
      const { message, actions } = cfg || {};
      const wrapper = document.createElement('div');
      wrapper.className = 'flex items-start space-x-3';
      wrapper.innerHTML = `
        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">R</div>
        <div class="flex-1">
          <div class="bg-gray-800 rounded-2xl p-4 max-w-2xl border border-gray-700">
            <p class="text-gray-200 leading-relaxed">${message}</p>
            ${Array.isArray(actions) && actions.length ? `<div class=\"mt-3 flex flex-wrap gap-2\">${actions.map(a => `<button data-action-value=\"${a.value}\" class=\"bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors\">${a.label}</button>`).join('')}</div>` : ''}
          </div>
          <span class="text-xs text-gray-500 mt-1 block">Just now</span>
        </div>
      `;
      const container = chatArea.querySelector('.max-w-4xl');
      container.appendChild(wrapper);
      // Bind buttons to simulate user selection
      wrapper.querySelectorAll('button[data-action-value]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const val = btn.getAttribute('data-action-value') || '';
          addUserMessage(val);
          showTypingIndicator();
          try {
            const res = await triggerAction(val);
            hideTypingIndicator();
            addREXResponseWithActions({ message: res.message, actions: res.actions });
          } catch (e) {
            hideTypingIndicator();
            addREXResponse('Understood. How would you like to proceed?');
          }
        });
      });
      scrollToBottom();
    }

    function showTypingIndicator() {
      if (typingIndicator) typingIndicator.style.display = 'flex';
      scrollToBottom();
    }
    function hideTypingIndicator() {
      if (typingIndicator) typingIndicator.style.display = 'none';
    }
    function scrollToBottom() {
      if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
    }
    function respondCalmIntent(input) {
      const text = input.toLowerCase();
      const activePersona = personaRef.current;
      // Slash commands
      if (text.startsWith('/source')) {
        addREXResponseWithActions({
          message: activePersona ? `Would you like me to start sourcing using your ${activePersona.name} persona?` : 'Would you like me to start sourcing using your active persona?',
          actions: [ { label:'Run Now', value:'run_now' }, { label:'Adjust Persona', value:'adjust_persona' } ]
        });
        return true;
      }
      if (text.startsWith('/schedule')) {
        addREXResponseWithActions({
          message: 'I can schedule this. Daily or weekly?',
          actions: [ { label:'Daily', value:'schedule_daily' }, { label:'Weekly', value:'schedule_weekly' } ]
        });
        return true;
      }
      if (text.startsWith('/refine')) {
        addREXResponseWithActions({
          message: 'What would you like to modify in your persona?',
          actions: [ { label:'Titles', value:'refine_titles' }, { label:'Locations', value:'refine_locations' }, { label:'Filters', value:'refine_filters' } ]
        });
        return true;
      }

      // General calm intelligence
      if (/(find|source|sourcing|prospect)/.test(text)) {
        addREXResponseWithActions({
          message: activePersona ? `I'm using your ${activePersona.name} persona. Would you like to start sourcing now or adjust criteria?` : 'I can start sourcing. Would you like to begin now or adjust criteria first?',
          actions: [ { label:'Start Now', value:'start_now' }, { label:'Adjust Persona', value:'adjust_persona' } ]
        });
        return true;
      }
      if (/(outreach|sequence|email)/.test(text)) {
        addREXResponseWithActions({
          message: 'Would you like a fresh email sequence or modify an existing one?',
          actions: [ { label:'New Sequence', value:'new_sequence' }, { label:'Modify Existing', value:'modify_existing' } ]
        });
        return true;
      }
      if (/schedule/.test(text)) {
        addREXResponseWithActions({
          message: 'Should I set it for a specific date or make it recurring?',
          actions: [ { label:'One-Time', value:'one_time' }, { label:'Recurring', value:'recurring' } ]
        });
        return true;
      }
      return false;
    }

    async function sendMessage() {
      const message = (chatInput && (chatInput).value) ? (chatInput).value.trim() : '';
      if (!message) return;
      addUserMessage(message);
      (chatInput).value = '';
      showTypingIndicator();
      try {
        const res = await sendMessageToRex(message);
        hideTypingIndicator();
        addREXResponseWithActions({ message: res.message, actions: res.actions });
      } catch {
        hideTypingIndicator();
        if (!respondCalmIntent(message)) addREXResponse('Understood. How would you like to proceed?');
      }
    }

    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    document.querySelectorAll('#quick-actions button').forEach((button) => {
      button.addEventListener('click', () => {
        const action = (button.textContent || '').trim();
        addUserMessage(`/${action.toLowerCase().replace(' ', '')}`);
        setTimeout(() => {
          showTypingIndicator();
          setTimeout(() => {
            hideTypingIndicator();
            addREXResponse(`Executing ${action}... I'll set this up for you right away.`);
          }, 1500);
        }, 500);
      });
    });

    return () => {
      if (sendButton) sendButton.removeEventListener('click', sendMessage);
      // Note: we cannot remove the exact anonymous handler; rely on component unmount to drop listeners
    };
  }, []);

  return (
    <div id="rex-console" className="flex flex-col h-screen bg-gray-900">
      <header id="console-header" className="border-b border-gray-700 bg-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-white">REX Console</h1>
          {persona ? (
            <div id="persona-badge" className="bg-blue-900/50 border border-blue-700 px-3 py-1 rounded-full flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span className="text-sm font-medium text-blue-300">Persona Active: {persona.name}</span>
              {Array.isArray(persona.titles) && persona.titles[0] && (
                <span className="bg-blue-800 text-blue-200 px-2 py-0.5 rounded text-xs font-medium">{persona.titles[0]}</span>
              )}
            </div>
          ) : (
            <div id="persona-badge" className="bg-blue-900/50 border border-blue-700 px-3 py-1 rounded-full flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span className="text-sm font-medium text-blue-300">No persona loaded. Select a persona from the Personas tab.</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button className="text-gray-400 hover:text-gray-300 transition-colors">
            <i className="fa-solid fa-info-circle" />
          </button>
        </div>
      </header>

      {/* Persona Context Banner (top of chat) */}
      <div className="px-6 pt-4">
        <div className="max-w-4xl mx-auto">
          {loadingPersona && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300">Loading persona…</div>
          )}
          {!loadingPersona && persona && (
            <div className="rounded-lg border border-blue-700 bg-blue-900/40 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-blue-200 text-sm font-medium">Persona Active: {persona.name}</div>
                <div className="text-blue-300 text-xs mt-0.5">
                  {(persona.titles || []).slice(0,3).join(', ') || '—'}
                  {(persona.locations || []).length ? ` • ${(persona.locations || []).slice(0,3).join(', ')}` : ''}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <span className="bg-blue-800 text-blue-200 px-2 py-0.5 rounded text-xs font-medium">Persona</span>
              </div>
            </div>
          )}
          {!loadingPersona && !persona && (
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-300">No persona loaded. Select a persona from the Personas tab.</div>
          )}
        </div>
      </div>

      {/* Quick Actions (below persona banner, above messages) */}
      <div className="px-6 pt-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-play" />
              <span>Run Now – Source Leads</span>
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-user-edit" />
              <span>Modify Persona</span>
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-calendar-plus" />
              <span>Schedule Automation</span>
            </button>
          </div>
        </div>
      </div>

      <div id="chat-area" className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div id="welcome-message" className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">R</div>
            <div className="flex-1">
              <div className="bg-gray-800 rounded-2xl p-4 max-w-2xl border border-gray-700">
                <p className="text-gray-200 leading-relaxed">
                  Hi! I'm REX, your AI recruiting agent. I can help you source candidates, write outreach messages, schedule automations, and analyze recruiting data. What would you like to work on today?
                </p>
              </div>
              <span className="text-xs text-gray-500 mt-1 block">Just now</span>
            </div>
          </div>

          <div id="user-message-1" className="flex items-start space-x-3 justify-end">
            <div className="flex-1 flex justify-end">
              <div className="bg-blue-600 text-white rounded-2xl p-4 max-w-2xl">
                <p className="leading-relaxed">
                  I need to source 10 senior software engineers with React and Node.js experience for a startup in San Francisco. Can you help me create a sourcing campaign?
                </p>
              </div>
            </div>
            <div className="w-8 h-8 bg-gray-600 rounded-full overflow-hidden">
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>

          <div id="rex-response-1" className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">R</div>
            <div className="flex-1">
              <div className="bg-gray-800 rounded-2xl p-4 max-w-3xl border border-gray-700">
                <p className="text-gray-200 leading-relaxed mb-4">
                  Perfect! I'll help you create a comprehensive sourcing campaign for senior React/Node.js engineers in San Francisco. Here's what I recommend:
                </p>
                <div className="bg-black rounded-lg p-4 mb-4 border border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-mono">Campaign Strategy</span>
                    <button className="text-gray-400 hover:text-gray-300 transition-colors">
                      <i className="fa-solid fa-copy" />
                    </button>
                  </div>
                  <pre className="text-green-400 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">Target Profile:
• 5+ years React experience
• 3+ years Node.js/Express
• Located in SF Bay Area
• Currently at tech companies
• Open to startup opportunities

Sourcing Channels:
1. LinkedIn Boolean search
2. GitHub profile analysis  
3. Tech conference attendees
4. Startup community networks</pre>
                </div>
                <p className="text-gray-200 leading-relaxed">
                  Would you like me to generate the specific Boolean search strings and create personalized outreach templates for this campaign?
                </p>
              </div>
              <span className="text-xs text-gray-500 mt-1 block">2 minutes ago</span>
            </div>
          </div>

          <div id="typing-indicator" className="flex items-start space-x-3" style={{ display: 'none' }}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">R</div>
            <div className="flex-1">
              <div className="bg-gray-800 rounded-2xl p-4 max-w-xs border border-gray-700">
                <div className="w-2 h-4 bg-gray-300 rounded-sm" style={{ animation: 'rex-blink 1s steps(1,end) infinite' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="quick-actions" className="border-t border-gray-700 bg-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-play" />
              <span>Run Campaign</span>
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-user-edit" />
              <span>Modify Persona</span>
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-calendar-plus" />
              <span>Schedule Automation</span>
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
              <i className="fa-solid fa-chart-line" />
              <span>Analytics</span>
            </button>
          </div>
        </div>
      </div>

      <div id="input-bar" className="sticky bottom-0 z-20 border-t border-gray-700 bg-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 bg-gray-700 border border-gray-600 rounded-xl p-3 focus-within:border-blue-500 transition-colors">
            <button className="text-gray-400 hover:text-gray-300 transition-colors">
              <i className="fa-solid fa-paperclip" />
            </button>
            <input
              type="text"
              placeholder="Ask REX to source candidates, write outreach, or schedule automations..."
              className="flex-1 bg-transparent border-none outline-none text-gray-200 placeholder-gray-400"
              id="chat-input"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors" id="send-button">
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</span>
            <span className="text-xs text-gray-500">Powered by REX AI</span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes rex-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      `}</style>
    </div>
  );
}

export function sendMessageToRex(message) {
  // TODO: integrate MCP chat backend
}


