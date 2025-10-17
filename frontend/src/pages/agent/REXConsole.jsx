import React, { useEffect } from 'react';

export default function REXConsole() {
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
    function sendMessage() {
      const message = (chatInput && (chatInput).value) ? (chatInput).value.trim() : '';
      if (!message) return;
      addUserMessage(message);
      (chatInput).value = '';
      showTypingIndicator();
      setTimeout(() => {
        hideTypingIndicator();
        addREXResponse("I'll help you with that right away. Let me analyze your request and provide the best solution.");
      }, 2000);
      try { sendMessageToRex(message); } catch {}
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
          <div id="persona-badge" className="bg-blue-900/50 border border-blue-700 px-3 py-1 rounded-full flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
            <span className="text-sm font-medium text-blue-300">Persona Active: Senior Software Engineer</span>
            <span className="bg-blue-800 text-blue-200 px-2 py-0.5 rounded text-xs font-medium">Tech Recruiter</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="text-gray-400 hover:text-gray-300 transition-colors">
            <i className="fa-solid fa-info-circle" />
          </button>
        </div>
      </header>

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
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-indicator" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-indicator" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full typing-indicator" style={{ animationDelay: '0.4s' }} />
                </div>
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
    </div>
  );
}

export function sendMessageToRex(message) {
  // TODO: integrate MCP chat backend
}


