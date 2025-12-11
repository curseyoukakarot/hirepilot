import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowLeft,
  FaArrowUp,
  FaBriefcase,
  FaChartLine,
  FaCheck,
  FaCircle,
  FaComments,
  FaGlobe,
  FaWandMagicSparkles,
} from 'react-icons/fa6';
import { Link } from 'react-router-dom';

type MessageRole = 'user' | 'assistant';
type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
};

const seededMessages: Message[] = [
  {
    id: 'u1',
    role: 'user',
    content: 'Can you rewrite my resume summary for a Head of Sales role?',
    timestamp: '2:34 PM',
  },
  {
    id: 'a1',
    role: 'assistant',
    content:
      "Here's a rewritten summary tailored for Head of Sales positions in B2B SaaS:\n\nResults-driven sales executive with 8+ years leading high-performing teams in B2B SaaS environments. Proven track record of scaling revenue from $2M to $15M+ while building remote-first sales organizations. Expert in enterprise deal cycles, strategic partnerships, and implementing data-driven sales processes that consistently exceed targets by 20-30%.",
    timestamp: '2:34 PM',
  },
  {
    id: 'u2',
    role: 'user',
    content: 'Now give me 3 bullets for my Nimbus Data experience.',
    timestamp: '2:36 PM',
  },
  {
    id: 'a2',
    role: 'assistant',
    content:
      'Here are 3 strong bullets for your Nimbus Data experience:\n\n• Scaled enterprise sales team from 5 to 15 reps, driving 340% revenue growth ($3M to $13.2M ARR) over 18 months\n• Implemented Salesforce automation and lead scoring system, reducing sales cycle by 25% and improving conversion rates by 35%\n• Secured 3 enterprise deals worth $2M+ each by developing strategic partnerships with Fortune 500 technology integrators',
    timestamp: '2:37 PM',
  },
];

const cannedResponses = [
  "Here's a revised version that better highlights your leadership experience and quantifiable results in B2B SaaS environments.",
  "I've crafted three compelling bullets that emphasize your strategic impact and measurable outcomes at Nimbus Data.",
  "Here's a tightened LinkedIn About section that positions you as a results-driven sales leader in the B2B SaaS space.",
  "I've drafted a personalized outreach email that highlights your relevant experience and creates a compelling reason to connect.",
];

