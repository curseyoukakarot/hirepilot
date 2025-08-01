/*
 * -----------------------------------------------------------------------------
 *  REX Chat UI – premium dark-mode chat experience for the HirePilot platform
 * -----------------------------------------------------------------------------
 *  – Sidebar with conversation list (collapses on mobile)
 *  – Chat area with messages, typing indicator, input bar
 *  – Tailwind-only styling, custom keyframes kept via <style> tag
 *  – Premium-plan gating logic retained (RecruitPro / TeamAdmin)
 *  – Functional components grouped in this file to avoid extra imports
 * -----------------------------------------------------------------------------
 */

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

interface ChatMessage {
  id: string;
  sender: "user" | "rex";
  content: string;
  timestamp: string;
  attachments?: {
    name: string;
    size: string;
    url?: string;
  }[];
}

function Sidebar({ conversations }: { conversations: any[] }) {
  return (
    <aside className="hidden sm:flex w-64 bg-gray-800 border-r border-gray-700 flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
            <i className="fas fa-robot text-white text-sm" />
          </div>
          <h1 className="text-lg font-semibold">REX Assistant</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-500">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className="p-3 rounded-lg bg-gray-700 cursor-pointer hover:bg-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{c.title}</span>
              <span className="text-xs text-gray-400">{c.time}</span>
            </div>
            <p className="text-xs text-gray-400 truncate">{c.preview}</p>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <button className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-sm">
          <i className="fas fa-plus text-sm" />
          <span>New Chat</span>
        </button>
      </div>
    </aside>
  );
}

function ChatHeader() {
  return (
    <header className="p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <img
          src="/logo.png"
          alt="HirePilot Logo"
          className="w-10 h-10 rounded-full"
        />
        <div>
          <h2 className="font-semibold">REX Chat Assistant</h2>
          <p className="text-sm text-green-400 flex items-center">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2" /> Online
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 text-gray-400">
        <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
          <i className="fas fa-phone" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
          <i className="fas fa-video" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
          <i className="fas fa-ellipsis-v" />
        </button>
      </div>
    </header>
  );
}

function Message({ msg }: { msg: ChatMessage }) {
  if (msg.sender === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-xs lg:max-w-md">
          <div className="bg-purple-600 rounded-2xl rounded-br-md p-3 message-bubble">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="flex items-center justify-end mt-1 space-x-2 text-xs text-gray-400">
            <span>{msg.timestamp}</span>
            <i className="fas fa-check-double text-purple-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex space-x-3 max-w-2xl">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fas fa-robot text-white text-xs" />
        </div>
        <div>
          <div className="bg-gray-800 rounded-2xl rounded-bl-md p-4 message-bubble ai-glow">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
            <span>{msg.timestamp}</span>
            <div className="flex items-center space-x-2">
              <button className="hover:text-green-400">
                <i className="fas fa-thumbs-up" />
              </button>
              <button className="hover:text-red-400">
                <i className="fas fa-thumbs-down" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex space-x-3">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
          <i className="fas fa-robot text-white text-xs" />
        </div>
        <div className="bg-gray-800 rounded-2xl rounded-bl-md p-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-500 rounded-full typing-animation" />
            <div
              className="w-2 h-2 bg-gray-500 rounded-full typing-animation"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="w-2 h-2 bg-gray-500 rounded-full typing-animation"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // auto resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [value]);

  const handleSend = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-gray-700 bg-gray-800">
      <div className="flex items-end space-x-3">
        <button className="p-2 text-gray-400 hover:text-white transition-colors">
          <i className="fas fa-paperclip" />
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            placeholder="Ask a question on your mind..."
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pr-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors">
            <i className="fas fa-microphone" />
          </button>
        </div>

        <button
          onClick={handleSend}
          className="p-3 bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
        >
          <i className="fas fa-paper-plane text-white" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <div className="flex space-x-2">
          <button className="hover:text-white transition-colors">
            <i className="fas fa-smile" />
          </button>
          <button className="hover:text-white transition-colors">
            <i className="fas fa-image" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RexChatBox() {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Check eligibility once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let userType = (user?.user_metadata as any)?.user_type || (user?.user_metadata as any)?.role || (user?.user_metadata as any)?.account_type;

      if (!userType && user) {
        // Fallback: fetch from users table
        const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (data?.role) userType = data.role;
      }

      setEligible(["RecruitPro","TeamAdmin","SuperAdmin","super_admin","admin"].includes(userType));
    })();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsTyping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const supaUserId = user?.id || 'anon';
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: supaUserId,
          messages: [
            ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content })),
            { role: 'user', content: text }
          ]
        })
      });
      const data = await res.json();
      const assistantText = data.reply?.content || '(no reply)';
      const rexMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'rex',
        content: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, rexMsg]);
    } catch (err) {
      console.error('Chat error', err);
    } finally {
      setIsTyping(false);
    }
  };

  if (eligible === null) return null; // still loading

  if (!eligible) {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 text-gray-700">
        REX is only available on the <span className="font-semibold">$499/month Team</span> plan or
        RecruitPro program. Upgrade to unlock access.
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 text-white font-inter flex">
      {/* Sidebar */}
      <Sidebar
        conversations={[] /* Placeholder – hook up to real history later */}
      />

      {/* Chat main */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />

        {/* Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4" id="messages-area">
          {messages.map((m) => (
            <Message key={m.id} msg={m} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </main>

        {/* Input */}
        <ChatInput onSend={sendMessage} />
      </div>

      {/* custom styles */}
      <style>{`
        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1f2937; }
        ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 3px; }
        /* typing animation */
        @keyframes typing { 0%,60%,100% { opacity: 0.3 } 30% { opacity: 1 } }
        .typing-animation { animation: typing 1.5s infinite; }
        /* message entrance */
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        .message-bubble { animation: slideIn 0.3s ease-out; }
        .ai-glow { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
      `}</style>
    </div>
  );
} 