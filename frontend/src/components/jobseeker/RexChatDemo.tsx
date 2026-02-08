import React, { useMemo, useState } from 'react';

const quickPrompts = [
  'Rewrite my resume summary for a Head of Sales role.',
  'Give me 3 stronger bullets for my VP of Sales experience.',
  "Tighten this LinkedIn 'About' section.",
  'Draft an outreach email to a VP of Sales recruiter.',
];

const chatHistory = [
  {
    role: 'user',
    content: 'Can you rewrite my resume summary for a Head of Sales role?',
    time: '2:34 PM',
  },
  {
    role: 'assistant',
    content:
      "Here's a rewritten summary tailored for Head of Sales positions in B2B SaaS:\n\nResults-driven sales executive with 8+ years leading high-performing teams in B2B SaaS environments. Proven track record of scaling revenue from $2M to $15M+ while building remote-first sales organizations. Expert in enterprise deal cycles, strategic partnerships, and implementing data-driven sales processes that consistently exceed targets by 20-30%.",
    time: '2:34 PM',
  },
  {
    role: 'user',
    content: 'Now give me 3 bullets for my Nimbus Data experience.',
    time: '2:36 PM',
  },
  {
    role: 'assistant',
    content:
      'Here are 3 strong bullets for your Nimbus Data experience:\n\n• Scaled enterprise sales team from 5 to 15 reps, driving 340% revenue growth ($3M to $13.2M ARR) over 18 months\n• Implemented Salesforce automation and lead scoring system, reducing sales cycle by 25% and improving conversion rates by 35%\n• Secured 3 enterprise deals worth $2M+ each by developing strategic partnerships with Fortune 500 technology integrators',
    time: '2:37 PM',
  },
];

export default function RexChatDemo() {
  const [prompt, setPrompt] = useState('');
  const bubbles = useMemo(
    () =>
      chatHistory.map((message) => ({
        ...message,
        paragraphs: message.content.split('\n\n'),
      })),
    []
  );

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 lg:p-6">
      <style>{`
        ::-webkit-scrollbar { display: none; }
        .typing-dots span {
          animation: typing 1.4s infinite;
        }
        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
        .message-bubble {
          animation: messageSlide 0.18s ease-out;
        }
        @keyframes messageSlide {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button className="text-slate-400 hover:text-slate-200 transition-colors text-sm">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              Back to Prep
            </button>
            <div className="flex items-start gap-3">
              <div className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-sm">
                REX · Job Prep Assistant
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-100">Ask REX anything about your job search</h1>
                <p className="text-sm text-slate-400">
                  Optimize your resume, LinkedIn, outreach messages, and interview prep with an AI coach tuned to your targets.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm">
              Target: Head of Sales · B2B SaaS
            </div>
            <div className="text-xs text-slate-500">
              Mode:{' '}
              <select
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
                defaultValue="General"
              >
                <option>General</option>
                <option>Resume</option>
                <option>LinkedIn</option>
                <option>Outreach</option>
                <option>Interview</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_minmax(0,1.1fr)]">
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
                  <i className="fa-solid fa-check text-emerald-400 text-xs"></i>
                  <span>Resume: Brandon_Omoregie_Resume.pdf</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <i className="fa-solid fa-check text-emerald-400 text-xs"></i>
                  <span>LinkedIn: /in/brandon</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs">REX will use these when rewriting content.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-slate-200">Try asking</h3>
              <div className="space-y-2">
                {quickPrompts.map((text) => (
                  <button
                    key={text}
                    className="w-full text-left p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-300 text-xs transition-colors"
                    onClick={() => setPrompt(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 flex flex-col h-full relative min-h-[420px]">
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
              {bubbles.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={message.role === 'user' ? 'max-w-[70%]' : 'max-w-[80%]'}>
                    {message.role === 'assistant' ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                          RX
                        </div>
                        <div className="bg-slate-800 text-slate-100 rounded-3xl rounded-bl-lg px-4 py-3 message-bubble space-y-3">
                          {message.paragraphs.map((paragraph, paragraphIndex) => (
                            <p key={paragraphIndex} className="text-sm text-slate-100 whitespace-pre-line">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-sky-500 text-slate-50 rounded-3xl rounded-br-lg px-4 py-3 message-bubble">
                        {message.content}
                      </div>
                    )}
                    <div
                      className={`text-xs text-slate-500 mt-1 ${message.role === 'user' ? 'text-right' : 'ml-11'}`}
                    >
                      {message.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 flex items-end gap-2">
                <textarea
                  rows={1}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask REX to improve your resume, LinkedIn, or outreach copy..."
                  className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none text-sm"
                ></textarea>
                <button className="text-slate-400 hover:text-slate-200 p-2">
                  <i className="fa-solid fa-sparkles"></i>
                </button>
                <button className="bg-sky-500 hover:bg-sky-400 text-slate-50 rounded-full w-10 h-10 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-arrow-up"></i>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 flex flex-col h-full text-xs">
            <div className="space-y-2 mb-4">
              <h3 className="font-medium text-slate-200">REX status</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <span className="text-slate-400">Idle · Ready for your next question</span>
              </div>
            </div>

            <div className="mt-auto">
              <h4 className="font-medium text-slate-300 mb-2">Recent actions</h4>
              <ul className="space-y-1 text-slate-400">
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-circle text-xs text-emerald-400"></i>
                  Rewrote resume summary for Head of Sales
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-circle text-xs text-emerald-400"></i>
                  Generated 3 new experience bullets for Nimbus Data
                </li>
                <li className="flex items-center gap-2">
                  <i className="fa-solid fa-circle text-xs text-slate-600"></i>
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
