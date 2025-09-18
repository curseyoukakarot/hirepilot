import React, { useMemo, useState } from 'react';
import { supportAgent } from '../rex/tools/supportAgent';

type Message = { role: 'user' | 'agent'; text: string };

export default function SupportChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [cta, setCta] = useState<'rex_chat' | 'slack_rex' | 'support_ticket' | 'none' | null>(null);

  const slackDeepLink = useMemo(() => {
    const team = (import.meta as any)?.env?.VITE_SLACK_TEAM || '';
    const channel = (import.meta as any)?.env?.VITE_SLACK_REX_CHANNEL || '';
    return team && channel ? `https://slack.com/app_redirect?team=${encodeURIComponent(team)}&channel=${encodeURIComponent(channel)}` : 'https://slack.com/app_redirect';
  }, []);

  async function handleSend() {
    const q = input.trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    const { response, escalation } = await supportAgent.execute({ query: q, userId: undefined });
    setMessages(prev => [...prev, { role: 'agent', text: response }]);
    setCta(escalation);
  }

  return (
    <div className="fixed bottom-24 right-6 w-96 border rounded-lg shadow-lg bg-white z-[71]">
      <div className="p-2 font-semibold border-b">Support Assistant</div>
      <div className="p-2 h-64 overflow-y-auto space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-blue-600' : 'text-gray-800'}>
            {m.text}
          </div>
        ))}
      </div>
      {cta && cta !== 'none' && (
        <div className="px-2 py-2 border-t flex gap-2">
          {(cta === 'rex_chat' || cta === 'none') && (
            <button onClick={() => { try { (window as any).openRexDrawer?.(); } catch {} }} className="px-3 py-2 bg-purple-600 text-white rounded">
              Ask REX in Chat
            </button>
          )}
          <a href={slackDeepLink} target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-100 text-slate-900 rounded border">
            Ask REX in Slack
          </a>
          {cta === 'support_ticket' && (
            <span className="text-xs text-emerald-700 self-center">Ticket submitted ✅</span>
          )}
        </div>
      )}
      <div className="flex border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2"
          placeholder="Ask REX or chat with support"
        />
        <button onClick={handleSend} className="px-4 py-2 bg-blue-600 text-white">
          Send
        </button>
      </div>
    </div>
  );
}