export default function JobPrepChatPage() {
  const [messages, setMessages] = useState<Message[]>(seededMessages);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const thinkingTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const statusLabel = useMemo(() => {
    return isThinking ? 'Running...' : 'Idle · Ready for your next question';
  }, [isThinking]);

  const statusDotClass = isThinking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500';

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      if (thinkingTimer.current) {
        window.clearTimeout(thinkingTimer.current);
      }
    };
  }, []);

  const addMessage = (role: MessageRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}`,
        role,
        content,
        timestamp: nowTime(),
      },
    ]);
  };

  const startThinking = () => {
    setIsThinking(true);
  };

  const finishThinking = (response?: string) => {
    setIsThinking(false);
    if (response) {
      addMessage('assistant', response);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    addMessage('user', trimmed);
    setInput('');
    startThinking();
    // simulate response
    thinkingTimer.current = window.setTimeout(() => {
      const resp = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      finishThinking(resp);
    }, 1600);
  };

  const handleStop = () => {
    if (!isThinking) return;
    if (thinkingTimer.current) {
      window.clearTimeout(thinkingTimer.current);
    }
    finishThinking("Generation stopped. Here's a partial draft you can edit.");
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
  };

  return (
    <div className="bg-[#020617] text-slate-100 font-sans min-h-[calc(100vh-72px)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 flex flex-col gap-4 h-[calc(100vh-72px)]">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/prep" className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center">
              <FaArrowLeft className="mr-2" />
              Back to Prep
            </Link>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-sm">
                REX · Job Prep Assistant
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-100">Ask REX anything about your job search</h1>
                <p className="text-sm text-slate-400">
                  Optimize your resume, LinkedIn, outreach messages, and interview prep with an AI coach tuned to your
                  targets.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm">
              Target: Head of Sales · B2B SaaS
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Mode:</span>
              <select className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                <option>General</option>
                <option>Resume</option>
                <option>LinkedIn</option>
                <option>Outreach</option>
                <option>Interview</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_minmax(0,1.1fr)]">
          {/* Left Column */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-4 text-xs">
            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Current context</h3>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="text-slate-300">Head of Sales</span>
                </div>
                <div className="flex justify-between">
                  <span>Industry:</span>
                  <span className="text-slate-300">B2B SaaS</span>
                </div>
                <div className="flex justify-between">
                  <span>Focus:</span>
                  <span className="text-slate-300">Leadership · Remote-first</span>
                </div>
              </div>
              <button className="text-sky-400 hover:text-sky-300 text-xs">Edit job target</button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Attached assets</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-300">
                  <FaCheck className="text-emerald-400 text-xs" />
                  <span>Resume: Brandon_Omoregie_Resume.pdf</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <FaCheck className="text-emerald-400 text-xs" />
                  <span>LinkedIn: /in/brandon</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs">REX will use these when rewriting content.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Try asking</h3>
              <div className="space-y-2">
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Rewrite my resume summary for a Head of Sales role.')}
                >
                  Rewrite my resume summary for a Head of Sales role.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Give me 3 stronger bullets for my VP of Sales experience.')}
                >
                  Give me 3 stronger bullets for my VP of Sales experience.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt("Tighten this LinkedIn 'About' section.")}
                >
                  Tighten this LinkedIn 'About' section.
                </button>
                <button
                  className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                  onClick={() => handleQuickPrompt('Draft an outreach email to a VP of Sales recruiter.')}
                >
                  Draft an outreach email to a VP of Sales recruiter.
                </button>
              </div>
            </div>
          </div>

          {/* Center Column - Chat */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 flex flex-col h-full relative">
            <div id="messages-area" className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={m.role === 'user' ? 'max-w-[70%]' : 'max-w-[80%]'}>
                    {m.role === 'assistant' ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                          RX
                        </div>
                        <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble whitespace-pre-line">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-sky-500 text-slate-50 rounded-3xl rounded-br-lg px-4 py-3 message-bubble whitespace-pre-line">
                        {m.content}
                      </div>
                    )}
                    <div
                      className={`text-xs text-slate-500 mt-1 ${m.role === 'user' ? 'text-right' : 'ml-11'}`}
                    >
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        RX
                      </div>
                      <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble">
                        <div className="flex gap-1 mb-2">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:120ms]" />
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:240ms]" />
                        </div>
                        <p className="text-sm text-slate-400">Analyzing attached resume...</p>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-700">
                          <div className="h-full w-1/2 rounded-full bg-sky-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 flex items-end gap-2">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask REX to improve your resume, LinkedIn, or outreach copy..."
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none"
                />
                <button className="text-slate-400 hover:text-slate-200 p-2">
                  <FaWandMagicSparkles />
                </button>
                <button
                  onClick={handleSend}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-50 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                >
                  <FaArrowUp />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Status */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 flex flex-col h-full text-xs">
            <div className="space-y-2 mb-4">
              <h3 className="font-medium text-slate-200">REX status</h3>
              <div id="status-indicator" className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
                <span className={isThinking ? 'text-emerald-400' : 'text-slate-400'}>{statusLabel}</span>
              </div>
            </div>

            {isThinking && (
              <div id="step-list" className="space-y-3 mb-4">
                <h4 className="font-medium text-slate-300">Processing steps</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center">
                      <FaCheck className="text-slate-900 text-xs" />
                    </div>
                    <span className="text-slate-300">Analyze your request</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-sky-400 animate-spin">
                      <div className="w-2 h-2 bg-slate-900 rounded-full ml-1 mt-1" />
                    </div>
                    <span className="text-slate-200">Pull in resume / profile context</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-600" />
                    <span className="text-slate-500">Draft and refine response</span>
                  </div>
                </div>
              </div>
            )}

            {isThinking && (
              <div id="stop-section" className="mb-4">
                <button
                  onClick={handleStop}
                  className="w-full rounded-full bg-slate-950 border border-slate-700 text-slate-200 hover:border-rose-500 hover:text-rose-300 py-2 px-4 transition-colors"
                >
                  <i className="fa-solid fa-stop mr-2" />
                  Stop generating
                </button>
                <p className="text-slate-500 text-xs mt-2 text-center">
                  Stopping keeps partial drafts visible in the thread.
                </p>
              </div>
            )}

            <div className="mt-auto">
              <h4 className="font-medium text-slate-300 mb-2">Recent actions</h4>
              <ul className="space-y-1 text-slate-400">
                <li className="flex items-center gap-2">
                  <FaCircle className="text-xs text-emerald-400" />
                  Rewrote resume summary for Head of Sales
                </li>
                <li className="flex items-center gap-2">
                  <FaCircle className="text-xs text-emerald-400" />
                  Generated 3 new experience bullets for Nimbus Data
                </li>
                <li className="flex items-center gap-2">
                  <FaCircle className="text-xs text-slate-600" />
                  Tightened LinkedIn About section
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
